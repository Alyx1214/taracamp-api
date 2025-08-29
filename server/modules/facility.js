import { Storage, } from '@google-cloud/storage';
import { Status, FacilityType, FacilityStatus, UserRole, } from '../constants.js';
import dotenv from 'dotenv';
dotenv.config();

const storage = new Storage();
const bucket = storage.bucket(process.env.BUCKET_NAME);
const facilityModule = {
    /**
     * Adds a new facility to the database.
     * @param {Object} dbHelper - The database helper object.
     * @param {Object} data - The facility data.
     * @param {File} file - The image file.
     * @param {Object} user - The authenticated user.
     * @return {Promise<Object>} The response data.
     */
    addFacility: async (dbHelper, data, file, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error adding facility',
        };

        try {
            const { name, facilityType, capacity, ratePerPerson, price, status, } = data;

            if (
                !isPresent(name) ||
                !isPresent(facilityType) ||
                !isPresent(capacity) ||
                (facilityType === FacilityType.CONFERENCE && !isPresent(price)) ||
                ((facilityType === FacilityType.DORMITORY || facilityType === FacilityType.COTTAGE) && !isPresent(ratePerPerson))
            ) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Missing required fields';
                return responseData;
            }

            if (!user || !user.userId) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'User not logged in';
                return responseData;
            }

            if (user.role !== UserRole.CRMSTEAM && user.role !== UserRole.SUPERINTENDENT) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'Only CRMS team and Superintendents can add a facility';
                return responseData;
            }

            let imageKey = null;
            let imageUrl = null;

            if (file) {
                const imageError = isValidImage(file);
                if (imageError) {
                    responseData.status = Status.BAD_REQUEST;
                    responseData.error = imageError;
                    return responseData;
                }
                try {
                    imageKey = await uploadImageAndGetKey(file);
                    imageUrl = await getSignedReadUrl(imageKey);
                } catch (err) {
                    responseData.status = Status.INTERNAL_SERVER_ERROR;
                    responseData.error = 'Image upload failed: ' + err.message;
                    return responseData;
                }
            }

            if (!isValidFacilityType(facilityType)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid facility type';
                return responseData;
            }

            if (!isValidCapacity(capacity)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid or missing capacity';
                return responseData;
            }

            if (
                (facilityType === FacilityType.CONFERENCE && !isValidRate(price)) ||
          ((facilityType === FacilityType.DORMITORY || facilityType === FacilityType.COTTAGE) && !isValidRate(ratePerPerson))
            ) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Missing or invalid rate/price for this facility type';
                return responseData;
            }

            if (!isValidFacilityStatus(status)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid facility status';
                return responseData;
            }

            // Normalize facility name to Title Case directly in queries
            const existing = await dbHelper.findOne('facility', { name: toTitleCase(String(name || '')), facilityType, });
            if (existing) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Facility already exists';
                return responseData;
            }

            const facilityData = {
                name: toTitleCase(String(name || '')),
                facilityType,
                status,
            };

            // Store capacity for all facility types
            facilityData.capacity = parseInt(String(capacity).replace(/,/g, ''), 10);

            if (imageKey) {
                facilityData.image = imageKey;
            }

            if (facilityType === FacilityType.CONFERENCE) {
                facilityData.price = Number(String(price).replace(/,/g, '')) || 0;
            }
            if (facilityType === FacilityType.DORMITORY || facilityType === FacilityType.COTTAGE) {
                facilityData.ratePerPerson = Number(String(ratePerPerson).replace(/,/g, '')) || 0;
            }

            const facility = await dbHelper.create('facility', facilityData);

            responseData.status = Status.CREATED;
            responseData.error = null;
            responseData.message = 'Facility added successfully';
            responseData.facilityId = facility._id.toString();
            if (imageKey) responseData.imageUrl = imageUrl;
        } catch (error) {
            console.error('Error adding facility:', error);
            responseData.error = error.message;
        }
        return responseData;
    },

    /**
     * Fetches all facilities.
     * @param {Object} dbHelper - The database helper for database operations.
     * @returns {Object} Response data with status, error, and facilities on success.
     */
    getAllFacilities: async (dbHelper) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error fetching facilities',
            facilities: [],
        };
        try {
            const facilities = await dbHelper.find('facility', {}, { __v: 0, createdAt: 0, });

            const withSigned = await Promise.all(
                facilities.map(async (f) => {
                    const obj = f.toObject ? f.toObject() : f;
                    obj.name = toTitleCase(String(obj.name || ''));
                    obj.image = obj.image ? await getSignedReadUrl(obj.image) : null;
                    return obj;
                })
            );

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.facilities = withSigned;
        } catch (error) {
            responseData.error = error.message;
        }
        return responseData;
    },

    /**
     * Fetches a facility by its ID.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {string} id - The ID of the facility to be fetched.
     * @returns {Object} Response data with status, error, and facility on success.
     */
    getFacilityById: async (dbHelper, id) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error fetching facility',
            facility: null,
        };

        if (!id) {
            responseData.status = Status.BAD_REQUEST;
            responseData.error = 'Missing facility ID';
            return responseData;
        }

        try {
            const facility = await dbHelper.findOne('facility', { _id: id, });
            if (!facility) {
                responseData.status = Status.NOT_FOUND;
                responseData.error = 'Facility not found';
                return responseData;
            }

            const facilityObject = facility.toObject();
            delete facilityObject.__v;
            delete facilityObject.createdAt;

            // Ensure name is Title Case when returned
            facilityObject.name = toTitleCase(String(facilityObject.name || ''));
            facilityObject.image = facilityObject.image
                ? await getSignedReadUrl(facilityObject.image)
                : null;

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.facility = facilityObject;
        } catch (error) {
            responseData.error = error.message;
        }
        return responseData;
    },

    /**
     * Edits a facility by its ID.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {string} id - The ID of the facility to be edited.
     * @param {Object} data - The data object containing the new values for name, facilityType, capacity, ratePerPerson, and status.
     * @param {Object} file - The file object containing the new image.
     * @param {Object} user - The user object containing the user ID and role.
     * @returns {Object} Response data with status, error, message, and facilityId on success.
     */
    updateFacility: async (dbHelper, id, data, file, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error editing facility',
        };

        try {
            if (!id) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Missing facility ID';
                return responseData;
            }

            if (!user || !user.userId) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'User not logged in';
                return responseData;
            }

            if (user.role !== UserRole.CRMSTEAM && user.role !== UserRole.SUPERINTENDENT) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'Only CRMS team and Superintendent can edit a facility';
                return responseData;
            }

            const facility = await dbHelper.findOne('facility', { _id: id, });
            if (!facility) {
                responseData.status = Status.NOT_FOUND;
                responseData.error = 'Facility not found';
                return responseData;
            }

            const updateData = {};

            if (isPresent(data.name)) {
                updateData.name = toTitleCase(String(data.name));
            }

            if (isPresent(data.facilityType)) {
                if (!isValidFacilityType(data.facilityType)) {
                    responseData.status = Status.BAD_REQUEST;
                    responseData.error = 'Invalid facility type';
                    return responseData;
                }
                updateData.facilityType = data.facilityType;
            }

            if (isPresent(data.capacity)) {
                if (!isValidCapacity(data.capacity)) {
                    responseData.status = Status.BAD_REQUEST;
                    responseData.error = 'Invalid capacity';
                    return responseData;
                }
                updateData.capacity = parseInt(String(data.capacity).replace(/,/g, ''), 10);
            }

            if (
                (data.facilityType === FacilityType.CONFERENCE || facility.facilityType === FacilityType.CONFERENCE) &&
        isPresent(data.price)
            ) {
                const priceNum = Number(String(data.price).replace(/,/g, ''));
                if (!isValidRate(priceNum)) {
                    responseData.status = Status.BAD_REQUEST;
                    responseData.error = 'Invalid price for conference facility';
                    return responseData;
                }
                updateData.price = priceNum;
                updateData.ratePerPerson = undefined;
            }

            if (
                ((data.facilityType === FacilityType.DORMITORY || data.facilityType === FacilityType.COTTAGE) ||
          (facility.facilityType === FacilityType.DORMITORY || facility.facilityType === FacilityType.COTTAGE)) &&
        isPresent(data.ratePerPerson)
            ) {
                const rateNum = Number(String(data.ratePerPerson).replace(/,/g, ''));
                if (!isValidRate(rateNum)) {
                    responseData.status = Status.BAD_REQUEST;
                    responseData.error = 'Invalid rate per person for dormitory/cottage facility';
                    return responseData;
                }
                updateData.ratePerPerson = rateNum;
                updateData.price = undefined;
            }

            if (isPresent(data.status)) {
                if (!isValidFacilityStatus(data.status)) {
                    responseData.status = Status.BAD_REQUEST;
                    responseData.error = 'Invalid facility status';
                    return responseData;
                }
                updateData.status = data.status;
            }

            if (file) {
                const imageError = isValidImage(file);
                if (imageError) {
                    responseData.status = Status.BAD_REQUEST;
                    responseData.error = imageError;
                    return responseData;
                }
                try {
                    if (facility.image) {
                        try { await bucket.file(facility.image).delete(); } catch { /* ignore */ }
                    }
                    const newKey = await uploadImageAndGetKey(file);
                    updateData.image = newKey;
                    responseData.newImageUrl = await getSignedReadUrl(newKey);
                } catch (err) {
                    responseData.status = Status.INTERNAL_SERVER_ERROR;
                    responseData.error = 'Image upload failed: ' + err.message;
                    return responseData;
                }
            }

            if (updateData.name) {
                const existingFacility = await dbHelper.findOne('facility', {
                    name: updateData.name,
                    _id: { $ne: id, },
                });
                if (existingFacility) {
                    responseData.status = Status.BAD_REQUEST;
                    responseData.error = 'Facility with this name already exists';
                    return responseData;
                }
            }

            if (data.facilityType && data.facilityType === FacilityType.CONFERENCE) {
                updateData.ratePerPerson = undefined;
            }
            if (data.facilityType && (data.facilityType === FacilityType.DORMITORY || data.facilityType === FacilityType.COTTAGE)) {
                updateData.price = undefined;
            }

            Object.keys(updateData).forEach((key) => updateData[key] === undefined && delete updateData[key]);

            await dbHelper.updateOne('facility', { _id: id, }, { $set: updateData, });

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = 'Facility updated successfully';
            responseData.facilityId = id;
        } catch (error) {
            console.error('Error editing facility:', error);
            responseData.error = error.message;
        }
        return responseData;
    },

    /**
     * Deletes a facility by its ID.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {string} id - The ID of the facility to be deleted.
     * @param {Object} user - The user object containing the user ID and role.
     * @returns {Object} Response data with status, error, message, and facilityId on success.
     */
    deleteFacility: async (dbHelper, id, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error deleting facility',
        };

        try {
            if (!id) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Missing facility ID';
                return responseData;
            }

            if (!user || !user.userId) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'User not logged in';
                return responseData;
            }

            if (user.role !== UserRole.CRMSTEAM && user.role !== UserRole.SUPERINTENDENT) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'Only CRMS team and Superintendent can delete a facility';
                return responseData;
            }

            const facility = await dbHelper.findOne('facility', { _id: id, });
            if (!facility) {
                responseData.status = Status.NOT_FOUND;
                responseData.error = 'Facility not found';
                return responseData;
            }

            if (facility.image) {
                try { await bucket.file(facility.image).delete(); } catch (imgErr) {
                    console.warn('Failed to delete facility image:', imgErr.message);
                }
            }

            await dbHelper.deleteOne('facility', { _id: id, });

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = 'Facility deleted successfully';
            responseData.facilityId = id;
        } catch (error) {
            console.error('Error deleting facility:', error);
            responseData.error = error.message;
        }
        return responseData;
    },

    /**
     * Fetches facilities by their type.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {string} facilityType - The type of the facility to be fetched.
     * @returns {Object} Response data with status, error, and facilities on success.
     */
    getFacilitiesByType: async (dbHelper, facilityType) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error fetching facilities by type',
            facilities: [],
        };

        if (!isPresent(facilityType)) {
            responseData.status = Status.BAD_REQUEST;
            responseData.error = 'Missing facility type';
            return responseData;
        }

        if (!isValidFacilityType(facilityType)) {
            responseData.status = Status.BAD_REQUEST;
            responseData.error = 'Invalid facility type';
            return responseData;
        }

        try {
            const facilities = await dbHelper.find(
                'facility',
                { facilityType: facilityType, },
                { status: 0, __v: 0, createdAt: 0, }
            );

            const facilitiesObject = await Promise.all(facilities.map(async (facility) => ({
                id: facility._id.toString(),
                name: toTitleCase(String(facility.name || '')),
                capacity: facility.capacity,
                ratePerPerson: facility.ratePerPerson,
                price: facility.price,
                image: facility.image ? await getSignedReadUrl(facility.image) : null,
            })));

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.facilities = facilitiesObject;
        } catch (error) {
            console.error('Error fetching facilities by type:', error);
            responseData.error = error.message;
        }
        return responseData;
    },

    /**
     * Fetches all available dates for a given facility.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {string} facilityId - The ID of the facility to check availability for.
     * @returns {Object} Response data with status, error, and an array of available dates on success.
     */
    getAvailableDatesByFacility: async (dbHelper, facilityId) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error fetching available dates',
            availableDates: [],
        };

        try {
            if (!facilityId) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Missing facility ID';
                return responseData;
            }

            const facility = await dbHelper.findOne('facility', { _id: facilityId, });
            if (!facility) {
                responseData.status = Status.NOT_FOUND;
                responseData.error = 'Facility not found';
                return responseData;
            }

            // Define the date range to check (e.g., next 6 months)
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const endDate = new Date();
            endDate.setMonth(today.getMonth() + 6); // Check for next 6 months

            const reservations = await dbHelper.find('reservation', {
                facility: facilityId,
                $or: [
                    { dateOfArrival: { $lte: endDate, }, dateOfDeparture: { $gte: today, }, },
                ],
            });

            const unavailableDates = new Set();
            reservations.forEach((reservation) => {
                let currentDate = new Date(reservation.dateOfArrival);
                while (currentDate <= reservation.dateOfDeparture) {
                    unavailableDates.add(currentDate.toISOString().split('T')[0]);
                    currentDate.setDate(currentDate.getDate() + 1);
                }
            });

            const availableDates = [];
            let currentDate = new Date(today);
            while (currentDate <= endDate) {
                const dateString = currentDate.toISOString().split('T')[0];
                if (!unavailableDates.has(dateString)) {
                    availableDates.push(dateString);
                }
                currentDate.setDate(currentDate.getDate() + 1);
            }

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.availableDates = availableDates;

        } catch (error) {
            console.error('Error fetching available dates:', error);
            responseData.error = error.message;
        }
        return responseData;
    },

    /**
     * Searches facilities with optional filters, excluding those that have overlapping reservations.
     * @param {Object} dbHelper - Database helper.
     * @param {Object} options - {type, query, minPrice, maxPrice, capacity, checkInDate, checkOutDate}
     * @returns {Object} Response data with status, error, and facilities on success.
     */
    searchFacilities: async (dbHelper, options = {}) => {
        const { type, query, minPrice, maxPrice, capacity, checkInDate, checkOutDate, } = options;
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error searching facilities',
            facilities: [],
        };

        try {
            let filter = {};
            if (type) filter.facilityType = type.trim().toUpperCase();
            if (query) filter.name = new RegExp(query.trim(), 'i');
            if (capacity) filter.capacity = { $gte: Number(capacity), };

            if (minPrice || maxPrice) {
                filter.$or = [];
                if (minPrice) {
                    filter.$or.push({ price: { $gte: Number(minPrice), }, });
                    filter.$or.push({ ratePerPerson: { $gte: Number(minPrice), }, });
                }
                if (maxPrice) {
                    filter.$or.push({ price: { $lte: Number(maxPrice), }, });
                    filter.$or.push({ ratePerPerson: { $lte: Number(maxPrice), }, });
                }
            }

            if (checkInDate && checkOutDate) {
                const overlappingReservations = await dbHelper.find('reservation', {
                    $or: [
                        {
                            dateOfArrival: { $lte: new Date(checkOutDate), },
                            dateOfDeparture: { $gte: new Date(checkInDate), },
                        },
                    ],
                }, { facility: 1, });

                const excludeFacilityIds = overlappingReservations.map((r) => r.facility?.toString()).filter(Boolean);

                if (excludeFacilityIds.length > 0) {
                    filter._id = { $nin: excludeFacilityIds, };
                }
            }

            const facilities = await dbHelper.find('facility', filter, { __v: 0, createdAt: 0, });

            const withSigned = await Promise.all(
                facilities.map(async (f) => {
                    const obj = f.toObject ? f.toObject() : f;
                    obj.name = toTitleCase(String(obj.name || ''));
                    obj.image = obj.image ? await getSignedReadUrl(obj.image) : null;
                    return obj;
                })
            );

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.facilities = withSigned;
        } catch (error) {
            console.error('Error searching facilities:', error);
            responseData.error = error.message;
        }
        return responseData;
    },
};

export default facilityModule;

function isPresent(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') {
    return value.trim().length > 0;  
  }
  if (typeof value === 'number') {
    return !Number.isNaN(value);
  }
  return true; 
}

// Convert a string to Title Case (first letter uppercase per word)
function toTitleCase(str = '') {
    const lower = String(str).toLowerCase();
    return lower.replace(/\b([a-z])(\w*)/g, (_, a, b) => a.toUpperCase() + b);
}

function isValidFacilityType(type) {
    return Object.values(FacilityType).includes(type);
}

function isValidFacilityStatus(status) {
    return Object.values(FacilityStatus).includes(status);
}

function isValidCapacity(cap) {
    if (typeof cap !== 'string' && typeof cap !== 'number') return false;
    const normalized = String(cap).replace(/,/g, '');
    return /^\d+$/.test(normalized) && parseInt(normalized, 10) > 0;
}

function isValidRate(rate) {
    const parsedRate = parseFloat(rate);
    return !isNaN(parsedRate) && parsedRate >= 0;
}

function isValidImage(file) {
    if (!file) return 'Missing image';
    const allowedTypes = ['image/jpeg', 'image/png',];
    if (!allowedTypes.includes(file.mimetype)) {
        return 'Invalid image type. Only JPEG and PNG are allowed';
    }
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
        return 'Image size exceeds the 5MB limit';
    }
    return null;
}

async function uploadImageAndGetKey(file) {
    const filename = `${Date.now()}_${file.originalname.replace(/\s/g, '_')}`;
    const blob = bucket.file((('facility_images/')
        .replace(/(^\/+|\/+$)/g, '') + '/') + filename);
    await new Promise((resolve, reject) => {
        const stream = blob.createWriteStream({
            resumable: false,
            contentType: file.mimetype,
        });
        stream.on('error', reject);
        stream.on('finish', resolve);
        stream.end(file.buffer);
    });
    return (((process.env.FACILITY_IMAGE_PREFIX || 'facility_images/')
        .replace(/(^\/+|\/+$)/g, '') + '/') + filename);
}

async function getSignedReadUrl(imageKey, expiresInMs = 60 * 60 * 1000) {
    if (!imageKey) return null;
    const [url,] = await bucket.file(imageKey).getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + expiresInMs,
    });
    return url;
}
