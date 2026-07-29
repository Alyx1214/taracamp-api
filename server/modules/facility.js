import { Storage, } from '@google-cloud/storage';
import { Status, FacilityType, FacilityStatus, UserRole, ReservationStatus, getAvailabilityBlockingStatuses, } from '../constants.js';
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

const validationCache = new Map();
const CACHE_TTL = 1 * 60 * 1000; // 1 minute

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
            const { name, facilityType, capacity, ratePerPerson, price, status, baseRate, rate, discountRate, ratePerExcessCapacity, discountedFacilityRate, ratePerExcessWithBeddings, ratePerExcessWithoutBeddings } = data;

            const validationResult = validateFacilityInput(data, user);
            if (validationResult.error) {
                responseData.status = validationResult.status;
                responseData.error = validationResult.error;
                return responseData;
            }

            if (!files || !Array.isArray(files) || files.length === 0) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'At least one image is required';
                return responseData;
            }

            // Check for duplicate facility BEFORE uploading images
            let existing;
            try {
                existing = await dbHelper.findOne('facility', { 
                    name: toTitleCase(String(name || '')), 
                    facilityType 
                });
            } catch (dbError) {
                console.error('Database error checking for duplicate facility:', dbError);
                responseData.status = Status.INTERNAL_SERVER_ERROR;
                responseData.error = 'Error checking for duplicate facility';
                return responseData;
            }

            if (existing) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Facility already exists';
                return responseData;
            }

            // Only upload images after confirming no duplicate exists
            const imageResult = await processImages(files);

            if (imageResult.error) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = imageResult.error;
                return responseData;
            }

            const facilityData = {
                name: toTitleCase(String(name || '')),
                facilityType,
                status,
                capacity: parseInt(String(capacity).replace(/,/g, ''), 10),
                images: imageResult.keys,
            };

            if (facilityType === FacilityType.CONFERENCE || facilityType === FacilityType.COTTAGE) {
                // Facility Rate (Inclusive of 10% Service Fee) - use baseRate if provided, otherwise fall back to price
                facilityData.price = isPresent(baseRate) 
                    ? Number(String(baseRate).replace(/,/g, '')) || 0
                    : (isPresent(price) ? Number(String(price).replace(/,/g, '')) || 0 : 0);
                
                // Rate per Excess Capacity - always set the field, default to 0 if not provided
                const excessRate = isPresent(rate) ? rate : (isPresent(ratePerExcessCapacity) ? ratePerExcessCapacity : null);
                facilityData.ratePerExcessCapacity = excessRate !== null && excessRate !== undefined
                    ? (Number(String(excessRate).replace(/,/g, '')) || 0)
                    : 0;
                
                // Discounted Facility Rate - always set the field, default to 0 if not provided
                const discountRateValue = isPresent(discountRate) ? discountRate : (isPresent(discountedFacilityRate) ? discountedFacilityRate : null);
                facilityData.discountedFacilityRate = discountRateValue !== null && discountRateValue !== undefined
                    ? (Number(String(discountRateValue).replace(/,/g, '')) || 0)
                    : 0;
                
                // Rate per Excess with Beddings - only for Cottage, default to 0 if not provided
                if (facilityType === FacilityType.COTTAGE) {
                    facilityData.ratePerExcessWithBeddings = isPresent(ratePerExcessWithBeddings)
                        ? (Number(String(ratePerExcessWithBeddings).replace(/,/g, '')) || 0)
                        : 0;
                    
                    // Rate per Excess without Beddings - only for Cottage, default to 0 if not provided
                    facilityData.ratePerExcessWithoutBeddings = isPresent(ratePerExcessWithoutBeddings)
                        ? (Number(String(ratePerExcessWithoutBeddings).replace(/,/g, '')) || 0)
                        : 0;
                }
            }
            if (facilityType === FacilityType.DORMITORY) {
                facilityData.ratePerPerson = Number(String(ratePerPerson).replace(/,/g, '')) || 0;
            }

            const [facility] = await Promise.all([
                createFacilityWithTransaction(dbHelper, facilityData),
                invalidateFacilitiesCache()
            ]);

            responseData.status = Status.CREATED;
            responseData.error = null;
            responseData.message = 'Facility added successfully';
            responseData.data = {
                facilityId: facility._id.toString(),
                name: facilityData.name,
                facilityType: facilityData.facilityType,
                capacity: facilityData.capacity,
                status: facilityData.status,
                imageUrls: imageResult.urls,
                imageCount: imageResult.urls.length
            };

        } catch (error) {
            console.error('Error adding facility:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error adding facility';
        }
        return responseData;
    },

    /**
     * Fetches all facilities with optimized performance.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {Object} options - Query options including includeUnavailable flag
     * @returns {Object} Response data with status, error, and facilities on success.
     */
    getAllFacilities: async (dbHelper, options = {}) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error fetching facilities',
            facilities: [],
            pagination: {},
        };
        try {
            const { limit, skip, sort, includeUnavailable } = options || {};
            const sortOption = sort ? parseSort(sort) : { name: 1, };
            const limitValue = clampLimit(limit);
            const skipValue = clampSkip(skip);
            
            let filter = {};
            if (includeUnavailable !== 'true' && includeUnavailable !== true) {
                filter.status = { $ne: FacilityStatus.UNAVAILABLE };
            }
            
            const totalCount = await dbHelper.count('facility', filter);
            
            const facilities = await dbHelper.findMany('facility', filter, {
                projection: { 
                    __v: 0, 
                    createdAt: 0,
                    updatedAt: 0,
                },
                sort: sortOption,
                limit: limitValue,
                skip: skipValue,
            });

            const allImageKeys = [];
            const facilityImageMap = new Map();
            
            facilities.forEach((facility, index) => {
                const images = Array.isArray(facility.images) ? facility.images : [];
                if (images.length > 0) {
                    facilityImageMap.set(index, images);
                    allImageKeys.push(...images);
                }
            });

            const allSignedUrls = allImageKeys.length > 0 
                ? await getSignedReadUrlsBatch(allImageKeys) 
                : [];
            let urlIndex = 0;
            const withSigned = facilities.map((facility, index) => {
                const obj = facility.toObject ? facility.toObject() : facility;
                obj.name = toTitleCase(String(obj.name || ''));
                
                const facilityImages = facilityImageMap.get(index);
                if (facilityImages && facilityImages.length > 0) {
                    obj.images = allSignedUrls.slice(urlIndex, urlIndex + facilityImages.length);
                    urlIndex += facilityImages.length;
                } else {
                    obj.images = [];
                }
                
                return obj;
            });

            const totalPages = Math.ceil(totalCount / limitValue);
            const currentPage = Math.floor(skipValue / limitValue) + 1;
            const hasNextPage = currentPage < totalPages;
            const hasPrevPage = currentPage > 1;

            const paginationData = {
                totalCount,
                totalPages,
                currentPage,
                limit: limitValue,
                skip: skipValue,
                hasNextPage,
                hasPrevPage,
            };

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.facilities = withSigned;
            responseData.pagination = paginationData;
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
            // Populate reservationId in room assignments
            const facility = await dbHelper.findOne('facility', { _id: id, });
            if (!facility) {
                responseData.status = Status.NOT_FOUND;
                responseData.error = 'Facility not found';
                return responseData;
            }

            // Populate reservationId in assignments if rooms exist
            if (facility.rooms && Array.isArray(facility.rooms)) {
                for (let i = 0; i < facility.rooms.length; i++) {
                    const room = facility.rooms[i];
                    if (room.assignments && Array.isArray(room.assignments)) {
                        for (let j = 0; j < room.assignments.length; j++) {
                            if (room.assignments[j].reservationId) {
                                try {
                                    const reservation = await dbHelper.findOne('reservation', { _id: room.assignments[j].reservationId });
                                    if (reservation) {
                                        facility.rooms[i].assignments[j].reservationId = reservation;
                                    }
                                } catch (err) {
                                    console.warn('Error populating reservation in room assignment:', err);
                                }
                            }
                        }
                    }
                }
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
                 facility.facilityType === FacilityType.CONFERENCE || facility.facilityType === FacilityType.COTTAGE)
            ) {
                // Handle Facility Rate (baseRate or price for backward compatibility)
                if (isPresent(data.baseRate)) {
                    const baseRateNum = Number(String(data.baseRate).replace(/,/g, ''));
                    if (!isValidRate(baseRateNum)) {
                        responseData.status = Status.BAD_REQUEST;
                        responseData.error = 'Invalid facility rate for conference/cottage facility';
                        return responseData;
                    }
                    updateData.price = baseRateNum;
                } else if (isPresent(data.price)) {
                    const priceNum = Number(String(data.price).replace(/,/g, ''));
                    if (!isValidRate(priceNum)) {
                        responseData.status = Status.BAD_REQUEST;
                        responseData.error = 'Invalid price for conference/cottage facility';
                        return responseData;
                    }
                    updateData.price = priceNum;
                }
                
                // Handle Rate per Excess Capacity
                if (isPresent(data.rate)) {
                    const rateNum = Number(String(data.rate).replace(/,/g, ''));
                    if (!isValidRate(rateNum)) {
                        responseData.status = Status.BAD_REQUEST;
                        responseData.error = 'Invalid rate per excess capacity';
                        return responseData;
                    }
                    updateData.ratePerExcessCapacity = rateNum;
                } else if (isPresent(data.ratePerExcessCapacity)) {
                    const rateNum = Number(String(data.ratePerExcessCapacity).replace(/,/g, ''));
                    if (!isValidRate(rateNum)) {
                        responseData.status = Status.BAD_REQUEST;
                        responseData.error = 'Invalid rate per excess capacity';
                        return responseData;
                    }
                    updateData.ratePerExcessCapacity = rateNum;
                }
                
                // Handle Discounted Facility Rate
                if (isPresent(data.discountRate)) {
                    const discountNum = Number(String(data.discountRate).replace(/,/g, ''));
                    if (!isValidRate(discountNum)) {
                        responseData.status = Status.BAD_REQUEST;
                        responseData.error = 'Invalid discounted facility rate';
                        return responseData;
                    }
                    updateData.discountedFacilityRate = discountNum;
                } else if (isPresent(data.discountedFacilityRate)) {
                    const discountNum = Number(String(data.discountedFacilityRate).replace(/,/g, ''));
                    if (!isValidRate(discountNum)) {
                        responseData.status = Status.BAD_REQUEST;
                        responseData.error = 'Invalid discounted facility rate';
                        return responseData;
                    }
                    updateData.discountedFacilityRate = discountNum;
                }
                
                // Handle Rate per Excess with Beddings (Cottage only)
                if (facility.facilityType === FacilityType.COTTAGE || data.facilityType === FacilityType.COTTAGE) {
                    if (isPresent(data.ratePerExcessWithBeddings)) {
                        const rateNum = Number(String(data.ratePerExcessWithBeddings).replace(/,/g, ''));
                        if (!isValidRate(rateNum)) {
                            responseData.status = Status.BAD_REQUEST;
                            responseData.error = 'Invalid rate per excess with beddings';
                            return responseData;
                        }
                        updateData.ratePerExcessWithBeddings = rateNum;
                    }
                    
                    // Handle Rate per Excess without Beddings (Cottage only)
                    if (isPresent(data.ratePerExcessWithoutBeddings)) {
                        const rateNum = Number(String(data.ratePerExcessWithoutBeddings).replace(/,/g, ''));
                        if (!isValidRate(rateNum)) {
                            responseData.status = Status.BAD_REQUEST;
                            responseData.error = 'Invalid rate per excess without beddings';
                            return responseData;
                        }
                        updateData.ratePerExcessWithoutBeddings = rateNum;
                    }
                }
                
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

            await invalidateFacilitiesCache();
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

            // Find all reservations associated with this facility
            const associatedReservations = await dbHelper.find('reservation', { facility: id, });
            
            // Delete all associated reservations and their files
            if (associatedReservations && associatedReservations.length > 0) {
                for (const reservation of associatedReservations) {
                    // Delete all files associated with this reservation
                    const files = await dbHelper.find('file', { reservationId: reservation._id, });
                    let deletedCount = 0;
                    let failedCount = 0;
                    for (const file of files) {
                        try {
                            await bucket.file(file.path).delete();
                            deletedCount++;
                        } catch (err) {
                            // If file doesn't exist (404), that's okay - it may have been deleted already
                            if (err.code === 404) {
                                console.log(`File not found in bucket (already deleted?): ${file.path}`);
                                deletedCount++;
                            } else {
                                console.warn('Failed to delete file in bucket:', file.path, err.message);
                                failedCount++;
                            }
                        }
                    }
                    if (files.length > 0) {
                        console.log(`File deletion summary for reservation ${reservation._id}: ${deletedCount} deleted, ${failedCount} failed out of ${files.length} total`);
                    }
                    // Delete file records from database
                    await dbHelper.deleteMany('file', { reservationId: reservation._id, });
                    
                    // Delete all notifications associated with this reservation
                    await dbHelper.deleteMany('notification', { reservationId: reservation._id, });
                }
                // Delete all associated reservations
                await dbHelper.deleteMany('reservation', { facility: id, });
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
            if (associatedReservations && associatedReservations.length > 0) {
                responseData.message += `. ${associatedReservations.length} associated reservation(s) also deleted.`;
            }
            responseData.facilityId = id;
            responseData.deletedReservationsCount = associatedReservations?.length || 0;

            await invalidateFacilitiesCache();
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
     * Fetches all unavailable dates for a given facility.
     * Returns dates that are either in the past or have blocking reservations (pending, approved, confirmed, checked-in).
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {string} facilityId - The ID of the facility to check availability for.
     * @returns {Object} Response data with status, error, and an array of unavailable dates on success.
     */
    getUnavailableDatesByFacility: async (dbHelper, facilityId) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error fetching unavailable dates',
            unavailableDates: [],
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

            const todayYmd = toAppYMD(new Date());
            const today = fromAppYMD(todayYmd) || new Date();
            const endDate = new Date(today);
            endDate.setUTCMonth(endDate.getUTCMonth() + 6);

            // Get blocking reservations - facilities are unavailable if reservation is CONFIRMED or CHECKED_IN
            const reservations = await dbHelper.find('reservation', {
                facility: facilityId,
                status: { $in: getAvailabilityBlockingStatuses() },
                dateOfArrival: { $lte: endDate, },
                dateOfDeparture: { $gte: today, },
            });

            const unavailableDatesSet = new Set();
            const todayYmdStr = toAppYMD(today);
            const endDateYmdStr = toAppYMD(endDate);

            // For Dormitory facilities, mark dates as unavailable based on room assignments
            // For other facilities (Cottage, Conference), mark all reservation dates as unavailable
            if (facility.facilityType === FacilityType.DORMITORY) {
                // Get all rooms with their assignments
                const rooms = Array.isArray(facility.rooms) ? facility.rooms : [];
                
                // Track total guests per date from all reservations
                const totalGuestsByDate = new Map();
                
                reservations.forEach((reservation) => {
                    const totalGuests = reservation.numberOfGuests?.total || 0;
                    if (totalGuests <= 0) return;
                    
                    let arrivalYmd = null;
                    let departureYmd = null;
                    
                    if (reservation.dateOfArrival) {
                        const arrivalDate = reservation.dateOfArrival instanceof Date 
                            ? reservation.dateOfArrival 
                            : new Date(reservation.dateOfArrival);
                        const arrivalStr = arrivalDate.toISOString();
                        const arrivalMatch = arrivalStr.match(/^(\d{4}-\d{2}-\d{2})/);
                        if (arrivalMatch) {
                            arrivalYmd = arrivalMatch[1];
                        } else {
                            arrivalYmd = toAppYMD(reservation.dateOfArrival);
                        }
                    }
                    
                    if (reservation.dateOfDeparture) {
                        const departureDate = reservation.dateOfDeparture instanceof Date 
                            ? reservation.dateOfDeparture 
                            : new Date(reservation.dateOfDeparture);
                        const departureStr = departureDate.toISOString();
                        const departureMatch = departureStr.match(/^(\d{4}-\d{2}-\d{2})/);
                        if (departureMatch) {
                            departureYmd = departureMatch[1];
                        } else {
                            departureYmd = toAppYMD(reservation.dateOfDeparture);
                        }
                    }
                    
                    if (!arrivalYmd || !departureYmd || arrivalYmd >= departureYmd) return;
                    
                    const [arrYear, arrMonth, arrDay] = arrivalYmd.split('-').map(Number);
                    const [depYear, depMonth, depDay] = departureYmd.split('-').map(Number);
                    if (!arrYear || !arrMonth || !arrDay || !depYear || !depMonth || !depDay) return;
                    
                    let currentYear = arrYear;
                    let currentMonth = arrMonth;
                    let currentDay = arrDay;
                    
                    while (true) {
                        const currentYmd = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
                        
                        // Only track dates from today onwards and within 6-month window
                        if (currentYmd >= todayYmdStr && currentYmd <= endDateYmdStr) {
                            // Sum up total guests for this date
                            const currentGuests = totalGuestsByDate.get(currentYmd) || 0;
                            totalGuestsByDate.set(currentYmd, currentGuests + totalGuests);
                        }
                        
                        if (currentYmd >= departureYmd) break;
                        
                        const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
                        currentDay++;
                        if (currentDay > daysInMonth) {
                            currentDay = 1;
                            currentMonth++;
                            if (currentMonth > 12) {
                                currentMonth = 1;
                                currentYear++;
                            }
                        }
                    }
                });
                
                // For each date, calculate available capacity based on room assignments
                // Mark dates as unavailable if total guests >= available capacity
                totalGuestsByDate.forEach((totalGuests, dateYmd) => {
                    // Convert date string to Date object for comparison
                    const [year, month, day] = dateYmd.split('-').map(Number);
                    if (!year || !month || !day) return;
                    const currentDate = new Date(Date.UTC(year, month - 1, day));
                    
                    // Calculate available capacity for this date
                    let availableCapacity = 0;
                    rooms.forEach(room => {
                        if (!room || Number(room.capacity) <= 0) return;
                        if (room.status !== 'Available') return;

                        // Check if room has any assignment that overlaps with this date
                        const hasOverlappingAssignment = Array.isArray(room.assignments) && 
                            room.assignments.some(assignment => {
                                if (!assignment.reservationId || !assignment.startDate || !assignment.endDate) {
                                    return false;
                                }

                                // Parse assignment dates - they should be in YYYY-MM-DD format
                                let assignmentStart, assignmentEnd;
                                if (typeof assignment.startDate === 'string') {
                                    assignmentStart = fromAppYMD(assignment.startDate) || new Date(assignment.startDate + 'T00:00:00Z');
                                } else {
                                    assignmentStart = assignment.startDate instanceof Date ? assignment.startDate : new Date(assignment.startDate);
                                }
                                
                                if (typeof assignment.endDate === 'string') {
                                    assignmentEnd = fromAppYMD(assignment.endDate) || new Date(assignment.endDate + 'T00:00:00Z');
                                } else {
                                    assignmentEnd = assignment.endDate instanceof Date ? assignment.endDate : new Date(assignment.endDate);
                                }

                                if (isNaN(assignmentStart.getTime()) || isNaN(assignmentEnd.getTime())) return false;

                                // Normalize dates to UTC midnight for comparison
                                assignmentStart.setUTCHours(0, 0, 0, 0);
                                assignmentEnd.setUTCHours(0, 0, 0, 0);
                                currentDate.setUTCHours(0, 0, 0, 0);

                                // Check if current date falls within assignment date range
                                // Note: endDate is exclusive (check-in date), so we use < instead of <=
                                return currentDate >= assignmentStart && currentDate < assignmentEnd;
                            });

                        // Room is available if no overlapping assignment
                        if (!hasOverlappingAssignment) {
                            availableCapacity += Number(room.capacity) || 0;
                        }
                    });
                    
                    // Mark as unavailable if:
                    // 1. There are available rooms but not enough capacity (totalGuests >= availableCapacity)
                    // 2. There are no available rooms but there are reservations (availableCapacity === 0 && totalGuests > 0)
                    if ((availableCapacity > 0 && totalGuests >= availableCapacity) || 
                        (availableCapacity === 0 && totalGuests > 0)) {
                        unavailableDatesSet.add(dateYmd);
                    }
                });
            } else {
                // For non-dormitory facilities (Cottage, Conference), mark all reservation dates as unavailable
                reservations.forEach((reservation) => {
                    let arrivalYmd = null;
                    let departureYmd = null;
                    
                    if (reservation.dateOfArrival) {
                        const arrivalDate = reservation.dateOfArrival instanceof Date 
                            ? reservation.dateOfArrival 
                            : new Date(reservation.dateOfArrival);
                        const arrivalStr = arrivalDate.toISOString();
                        const arrivalMatch = arrivalStr.match(/^(\d{4}-\d{2}-\d{2})/);
                        if (arrivalMatch) {
                            arrivalYmd = arrivalMatch[1];
                        } else {
                            arrivalYmd = toAppYMD(reservation.dateOfArrival);
                        }
                    }
                    
                    if (reservation.dateOfDeparture) {
                        const departureDate = reservation.dateOfDeparture instanceof Date 
                            ? reservation.dateOfDeparture 
                            : new Date(reservation.dateOfDeparture);
                        const departureStr = departureDate.toISOString();
                        const departureMatch = departureStr.match(/^(\d{4}-\d{2}-\d{2})/);
                        if (departureMatch) {
                            departureYmd = departureMatch[1];
                        } else {
                            departureYmd = toAppYMD(reservation.dateOfDeparture);
                        }
                    }
                    
                    if (!arrivalYmd || !departureYmd || arrivalYmd >= departureYmd) return;
                    
                    const [arrYear, arrMonth, arrDay] = arrivalYmd.split('-').map(Number);
                    const [depYear, depMonth, depDay] = departureYmd.split('-').map(Number);
                    if (!arrYear || !arrMonth || !arrDay || !depYear || !depMonth || !depDay) return;
                    
                    let currentYear = arrYear;
                    let currentMonth = arrMonth;
                    let currentDay = arrDay;
                    
                    while (true) {
                        const currentYmd = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
                        // Only include dates from today onwards and within 6-month window
                        if (currentYmd >= todayYmdStr && currentYmd <= endDateYmdStr) {
                            unavailableDatesSet.add(currentYmd);
                        }
                        if (currentYmd >= departureYmd) break;
                        
                        const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
                        currentDay++;
                        if (currentDay > daysInMonth) {
                            currentDay = 1;
                            currentMonth++;
                            if (currentMonth > 12) {
                                currentMonth = 1;
                                currentYear++;
                            }
                        }
                    }
                });
            }

            // Convert set to sorted array and filter to only include dates from today onwards within 6-month window
            const unavailableDates = Array.from(unavailableDatesSet)
                .filter(dateYmd => dateYmd >= todayYmdStr && dateYmd <= endDateYmdStr)
                .sort();

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.unavailableDates = unavailableDates;

        } catch (error) {
            console.error('Error fetching unavailable dates:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error fetching unavailable dates';
        }
        return responseData;
    },

    /**
     * Searches facilities with optional filters, excluding those that have overlapping reservations.
     * @param {Object} dbHelper - Database helper.
     * @param {Object} options - {type, query, minPrice, maxPrice, capacity, maxCapacity, checkInDate, checkOutDate, includeUnavailable}
     * @returns {Object} Response data with status, error, and facilities on success.
     */
    searchFacilities: async (dbHelper, options = {}) => {
        const { type, query, minPrice, maxPrice, capacity, maxCapacity, checkInDate, checkOutDate, includeUnavailable } = options;
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error searching facilities',
            facilities: [],
        };

        try {
            let filter = {};
            if (type) filter.facilityType = type.trim();
            if (query) filter.name = new RegExp(query.trim(), 'i');
            if (capacity || maxCapacity) {
                filter.capacity = {};
                if (capacity) filter.capacity.$gte = Number(capacity);
                if (maxCapacity) filter.capacity.$lte = Number(maxCapacity);
            }
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

    /**
     * Updates room configurations for a facility.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {string} id - The ID of the facility to be updated.
     * @param {Object} data - The data object containing room configurations.
     * @param {Object} user - The user object containing the user ID and role.
     * @returns {Object} Response data with status, error, and message.
     */
    updateRooms: async (dbHelper, id, data, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error updating rooms',
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

            // Allow Frontdesk, CRMS team, and Superintendent to update rooms
            if (user.role !== UserRole.CRMSTEAM && user.role !== UserRole.SUPERINTENDENT && user.role !== UserRole.FRONTDESK) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'Only CRMS team, Superintendent, and Frontdesk can update rooms';
                return responseData;
            }

            const facility = await dbHelper.findOne('facility', { _id: id });
            if (!facility) {
                responseData.status = Status.NOT_FOUND;
                responseData.error = 'Facility not found';
                return responseData;
            }

            // Check if data contains rooms array (new format) or individual room fields (old format)
            let rooms = [];
            
            if (Array.isArray(data.rooms)) {
                // New format: rooms array with assignments
                rooms = data.rooms.map(room => {
                    const roomData = {
                        name: String(room.name || '').trim(),
                        capacity: parseInt(String(room.capacity || 0).replace(/,/g, ''), 10),
                    };
                    
                    // Add status if provided
                    if (isPresent(room.status)) {
                        const statusValue = String(room.status).trim();
                        if (!isValidFacilityStatus(statusValue)) {
                            throw new Error(`Invalid status value: ${statusValue}. Status must be either "Available" or "Unavailable".`);
                        }
                        roomData.status = statusValue;
                    } else {
                        roomData.status = 'Available'; // Default status
                    }
                    
                    // Add assignments array if provided (new structure)
                    // Always set assignments array, even if empty, to ensure proper updates
                    if (Array.isArray(room.assignments)) {
                        roomData.assignments = room.assignments
                            .filter(assignment => assignment.reservationId && assignment.startDate && assignment.endDate)
                            .map(assignment => ({
                                reservationId: assignment.reservationId,
                                guestsAssigned: parseInt(assignment.guestsAssigned || 0),
                                startDate: assignment.startDate,
                                endDate: assignment.endDate,
                            }));
                    } else {
                        // If assignments is not an array, set it to empty array
                        roomData.assignments = [];
                    }
                    
                    // Legacy support: Add assignedTo if provided (old structure)
                    if (isPresent(room.assignedTo)) {
                        roomData.assignedTo = room.assignedTo;
                    }
                    // Legacy support: Add assignedGuests if provided (old structure)
                    if (room.assignedGuests !== undefined && room.assignedGuests !== null) {
                        const guests = parseInt(String(room.assignedGuests).replace(/,/g, ''), 10);
                        if (!Number.isNaN(guests) && guests >= 0) {
                            roomData.assignedGuests = guests;
                        }
                    }
                    
                    return roomData;
                }).filter(room => room.name && room.capacity > 0);
            } else {
                // Old format: individual room fields
                const { capacity, name, status, assignedTo, assignedGuests, extraRows } = data;
                
                // Add main room configuration if provided
                if (isPresent(name) && isPresent(capacity)) {
                    const cap = parseInt(String(capacity).replace(/,/g, ''), 10);
                    if (cap > 0) {
                        const mainRoom = { 
                            name: String(name).trim(),
                            capacity: cap
                        };
                        // Add status if provided and validate it
                        if (isPresent(status)) {
                            const statusValue = String(status).trim();
                            if (!isValidFacilityStatus(statusValue)) {
                                responseData.status = Status.BAD_REQUEST;
                                responseData.error = `Invalid status value: ${statusValue}. Status must be either "Available" or "Unavailable".`;
                                return responseData;
                            }
                            mainRoom.status = statusValue;
                        }
                        // Add assignedTo if provided (reservation ID)
                        if (isPresent(assignedTo)) {
                            mainRoom.assignedTo = assignedTo;
                        }
                        // Add assignedGuests if provided (number of guests assigned to this room)
                        if (assignedGuests !== undefined && assignedGuests !== null) {
                            const guests = parseInt(String(assignedGuests).replace(/,/g, ''), 10);
                            if (!Number.isNaN(guests) && guests >= 0) {
                                mainRoom.assignedGuests = guests;
                            }
                        }
                        rooms.push(mainRoom);
                    }
                }

                // Add extra room configurations
                if (Array.isArray(extraRows)) {
                    for (const row of extraRows) {
                        if (row && isPresent(row.name) && isPresent(row.capacity)) {
                            const cap = parseInt(String(row.capacity).replace(/,/g, ''), 10);
                            if (cap > 0) {
                                const extraRoom = { 
                                    name: String(row.name).trim(),
                                    capacity: cap
                                };
                                // Add status if provided and validate it
                                if (isPresent(row.status)) {
                                    const statusValue = String(row.status).trim();
                                    if (!isValidFacilityStatus(statusValue)) {
                                        responseData.status = Status.BAD_REQUEST;
                                        responseData.error = `Invalid status value: ${statusValue}. Status must be either "Available" or "Unavailable".`;
                                        return responseData;
                                    }
                                    extraRoom.status = statusValue;
                                }
                                // Add assignedTo if provided (reservation ID)
                                if (isPresent(row.assignedTo)) {
                                    extraRoom.assignedTo = row.assignedTo;
                                }
                                // Add assignedGuests if provided (number of guests assigned to this room)
                                if (row.assignedGuests !== undefined && row.assignedGuests !== null) {
                                    const guests = parseInt(String(row.assignedGuests).replace(/,/g, ''), 10);
                                    if (!Number.isNaN(guests) && guests >= 0) {
                                        extraRoom.assignedGuests = guests;
                                    }
                                }
                                rooms.push(extraRoom);
                            }
                        }
                    }
                }
            }

            const updateData = { $set: { rooms } };

            await Promise.all([
                dbHelper.updateOne('facility', { _id: id }, updateData),
                invalidateFacilitiesCache()
            ]);

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = 'Rooms updated successfully';
            responseData.data = { rooms };

        } catch (error) {
            console.error('Error updating rooms:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error updating rooms';
        }

        return responseData;
    },

    /**
     * Gets room-level availability information for a facility.
     * Returns per-room availability dates and assignment information.
     * @param {Object} dbHelper - Database helper.
     * @param {string} facilityId - The facility ID.
     * @returns {Object} Response data with status, error, and rooms availability data.
     */
    getRoomAvailabilityByFacility: async (dbHelper, facilityId) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error fetching room availability',
            rooms: [],
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

            // Only process dormitory facilities
            if (facility.facilityType !== FacilityType.DORMITORY) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Room availability is only available for dormitory facilities';
                return responseData;
            }

            if (!Array.isArray(facility.rooms) || facility.rooms.length === 0) {
                responseData.status = Status.OK;
                responseData.error = null;
                responseData.rooms = [];
                return responseData;
            }

            // Get all room assignments to check reservation statuses
            const assignedRoomIds = [];
            facility.rooms.forEach(room => {
                if (room && room.assignedTo) {
                    assignedRoomIds.push(room.assignedTo);
                }
            });

            // Fetch all assigned reservations with their details
            const assignedReservationsMap = new Map();
            if (assignedRoomIds.length > 0) {
                const assignedReservations = await dbHelper.find('reservation', {
                    _id: { $in: assignedRoomIds }
                });
                assignedReservations.forEach(res => {
                    const resId = res._id?.toString?.() || String(res._id || '');
                    assignedReservationsMap.set(resId, res);
                });
            }

            // Get all CONFIRMED reservations for this facility to calculate unavailable dates
            const todayYmd = toAppYMD(new Date());
            const today = fromAppYMD(todayYmd) || new Date();
            const endDate = new Date(today);
            endDate.setUTCMonth(endDate.getUTCMonth() + 6);

            const allReservations = await dbHelper.find('reservation', {
                facility: facilityId,
                status: ReservationStatus.CONFIRMED,
                dateOfArrival: { $lt: endDate, },
                dateOfDeparture: { $gt: today, },
            });

            // Helper function to convert Date to YYYY-MM-DD string
            const toYMDString = (date) => {
                if (!date) return null;
                const d = date instanceof Date ? date : new Date(date);
                if (isNaN(d.getTime())) return null;
                const year = d.getUTCFullYear();
                const month = String(d.getUTCMonth() + 1).padStart(2, '0');
                const day = String(d.getUTCDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };

            // Build reservation date ranges map (reservation ID -> date range)
            const reservationDateRanges = new Map();
            allReservations.forEach(reservation => {
                const resId = reservation._id?.toString?.() || String(reservation._id || '');
                const arrivalYmd = toYMDString(reservation.dateOfArrival);
                const departureYmd = toYMDString(reservation.dateOfDeparture);
                if (arrivalYmd && departureYmd && arrivalYmd < departureYmd) {
                    reservationDateRanges.set(resId, {
                        arrival: arrivalYmd,
                        departure: departureYmd,
                        totalGuests: reservation.numberOfGuests?.total || 0
                    });
                }
            });

            // Process each room
            const roomsAvailability = [];
            const todayYmdStr = toAppYMD(today);
            const endDateYmdStr = toAppYMD(endDate);

            for (const room of facility.rooms) {
                if (!room || Number(room.capacity) <= 0) continue;

                const roomId = room._id?.toString?.() || `room-${roomsAvailability.length}`;
                const assignedReservationId = room.assignedTo?.toString?.() || String(room.assignedTo || '');
                const assignedReservation = assignedReservationId ? assignedReservationsMap.get(assignedReservationId) : null;
                
                // Determine if room is available (not assigned or assigned to inactive reservation)
                const isAssignedToActiveReservation = assignedReservation && 
                    (assignedReservation.status === ReservationStatus.CONFIRMED || 
                     assignedReservation.status === ReservationStatus.CHECKED_IN);

                // Get unavailable dates for this room
                const unavailableDatesSet = new Set();
                let becomesAvailableAfter = null;
                let assignedToInfo = null;

                if (isAssignedToActiveReservation) {
                    // Room is assigned to an active reservation - get its date range
                    const assignedArrivalYmd = toYMDString(assignedReservation.dateOfArrival);
                    const assignedDepartureYmd = toYMDString(assignedReservation.dateOfDeparture);
                    
                    if (assignedArrivalYmd && assignedDepartureYmd) {
                        // Mark all dates in the reservation range as unavailable
                        let currentYmd = assignedArrivalYmd;
                        while (currentYmd && currentYmd < assignedDepartureYmd) {
                            if (currentYmd >= todayYmdStr && currentYmd <= endDateYmdStr) {
                                unavailableDatesSet.add(currentYmd);
                            }
                            
                            // Move to next day
                            const [year, month, day] = currentYmd.split('-').map(Number);
                            if (!year || !month || !day) break;
                            const nextDate = new Date(Date.UTC(year, month - 1, day + 1));
                            currentYmd = toYMDString(nextDate);
                            if (!currentYmd) break;
                        }
                        
                        becomesAvailableAfter = assignedDepartureYmd;
                    }

                    assignedToInfo = {
                        reservationId: assignedReservationId,
                        guestName: assignedReservation.guestName || 'Unknown Guest',
                        arrivalDate: assignedArrivalYmd,
                        departureDate: assignedDepartureYmd,
                        status: assignedReservation.status,
                        totalGuests: assignedReservation.numberOfGuests?.total || 0
                    };
                } else if (assignedReservation) {
                    // Room is assigned to an inactive reservation (CHECKED_OUT, CANCELLED, etc.)
                    // Room is available, but show the assignment info
                    const assignedArrivalYmd = toYMDString(assignedReservation.dateOfArrival);
                    const assignedDepartureYmd = toYMDString(assignedReservation.dateOfDeparture);
                    
                    assignedToInfo = {
                        reservationId: assignedReservationId,
                        guestName: assignedReservation.guestName || 'Unknown Guest',
                        arrivalDate: assignedArrivalYmd,
                        departureDate: assignedDepartureYmd,
                        status: assignedReservation.status,
                        totalGuests: assignedReservation.numberOfGuests?.total || 0,
                        note: 'Room is available (reservation is ' + assignedReservation.status + ')'
                    };
                }

                // Also check other CONFIRMED reservations that might overlap
                // (for capacity-based availability, not room-specific)
                // This is already handled by the facility-level unavailable dates

                // Generate available dates (all dates in range minus unavailable dates)
                const availableDates = [];
                let currentYmd = todayYmdStr;
                while (currentYmd && currentYmd <= endDateYmdStr) {
                    if (!unavailableDatesSet.has(currentYmd)) {
                        availableDates.push(currentYmd);
                    }
                    
                    // Move to next day
                    const [year, month, day] = currentYmd.split('-').map(Number);
                    if (!year || !month || !day) break;
                    const nextDate = new Date(Date.UTC(year, month - 1, day + 1));
                    currentYmd = toYMDString(nextDate);
                    if (!currentYmd) break;
                }

                roomsAvailability.push({
                    roomId: roomId,
                    name: room.name || 'Unnamed Room',
                    capacity: Number(room.capacity) || 0,
                    status: room.status || 'Available',
                    availableDates: availableDates,
                    unavailableDates: Array.from(unavailableDatesSet).sort(),
                    assignedTo: assignedToInfo,
                    becomesAvailableAfter: becomesAvailableAfter,
                    isAvailable: !isAssignedToActiveReservation && (room.status === 'Available' || !room.assignedTo)
                });
            }

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.rooms = roomsAvailability;

        } catch (error) {
            console.error('Error fetching room availability:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error fetching room availability';
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
    const allowed = ['image/jpeg', 'image/png'];
    const max = 25 * 1024 * 1024; // 25MB
    for (const f of files) {
        if (!allowed.includes(f.mimetype))
            return 'Invalid image type. Only JPEG, and PNG are allowed';
        if (f.size > max)
            return 'Image size exceeds the 25MB limit';
    }
    return null;
}

async function uploadImagesAndGetKeys(files) {
    const keys = [];
    for (const file of files) {
        const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}_${file.originalname.replace(/\s/g, '_')}`;
        const key = 'facility_images/' + filename;
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

async function getSignedReadUrlsBatch(keys, expiresInMs = 60 * 60 * 1000) {
    const urlPromises = keys.map(key => 
        bucket.file(key).getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + expiresInMs,
        }).then(([url]) => url)
    );
    
    return await Promise.all(urlPromises);
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

async function invalidateFacilitiesCache() {
    return;
}

/**
 * Validates facility input data and user permissions with caching
 * @param {Object} data - The facility data
 * @param {Object} user - The authenticated user
 * @returns {Object} Validation result with error and status
 */
function validateFacilityInput(data, user) {
    const { name, facilityType, capacity, ratePerPerson, price, status, baseRate } = data;

    const cacheKey = `validation:${JSON.stringify({ name, facilityType, capacity, ratePerPerson, price, baseRate, status, userId: user?.userId, role: user?.role })}`;
    
    const cached = validationCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        return cached.result;
    }

    const result = performValidation(data, user);
    
    validationCache.set(cacheKey, {
        result,
        timestamp: Date.now()
    });

    if (validationCache.size > 1000) {
        cleanupValidationCache();
    }

    return result;
}

/**
 * Performs the actual validation logic
 * @param {Object} data - The facility data
 * @param {Object} user - The authenticated user
 * @returns {Object} Validation result with error and status
 */
function performValidation(data, user) {
    const { name, facilityType, capacity, ratePerPerson, price, status, baseRate } = data;

    // For Cottage/Conference, check for baseRate (Facility Rate) or price (for backward compatibility)
    const facilityRate = isPresent(baseRate) ? baseRate : price;
    
    if (
        !isPresent(name) ||
        !isPresent(facilityType) ||
        !isPresent(capacity) ||
        ((facilityType === FacilityType.CONFERENCE || facilityType === FacilityType.COTTAGE) && !isPresent(facilityRate)) ||
        (facilityType === FacilityType.DORMITORY && !isPresent(ratePerPerson))
    ) {
        return { status: Status.BAD_REQUEST, error: 'Missing required fields' };
    }

    if (!user || !user.userId) {
        return { status: Status.UNAUTHORIZED, error: 'User not logged in' };
    }

    if (user.role !== UserRole.CRMSTEAM && user.role !== UserRole.SUPERINTENDENT) {
        return { status: Status.FORBIDDEN, error: 'Only CRMS team and Superintendents can add a facility' };
    }

    if (!isValidFacilityType(facilityType)) {
        return { status: Status.BAD_REQUEST, error: 'Invalid facility type' };
    }

    if (!isValidCapacity(capacity)) {
        return { status: Status.BAD_REQUEST, error: 'Invalid or missing capacity' };
    }

    if (
        ((facilityType === FacilityType.CONFERENCE || facilityType === FacilityType.COTTAGE) && !isValidRate(facilityRate)) ||
        (facilityType === FacilityType.DORMITORY && !isValidRate(ratePerPerson))
    ) {
        return { status: Status.BAD_REQUEST, error: 'Missing or invalid rate/price for this facility type' };
    }

    if (!isValidFacilityStatus(status)) {
        return { status: Status.BAD_REQUEST, error: 'Invalid facility status' };
    }

    return { error: null };
}

/**
 * Cleans up old validation cache entries
 */
function cleanupValidationCache() {
    const now = Date.now();
    for (const [key, value] of validationCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
            validationCache.delete(key);
        }
    }
}

/**
 * Creates a facility with transaction support for atomicity
 * @param {Object} dbHelper - The database helper
 * @param {Object} facilityData - The facility data to create
 * @returns {Promise<Object>} The created facility
 */
async function createFacilityWithTransaction(dbHelper, facilityData) {
    if (dbHelper.startTransaction && dbHelper.commitTransaction && dbHelper.rollbackTransaction) {
        const session = await dbHelper.startTransaction();
        try {
            const facility = await dbHelper.create('facility', facilityData, { session });
            await dbHelper.commitTransaction(session);
            return facility;
        } catch (error) {
            await dbHelper.rollbackTransaction(session);
            throw error;
        }
    } else {
        return await dbHelper.create('facility', facilityData);
    }
}

/**
 * Processes image files with parallel upload and URL generation
 * @param {Array} files - Array of image files
 * @returns {Promise<Object>} Result with keys, urls, or error
 */
async function processImages(files) {
    if (!Array.isArray(files) || files.length === 0) {
        return { keys: [], urls: [] };
    }

    const imgErr = isValidImages(files);
    if (imgErr) {
        return { error: imgErr };
    }

    try {
        const [imageKeys, imageUrls] = await Promise.all([
            uploadImagesAndGetKeysParallel(files),
            uploadImagesAndGetKeys(files).then(keys => getSignedReadUrlsBatch(keys))
        ]);

        return { keys: imageKeys, urls: imageUrls };
    } catch (err) {
        return { error: 'Image upload failed: ' + err.message };
    }
}

/**
 * Uploads multiple images in parallel for better performance
 * @param {Array} files - Array of image files
 * @returns {Promise<Array>} Array of image keys
 */
async function uploadImagesAndGetKeysParallel(files) {
    const uploadPromises = files.map(file => uploadSingleImage(file));
    return await Promise.all(uploadPromises);
}

/**
 * Uploads a single image file
 * @param {Object} file - The image file
 * @returns {Promise<string>} The image key
 */
async function uploadSingleImage(file) {
    const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}_${file.originalname.replace(/\s/g, '_')}`;
    const key = 'facility_images/' + filename;
    const blob = bucket.file(key);
    
    await new Promise((resolve, reject) => {
        const stream = blob.createWriteStream({ 
            resumable: false, 
            contentType: file.mimetype 
        });
        stream.on('error', reject);
        stream.on('finish', resolve);
        stream.end(file.buffer);
    });
    
    return key;
}
