import { Storage, } from '@google-cloud/storage';
import { Status, FacilityType, FacilityStatus, UserRole, ReservationStatus, } from '../constants.js';
import dotenv from 'dotenv';
dotenv.config();

const storage = new Storage();
const bucket = storage.bucket(process.env.BUCKET_NAME);
const APP_TZ_OFFSET = '+08:00';
const APP_TZ_OFFSET_MINUTES = 8 * 60;
const BLOCKING_RESERVATION_STATUSES = [
    ReservationStatus.PENDING,
    ReservationStatus.APPROVED,
    ReservationStatus.CONFIRMED,
    ReservationStatus.CHECKED_IN,
];

const facilityModule = {
    /**
     * Adds a new facility to the database.
     * @param {Object} dbHelper - The database helper object.
     * @param {Object} data - The facility data.
     * @param {File} file - The image file.
     * @param {Object} user - The authenticated user.
     * @return {Promise<Object>} The response data.
     */
    addFacility: async (dbHelper, data, files, user) => {
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
                ((facilityType === FacilityType.CONFERENCE || facilityType === FacilityType.COTTAGE) && !isPresent(price)) ||
                (facilityType === FacilityType.DORMITORY && !isPresent(ratePerPerson))
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
                ((facilityType === FacilityType.CONFERENCE || facilityType === FacilityType.COTTAGE) && !isValidRate(price)) ||
                (facilityType === FacilityType.DORMITORY && !isValidRate(ratePerPerson))
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

            let imageKeys = [];
            let imageUrls = [];
            if (Array.isArray(files) && files.length) {
                const imgErr = isValidImages(files);
                if (imgErr) {
                    responseData.status = Status.BAD_REQUEST;
                    responseData.error = imgErr;
                    return responseData;
                }
                try {
                    imageKeys = await uploadImagesAndGetKeys(files);
                    imageUrls = await getSignedReadUrls(imageKeys);
                } catch (err) {
                    responseData.status = Status.INTERNAL_SERVER_ERROR;
                    responseData.error = 'Image upload failed: ' + err.message;
                    return responseData;
                }
            }

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
                capacity: parseInt(String(capacity).replace(/,/g, ''), 10),
                images: imageKeys,
            };

            if (facilityType === FacilityType.CONFERENCE || facilityType === FacilityType.COTTAGE) {
                facilityData.price = Number(String(price).replace(/,/g, '')) || 0;
            }
            if (facilityType === FacilityType.DORMITORY) {
                facilityData.ratePerPerson = Number(String(ratePerPerson).replace(/,/g, '')) || 0;
            }

            const facility = await dbHelper.create('facility', facilityData);

            responseData.status = Status.CREATED;
            responseData.error = null;
            responseData.message = 'Facility added successfully';
            responseData.facilityId = facility._id.toString();
            responseData.imageUrls = imageUrls;
        } catch (error) {
            console.error('Error adding facility:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error adding facility';
        }
        return responseData;
    },

    /**
     * Fetches all facilities.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {Object} options - Query options including includeUnavailable flag
     * @returns {Object} Response data with status, error, and facilities on success.
     */
    getAllFacilities: async (dbHelper, options = {}) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error fetching facilities',
            facilities: [],
        };
        try {
            const { limit, skip, sort, includeUnavailable } = options || {};
            const sortOption = sort ? parseSort(sort) : { name: 1, };
            
            let filter = {};
            if (includeUnavailable !== 'true' && includeUnavailable !== true) {
                filter.status = { $ne: FacilityStatus.UNAVAILABLE };
            }
            
            const facilities = await dbHelper.findMany('facility', filter, {
                projection: { __v: 0, createdAt: 0, },
                sort: sortOption,
                limit: clampLimit(limit),
                skip: clampSkip(skip),
            });

            const withSigned = await Promise.all(
                facilities.map(async (f) => {
                    const obj = f.toObject ? f.toObject() : f;
                    obj.name = toTitleCase(String(obj.name || ''));
                    obj.images = await getSignedReadUrls(Array.isArray(obj.images) ? obj.images : []);
                    return obj;
                })
            );

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.facilities = withSigned;
        } catch (error) {
            console.error('Error fetching facilities:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error fetching facilities';
        }
        return responseData;
    },

    /**
     * Fetches a facility by its ID.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {string} id - The ID of the facility to be fetched.
     * @param {boolean} includeReviews - Whether to include review data.
     * @returns {Object} Response data with status, error, and facility on success.
     */
    getFacilityById: async (dbHelper, id, includeReviews = false) => {
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
            facilityObject.name = toTitleCase(String(facilityObject.name || ''));
            facilityObject.images = await getSignedReadUrls(Array.isArray(facilityObject.images) ? facilityObject.images : []);

            if (includeReviews) {
                try {
                    const reviews = await dbHelper.find('review', { facilityId: id });
                    const averageRatings = calculateAverageRatings(reviews);
                    facilityObject.reviewSummary = {
                        totalReviews: reviews.length,
                        averageRatings
                    };
                } catch (reviewError) {
                    console.warn('Error fetching reviews for facility:', reviewError);
                    facilityObject.reviewSummary = {
                        totalReviews: 0,
                        averageRatings: { location: 0, service: 0, cleanliness: 0, overall: 0 }
                    };
                }
            }

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.facility = facilityObject;
        } catch (error) {
            console.error('Error fetching facility:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error fetching facility';
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
    updateFacility: async (dbHelper, id, data, files, user) => {
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
                (data.facilityType === FacilityType.CONFERENCE || data.facilityType === FacilityType.COTTAGE || 
                 facility.facilityType === FacilityType.CONFERENCE || facility.facilityType === FacilityType.COTTAGE) &&
        isPresent(data.price)
            ) {
                const priceNum = Number(String(data.price).replace(/,/g, ''));
                if (!isValidRate(priceNum)) {
                    responseData.status = Status.BAD_REQUEST;
                    responseData.error = 'Invalid price for conference/cottage facility';
                    return responseData;
                }
                updateData.price = priceNum;
                updateData.ratePerPerson = undefined;
            }

            if (
                (data.facilityType === FacilityType.DORMITORY || facility.facilityType === FacilityType.DORMITORY) &&
        isPresent(data.ratePerPerson)
            ) {
                const rateNum = Number(String(data.ratePerPerson).replace(/,/g, ''));
                if (!isValidRate(rateNum)) {
                    responseData.status = Status.BAD_REQUEST;
                    responseData.error = 'Invalid rate per person for dormitory facility';
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

            if (Array.isArray(data.removeImageKeys) && data.removeImageKeys.length) {
                const current = Array.isArray(facility.images) ? facility.images : [];
                const keep = current.filter((k) => !data.removeImageKeys.includes(k));
                const toDelete = current.filter((k) => data.removeImageKeys.includes(k));
                if (toDelete.length) await deleteImages(toDelete);
                updateData.images = keep;
            }

            const imagesMode = (data.imagesMode || 'replace').toLowerCase();
            if (Array.isArray(files) && files.length) {
                const imageError = isValidImages(files);
                if (imageError) {
                    responseData.status = Status.BAD_REQUEST;
                    responseData.error = imageError;
                    return responseData;
                }
                try {
                    const newKeys = await uploadImagesAndGetKeys(files);
                    if (imagesMode === 'append') {
                        updateData.images = (updateData.images ?? (facility.images || [])).concat(newKeys);
                    } else {
                        await deleteImages(facility.images || []);
                        updateData.images = newKeys;
                    }
                    responseData.newImageUrls = await getSignedReadUrls(updateData.images);
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
            if (data.facilityType && data.facilityType === FacilityType.DORMITORY) {
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
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error editing facility';
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

            if (facility.images?.length) {
                try { await deleteImages(facility.images); } catch (imgErr) {
                    console.warn('Failed to delete some images:', imgErr.message);
                }
            }

            await dbHelper.deleteOne('facility', { _id: id, });

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = 'Facility deleted successfully';
            responseData.facilityId = id;
        } catch (error) {
            console.error('Error deleting facility:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error deleting facility';
        }
        return responseData;
    },

    /**
     * Fetches facilities by their type.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {string} facilityType - The type of the facility to be fetched.
     * @param {Object} options - Query options including includeUnavailable flag
     * @returns {Object} Response data with status, error, and facilities on success.
     */
    getFacilitiesByType: async (dbHelper, facilityType, options = {}) => {
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
            const { includeUnavailable } = options;
            
            let filter = { facilityType: facilityType };
            if (includeUnavailable !== 'true' && includeUnavailable !== true) {
                filter.status = { $ne: FacilityStatus.UNAVAILABLE };
            }
            
            const facilities = await dbHelper.find(
                'facility',
                filter,
                { status: 0, __v: 0, createdAt: 0, }
            );

            const facilitiesObject = await Promise.all(facilities.map(async (facility) => ({
                id: facility._id.toString(),
                name: toTitleCase(String(facility.name || '')),
                capacity: facility.capacity,
                ratePerPerson: facility.ratePerPerson,
                price: facility.price,
                images: await getSignedReadUrls(Array.isArray(facility.images) ? facility.images : []),
            })));

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.facilities = facilitiesObject;
        } catch (error) {
            console.error('Error fetching facilities by type:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error fetching facilities by type';
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
            const todayYmd = toAppYMD(new Date());
            const today = fromAppYMD(todayYmd) || new Date();
            const endDate = new Date(today);
            endDate.setUTCMonth(endDate.getUTCMonth() + 6); // Check for next 6 months

            const reservations = await dbHelper.find('reservation', {
                facility: facilityId,
                status: { $in: BLOCKING_RESERVATION_STATUSES, },
                $or: [
                    { dateOfArrival: { $lte: endDate, }, dateOfDeparture: { $gte: today, }, },
                ],
            });

            const unavailableDates = new Set();
            reservations.forEach((reservation) => {
                const arrivalYmd = toAppYMD(reservation.dateOfArrival);
                const departureYmd = toAppYMD(reservation.dateOfDeparture);
                if (!arrivalYmd || !departureYmd) return;

                const arrival = fromAppYMD(arrivalYmd);
                const checkout = fromAppYMD(departureYmd);
                if (!arrival || !checkout) return;
                if (arrival >= checkout) return;

                for (let cur = new Date(arrival); cur < checkout; cur = addAppDays(cur, 1)) {
                    const ymd = toAppYMD(cur);
                    if (ymd) unavailableDates.add(ymd);
                }
            });

            const availableDates = [];
            for (let currentDate = new Date(today); currentDate <= endDate; currentDate = addAppDays(currentDate, 1)) {
                const dateString = toAppYMD(currentDate);
                if (dateString && !unavailableDates.has(dateString)) {
                    availableDates.push(dateString);
                }
            }

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.availableDates = availableDates;

        } catch (error) {
            console.error('Error fetching available dates:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error fetching available dates';
        }
        return responseData;
    },

    /**
     * Searches facilities with optional filters, excluding those that have overlapping reservations.
     * @param {Object} dbHelper - Database helper.
     * @param {Object} options - {type, query, minPrice, maxPrice, capacity, checkInDate, checkOutDate, includeUnavailable}
     * @returns {Object} Response data with status, error, and facilities on success.
     */
    searchFacilities: async (dbHelper, options = {}) => {
        const { type, query, minPrice, maxPrice, capacity, checkInDate, checkOutDate, includeUnavailable } = options;
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error searching facilities',
            facilities: [],
        };

        try {
            let filter = {};
            if (type) filter.facilityType = type.trim();
            if (query) filter.name = new RegExp(query.trim(), 'i');
            if (capacity) filter.capacity = { $gte: Number(capacity), };
            if (includeUnavailable !== 'true' && includeUnavailable !== true) {
                filter.status = { $ne: FacilityStatus.UNAVAILABLE };
            }

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
                    obj.images = await getSignedReadUrls(Array.isArray(obj.images) ? obj.images : []);
                    return obj;
                })
            );

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.facilities = withSigned;
        } catch (error) {
            console.error('Error searching facilities:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error searching facilities';
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

function isValidImages(files) {
    const allowed = ['image/jpeg', 'image/png', 'image/heic', ];
    const max = 25 * 1024 * 1024; // 25MB
    for (const f of files) {
        if (!allowed.includes(f.mimetype))
            return 'Invalid image type. Only JPEG, HEIC, and PNG are allowed';
        if (f.size > max)
            return 'Image size exceeds the 25MB limit';
    }
    return null;
}

async function uploadImagesAndGetKeys(files) {
    const keys = [];
    for (const file of files) {
        const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}_${file.originalname.replace(/\s/g, '_')}`;
        const key = (((process.env.FACILITY_IMAGE_PREFIX || 'facility_images/').replace(/(^\/+|\/+$)/g, '') + '/') + filename);
        const blob = bucket.file(key);
        await new Promise((resolve, reject) => {
            const stream = blob.createWriteStream({ resumable: false, contentType: file.mimetype, });
            stream.on('error', reject);
            stream.on('finish', resolve);
            stream.end(file.buffer);
        });
        keys.push(key);
    }
    return keys;
}

async function getSignedReadUrls(keys, expiresInMs = 60 * 60 * 1000) {
    const urls = [];
    for (const key of keys) {
        const [url,] = await bucket.file(key).getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + expiresInMs,
        });
        urls.push(url);
    }
    return urls;
}

async function deleteImages(keys) {
    for (const key of keys) {
        try {
            await bucket.file(key).delete();
        } catch {
        /* ignore */
        }
    }
}

function clampLimit(value, def = undefined) {
    if (value === null || value === undefined || value === '') return def;
    const n = Number(value);
    if (!Number.isFinite(n)) return def;
    return Math.max(1, Math.min(100, Math.trunc(n)));
}

function clampSkip(value, def = 0) {
    if (value === null || value === undefined || value === '') return def;
    const n = Number(value);
    if (!Number.isFinite(n)) return def;
    return Math.max(0, Math.trunc(n));
}

function parseSort(spec) {
    if (!spec || typeof spec !== 'string') return undefined;
    const parts = spec.split(',');
    const sort = {};
    for (const p of parts) {
        const [fieldRaw, dirRaw,] = p.split(':');
        const field = (fieldRaw || '').trim();
        if (!field) continue;
        const dir = (dirRaw || 'asc').trim().toLowerCase();
        sort[field] = (dir === 'desc' || dir === '-1') ? -1 : 1;
    }
    return Object.keys(sort).length ? sort : undefined;
}

function toAppYMD(date) {
    if (!date) return null;
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return null;
    const shifted = new Date(d.getTime() + APP_TZ_OFFSET_MINUTES * 60 * 1000);
    const yyyy = shifted.getUTCFullYear();
    const mm = String(shifted.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(shifted.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function fromAppYMD(ymd) {
    if (!ymd) return null;
    const date = new Date(`${ymd}T00:00:00${APP_TZ_OFFSET}`);
    return Number.isNaN(date.getTime()) ? null : date;
}

function addAppDays(date, days = 1) {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
}

function calculateAverageRatings(reviews) {
    if (!reviews || reviews.length === 0) {
        return {
            location: 0,
            service: 0,
            cleanliness: 0,
            overall: 0
        };
    }

    const totals = reviews.reduce((acc, review) => {
        acc.location += review.rating.location;
        acc.service += review.rating.service;
        acc.cleanliness += review.rating.cleanliness;
        acc.overall += review.rating.overall;
        return acc;
    }, { location: 0, service: 0, cleanliness: 0, overall: 0 });

    const count = reviews.length;
    return {
        location: Math.round((totals.location / count) * 10) / 10,
        service: Math.round((totals.service / count) * 10) / 10,
        cleanliness: Math.round((totals.cleanliness / count) * 10) / 10,
        overall: Math.round((totals.overall / count) * 10) / 10
    };
}
