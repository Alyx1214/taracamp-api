import { Category, GuestType, Status, UserRole, FacilityStatus, ServiceType, ReservationStatus, FileKind, FacilityType, } from '../constants.js';
import { Storage, } from '@google-cloud/storage';
import { safeRedisOperations } from './redisCircuitBreaker.js';
import { computeEstimate } from './payment.js';
import dotenv from 'dotenv';
dotenv.config();

const storage = new Storage();
const bucket = storage.bucket(process.env.BUCKET_NAME);
const APP_TZ_OFFSET = '+08:00';
const TZ = 'Asia/Manila';

// Helper function to invalidate reservation cache
const invalidateReservationCache = async () => {
    try {
        const keys = await safeRedisOperations.keys('get_reservations_by_status:*');
        const reservationKeys = await safeRedisOperations.keys('reservation_by_id:*');
        const allKeys = [...keys, ...reservationKeys];
        if (allKeys && allKeys.length > 0) {
            await safeRedisOperations.del(...allKeys);
        }
    } catch (error) {
        console.error('Error invalidating reservation cache:', error);
        responseData.status = Status.INTERNAL_SERVER_ERROR;
        responseData.error = 'Error invalidating reservation cache: ' + error.message;
        return responseData;
    }
};

const reservationModule = {
    /**
     * Adds a reservation to the database.
     * @param {Object} dbHelper - The database helper object.
     * @param {Object} data - The reservation data.
     * @param {Object} letterOfIntentFile - The Letter of Intent file.
     * @param {Object} seniorCitizenIdFile - The Senior Citizen ID file.
     * @param {Object} user - The logged-in user.
     * @param {Object} userSocketMap - The map of user sockets.
     * @return {Promise<Object>} A promise that resolves to an object with the status, error, message, reservationId, and reservation properties.
     */
    addReservation: async (dbHelper, data, letterOfIntentFile, seniorCitizenIdFile, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error on booking reservation',
        };

        try {
            const {
                guestName, homeAddress, officeAddress, category, guestType,
                telephone, officeTelephone, numberOfAdults, numberOfChildren, numberOfPwds, numberOfSeniorCitizens,
                emergencyContact, emergencyContactPerson, dateOfArrival, dateOfDeparture, facility,
                serviceType, timeOfArrival, addOns, otherRequests, guestEmail, numberOfRooms,
            } = data;

            if (
                !isPresent(guestName) ||
                !isPresent(homeAddress) ||
                !isPresent(category) ||
                !isPresent(telephone) ||
                !isPresent(numberOfAdults) ||
                !isPresent(emergencyContact) ||
                !isPresent(dateOfArrival) ||
                !isPresent(dateOfDeparture) ||
                !isPresent(timeOfArrival) ||
                !isPresent(facility) ||
                !isPresent(serviceType)
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

            const creatingForGuest = typeof guestEmail === 'string' && guestEmail.trim().length > 0;
            if (creatingForGuest) {
                if (user.role === UserRole.GUEST) {
                    responseData.status = Status.FORBIDDEN;
                    responseData.error = 'Only admins/staff can create reservations with guestEmail';
                    return responseData;
                }

                if (!isValidEmail(guestEmail)) {
                    responseData.status = Status.BAD_REQUEST;
                    responseData.error = 'Invalid guest email';
                    return responseData;
                }

                const existingUser = await dbHelper.findOne('user', { email: guestEmail.trim(), });
                if (existingUser) {
                    responseData.status = Status.BAD_REQUEST;
                    responseData.error = 'Guest email belongs to an existing account';
                    return responseData;
                }
            }

            if (!letterOfIntentFile && guestType !== GuestType.INDIVIDUAL) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Missing Letter of Intent file';
                return responseData;
            } 

            const initialStatus =
                guestType === GuestType.INDIVIDUAL
                    ? ReservationStatus.APPROVED
                    : ReservationStatus.PENDING;
            
            if (!isValidPhone(telephone)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid phone number';
                return responseData;
            }

            if (!isValidPhone(emergencyContact)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid emergency contact number';
                return responseData;
            }

            const normalizePhone = (phone) => {
                if (!phone) return '';
                return phone.replace(/^\+63/, '').replace(/^0/, '');
            };

            if (normalizePhone(telephone) === normalizePhone(emergencyContact)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Phone number and emergency contact number must be different';
                return responseData;
            }

            if (!isValidCategory(category)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid category';
                return responseData;
            }

            if (!isValidDate(dateOfArrival) || !isValidDate(dateOfDeparture)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid date format';
                return responseData;
            }

            if (!isValidDateRange(dateOfArrival, dateOfDeparture, user)) {
                responseData.status = Status.BAD_REQUEST;
                const errorMessage = user && user.role === UserRole.FRONTDESK 
                    ? 'Invalid date range: ensure arrival is today or later and departure is after arrival'
                    : 'Invalid date range: ensure arrival is today or later, departure is after arrival, and arrival is at least 2 months from today';
                responseData.error = errorMessage;
                return responseData;
            }

            if (!isValidTime(timeOfArrival)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid time format';
                return responseData;
            }

            if (!isValidGuestType(guestType)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid guest type';
                return responseData;
            }

            if (guestType === GuestType.INDIVIDUAL) {
                const adults = parseInt(numberOfAdults) || 0;
                const children = parseInt(numberOfChildren) || 0;
                const pwds = parseInt(numberOfPwds) || 0;
                const seniorCitizens = parseInt(numberOfSeniorCitizens) || 0;
                const total = adults + children + pwds + seniorCitizens;
                
                if (total > 50) {
                    responseData.status = Status.BAD_REQUEST;
                    responseData.error = 'Individual reservations are limited to a maximum of 50 guests. Please select "Group" type for more than 50 guests.';
                    return responseData;
                }
            }

            if (!isValidServiceType(serviceType)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid service type';
                return responseData;
            }

            if (!isValidLength((otherRequests || '').trim(), 500)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Requests must be 500 characters or less';
                return responseData;
            }

            if (letterOfIntentFile && !isValidFile(letterOfIntentFile)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid Letter of Intent file';
                return responseData;
            }

            if (
                !isNonNegativeInteger(numberOfAdults) ||
                !isNonNegativeInteger(numberOfChildren) ||
                !isNonNegativeInteger(numberOfPwds) ||
                !isNonNegativeInteger(numberOfSeniorCitizens)
            ) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Guest counts must be non-negative integers';
                return responseData;
            }

            const adults = parseInt(numberOfAdults) || 0;
            const children = parseInt(numberOfChildren) || 0;
            const pwds = parseInt(numberOfPwds) || 0;
            const seniorCitizens = parseInt(numberOfSeniorCitizens) || 0;
            const total = adults + children + pwds + seniorCitizens;

            if (total <= 0) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'At least one guest is required';
                return responseData;
            }

            const facilityDoc = await dbHelper.findOne('facility', { _id: facility, });
            if (!facilityDoc) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Selected facility does not exist';
                return responseData;
            }

            if (facilityDoc.status !== FacilityStatus.AVAILABLE) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Facility is not available for booking.';
                return responseData;
            }

            let addonIds = Array.isArray(addOns) ? addOns.filter(isValidObjectId) : [];
            let addonsTotal = 0;

            if (addonIds.length) {
                const services = await dbHelper.findMany(
                    'addon',
                    { _id: { $in: addonIds, }, },
                    { projection: { _id: 1, price: 1, }, }
                );
                const foundIds = new Set((services || []).map((s) => String(s._id)));
                const unknown = addonIds.filter((id) => !foundIds.has(String(id)));
                if (unknown.length) {
                    responseData.status = Status.BAD_REQUEST;
                    responseData.error = 'Unknown special service id(s): ' + unknown.join(', ');
                    return responseData;
                }
                addonsTotal = services.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
            }

            // Prepare file uploads and reservation data before transaction
            let loiFileDoc = null;
            let seniorCitizenIdFileDoc = null;
            
            if (letterOfIntentFile) {
                try {
                    const filename = `letter_of_intent/${Date.now()}_${letterOfIntentFile.originalname.replace(/\s/g, '_')}`;
                    const blob = bucket.file(filename);
                    await new Promise((resolve, reject) => {
                        const stream = blob.createWriteStream({
                            resumable: false,
                            contentType: letterOfIntentFile.mimetype,
                        });
                        stream.on('error', reject);
                        stream.on('finish', resolve);
                        stream.end(letterOfIntentFile.buffer);
                    });

                    try {
                        loiFileDoc = await dbHelper.create('file', {
                            path: filename,
                            mimetype: letterOfIntentFile.mimetype,
                            size: letterOfIntentFile.size,
                            kind: FileKind.LETTER_OF_INTENT,
                            userId: user.userId,
                            createdAt: new Date(),
                        });
                    } catch (createFileErr) {
                        console.error('Error creating file record for LOI:', createFileErr);
                        responseData.status = Status.INTERNAL_SERVER_ERROR;
                        responseData.error = 'Failed to create file record for Letter of Intent';
                        return responseData;
                    }
                } catch (err) {
                    responseData.status = Status.INTERNAL_SERVER_ERROR;
                    responseData.error = 'Letter of Intent upload failed: ' + err.message;
                    return responseData;
                }
            }

            if (seniorCitizens > 0 && !seniorCitizenIdFile) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Senior Citizen ID file is required when there are senior citizens in the reservation';
                return responseData;
            }
            
            if (seniorCitizenIdFile && seniorCitizens <= 0) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Senior Citizen ID file should only be uploaded when there are senior citizens in the reservation';
                return responseData;
            }
            
            if (seniorCitizenIdFile) {
                try {
                    const filename = `senior_citizen_id/${Date.now()}_${seniorCitizenIdFile.originalname.replace(/\s/g, '_')}`;
                    const blob = bucket.file(filename);
                    await new Promise((resolve, reject) => {
                        const stream = blob.createWriteStream({
                            resumable: false,
                            contentType: seniorCitizenIdFile.mimetype,
                        });
                        stream.on('error', reject);
                        stream.on('finish', resolve);
                        stream.end(seniorCitizenIdFile.buffer);
                    });

                    try {
                        seniorCitizenIdFileDoc = await dbHelper.create('file', {
                            path: filename,
                            mimetype: seniorCitizenIdFile.mimetype,
                            size: seniorCitizenIdFile.size,
                            kind: FileKind.SENIOR_CITIZEN_ID,
                            userId: user.userId,
                            createdAt: new Date(),
                        });
                    } catch (createFileErr) {
                        console.error('Error creating file record for Senior Citizen ID:', createFileErr);
                        responseData.status = Status.INTERNAL_SERVER_ERROR;
                        responseData.error = 'Failed to create file record for Senior Citizen ID';
                        return responseData;
                    }
                } catch (err) {
                    responseData.status = Status.INTERNAL_SERVER_ERROR;
                    responseData.error = 'Senior Citizen ID upload failed: ' + err.message;
                    return responseData;
                }
            }

            const { amount: totalEstimatedAmount, } = computeEstimate({
                facilityDoc,
                adults,
                children,
                pwds,
                seniorCitizens,
                serviceType,
                addonsTotal,
                category,
            });

            if (!Number.isFinite(totalEstimatedAmount)) {
                responseData.status = Status.INTERNAL_SERVER_ERROR;
                responseData.error = 'Failed to compute estimated amount';
                return responseData;
            }

            const timestamp = Date.now();
            const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
            const reservationCode = `TC${timestamp}${random}`;

            // Validate capacity and dormitory requirements before transaction
            if (total > facilityDoc.capacity) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = `Number of guests (${total}) exceeds the facility capacity (${facilityDoc.capacity}).`;
                return responseData;
            }

            if (facilityDoc.facilityType === FacilityType.DORMITORY) {
                if (!isNonNegativeInteger(numberOfRooms) || parseInt(numberOfRooms) <= 0) {
                    responseData.status = Status.BAD_REQUEST;
                    responseData.error = 'Number of rooms is required for dormitory reservations and must be a positive integer';
                    return responseData;
                }
            }

            const reservationData = {
                guestName,
                homeAddress,
                officeAddress,
                category,
                guestType,
                telephone,
                officeTelephone,
                numberOfGuests: {
                    total: total,
                    adult: adults,
                    children: children,
                    pwds: pwds,
                    seniorCitizen: seniorCitizens,
                },
                numberOfRooms: facilityDoc.facilityType === FacilityType.DORMITORY ? parseInt(numberOfRooms) : undefined,
                emergencyContact,
                emergencyContactPerson,
                dateOfArrival: normalizeDateOnly(dateOfArrival),
                dateOfDeparture: normalizeDateOnly(dateOfDeparture),
                timeOfArrival,
                facility: facilityDoc._id,
                serviceType,
                addOns: addonIds,
                otherRequests,
                letterOfIntentFileId: loiFileDoc?._id ?? undefined,
                seniorCitizenIdFileId: seniorCitizenIdFileDoc?._id ?? undefined,
                status: initialStatus,
                totalEstimatedAmount,
                reservationCode,
                userId: creatingForGuest ? undefined : user.userId,
                guestEmail: creatingForGuest ? guestEmail.trim() : undefined,
                createdAt: new Date(),
            };

            // Use transaction to prevent race conditions
            let reservation;
            try {
                await dbHelper.withTransaction(async (session) => {
                    // Re-check facility status within transaction
                    const facilityDocInTransaction = await dbHelper.findOneWithTransaction('facility', { _id: facility }, {}, session);
                    if (!facilityDocInTransaction || facilityDocInTransaction.status !== FacilityStatus.AVAILABLE) {
                        throw new Error('Facility is not available for booking.');
                    }

                    // Check for user overlapping reservations within transaction
                    const userOverlapping = await dbHelper.findOneWithTransaction('reservation', creatingForGuest ? {
                        guestEmail: guestEmail.trim(),
                        facility: facility,
                        $or: [
                            {
                                dateOfArrival: { $lte: new Date(dateOfDeparture), },
                                dateOfDeparture: { $gte: new Date(dateOfArrival), },
                            },
                        ],
                    } : {
                        userId: user.userId,
                        facility: facility,
                        $or: [
                            {
                                dateOfArrival: { $lte: new Date(dateOfDeparture), },
                                dateOfDeparture: { $gte: new Date(dateOfArrival), },
                            },
                        ],
                    }, {}, session);

                    if (userOverlapping) {
                        throw new Error('You already have a reservation for this facility that overlaps with these dates.');
                    }

                    // Check for any overlapping reservations within transaction
                    const overlapping = await dbHelper.findOneWithTransaction('reservation', {
                        facility: facility,
                        $or: [
                            {
                                dateOfArrival: { $lte: new Date(dateOfDeparture), },
                                dateOfDeparture: { $gte: new Date(dateOfArrival), },
                            },
                        ],
                    }, {}, session);

                    if (overlapping) {
                        throw new Error('Facility is not available for the selected dates.');
                    }

                    // Create reservation atomically within transaction
                    reservation = await dbHelper.createWithTransaction('reservation', reservationData, session);
                });
            } catch (transactionError) {
                if (transactionError.message.includes('Facility is not available for booking') ||
                    transactionError.message.includes('already have a reservation') ||
                    transactionError.message.includes('not available for the selected dates')) {
                    responseData.status = Status.BAD_REQUEST;
                    responseData.error = transactionError.message;
                    return responseData;
                }
                // Re-throw unexpected errors
                throw transactionError;
            }

            if (loiFileDoc?._id) {
                try {
                    await dbHelper.findOneAndUpdate('file', { _id: loiFileDoc._id, }, { reservationId: reservation._id, });
                } catch (e) {
                    console.error('Failed to backfill reservationId on LOI file:', e?.message);
                    responseData.status = Status.INTERNAL_SERVER_ERROR;
                    responseData.error = 'Failed to backfill reservationId on LOI file: ' + e?.message;
                    return responseData;
                }
            }

            if (seniorCitizenIdFileDoc?._id) {
                try {
                    await dbHelper.findOneAndUpdate('file', { _id: seniorCitizenIdFileDoc._id, }, { reservationId: reservation._id, });
                } catch (e) {
                    console.error('Failed to backfill reservationId on Senior Citizen ID file:', e?.message);
                    responseData.status = Status.INTERNAL_SERVER_ERROR;
                    responseData.error = 'Failed to backfill reservationId on Senior Citizen ID file';
                    return responseData;
                }
            }

            const reservationObject = reservation.toObject();
            delete reservationObject.letterOfIntentUrl;
            delete reservationObject.__v;
            delete reservationObject.createdAt;
            delete reservationObject.userId;
            if (reservationObject.numberOfGuests) {
                delete reservationObject.numberOfGuests.adult;
                delete reservationObject.numberOfGuests.children;
                delete reservationObject.numberOfGuests.pwds;
                delete reservationObject.numberOfGuests.seniorCitizen;
            }

            responseData.status = Status.CREATED;
            responseData.error = null;
            responseData.message = 'Reservation submitted successfully';
            responseData.reservationId = reservation._id.toString();
            responseData.reservation = reservationObject;

            // Invalidate cache after successful reservation creation
            await invalidateReservationCache();
        } catch (error) {
            console.error('Error creating reservation:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error on booking reservation';
        }
        return responseData;
    },

    /**
     * Fetches a reservation by its ID.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {string} reservationId - The ID of the reservation to be fetched.
     * @returns {Object} Response data with status, error, and reservation on success.
     */
    getReservationById: async (dbHelper, reservationId) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error fetching reservation',
        };
        try {
            if (!reservationId) {
            responseData.status = Status.BAD_REQUEST;
            responseData.error = 'Reservation ID is required';
            return responseData;
            }

            // Try cache first
            const cacheKey = `reservation_by_id:${reservationId}`;
            try {
                const cachedResult = await safeRedisOperations.get(cacheKey);
                if (cachedResult) {
                    const parsed = JSON.parse(cachedResult);
                    responseData.status = Status.OK;
                    responseData.error = null;
                    responseData.reservation = parsed.reservation;
                    return responseData;
                }
            } catch (cacheError) {
                console.warn('Cache read error for getReservationById:', cacheError);
            }

            const reservation = await dbHelper.findOne('reservation', { _id: reservationId });
            const facilityDoc = reservation?.facility
            ? await dbHelper.findOne('facility', { _id: reservation.facility })
            : null;

            if (!reservation) {
            responseData.status = Status.NOT_FOUND;
            responseData.error = 'Reservation not found';
            return responseData;
            }

            let url = null;
            try {
            let loiPath = null;
            if (reservation.letterOfIntentFileId) {
                const f = await dbHelper.findOne('file', { _id: reservation.letterOfIntentFileId });
                loiPath = f?.path ?? null;
            } else {
                const f = await dbHelper.findOne('file', { reservationId, kind: FileKind.LETTER_OF_INTENT });
                loiPath = f?.path ?? null;
            }
            if (loiPath) {
                [url] = await bucket.file(loiPath).getSignedUrl({
                version: 'v4',
                expires: Date.now() + 1000 * 60 * 60,
                action: 'read',
                });
            }
            } catch (urlError) {
            console.error('Error generating signed URL for LOI:', urlError);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error generating signed URL for LOI';
            }

            let nonAvailabilityUrl = null;
            let hasNonAvailabilityCert = false;
            try {
            let apprPath = null;
            if (reservation.nonAvailabilityCertFileId) {
                const f = await dbHelper.findOne('file', { _id: reservation.nonAvailabilityCertFileId });
                apprPath = f?.path ?? null;
            } else {
                const f = await dbHelper.findOne('file', { reservationId, kind: FileKind.NONAVAILABILITY_CERTIFICATE });
                apprPath = f?.path ?? null;
            }
            hasNonAvailabilityCert = !!apprPath;
            if (apprPath) {
                [nonAvailabilityUrl] = await bucket.file(apprPath).getSignedUrl({
                version: 'v4',
                expires: Date.now() + 1000 * 60 * 60,
                action: 'read',
                });
            }
            } catch (urlError) {
            console.error('Error generating signed URL for Non-Availability Certificate:', urlError);
            }

            const reservationObject = reservation.toObject();
            if (reservationObject.numberOfGuests) {
            delete reservationObject.numberOfGuests.adult;
            delete reservationObject.numberOfGuests.children;
            delete reservationObject.numberOfGuests.pwds;
            delete reservationObject.numberOfGuests.seniorCitizen;
            }

            const facilityIdStr =
            (facilityDoc?._id && String(facilityDoc._id)) ||
            (reservation.facility && String(reservation.facility)) ||
            null;

            reservationObject.facility = {
            _id: facilityIdStr,
            name: facilityDoc?.name ?? facilityDoc?.facilityName ?? null,
            facilityType: facilityDoc?.facilityType ?? reservation.facilityType ?? null,
            };

            reservationObject.facilityType = reservationObject.facility.facilityType;
            reservationObject.facilityName = reservationObject.facility.name;

            reservationObject.letterOfIntentFile = url;
            reservationObject.nonAvailabilityCertFile = nonAvailabilityUrl;
            reservationObject.hasNonAvailabilityCert = hasNonAvailabilityCert || !!reservation.nonAvailabilityCertFileId;

            // Cache the result (without signed URLs for longer TTL)
            try {
                const cacheData = { ...reservationObject };
                delete cacheData.letterOfIntentFile;
                delete cacheData.nonAvailabilityCertFile;
                
                await safeRedisOperations.set(cacheKey, JSON.stringify({ reservation: cacheData }), { EX: 60 }); // 1 minute TTL
            } catch (cacheError) {
                console.warn('Cache write error for getReservationById:', cacheError);
            }

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.reservation = reservationObject;
        } catch (error) {
            console.error('Error fetching reservation by ID:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error fetching reservation';
        }
        return responseData;
    },

    /**
     * Fetches all reservations for a given user.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {Object} user - The user object containing the user ID and role.
     * @returns {Object} Response data with status, error, and reservations on success.
     */
    getReservationByUserId: async (dbHelper, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error fetching reservations',
        };
        try {
            if (!user || !user.userId) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'User not logged in';
                return responseData;
            }
            const reservations = await dbHelper.find('reservation', { userId: user.userId, });
            responseData.status = Status.OK;
            responseData.error = null;
            responseData.reservations = reservations;
        } catch (error) {
            console.error('Error fetching reservations by user ID:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error fetching reservations';
        }
        return responseData;
    },

    /**
     * Cancels a reservation.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {string} reservationId - The ID of the reservation to cancel.
     * @param {Object} user - The user object containing the user ID and role.
     * @returns {Object} Response data with status, error, message, and the updated reservation on success.
     */
    cancelBooking: async (dbHelper, reservationId, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error cancelling reservation',
        };
        try {
            if (!reservationId) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Reservation ID is required';
                return responseData;
            }
            if (!user || !user.userId) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'User not logged in';
                return responseData;
            }

            const reservation = await dbHelper.findOne('reservation', { _id: reservationId, });

            if (!reservation) {
                responseData.status = Status.NOT_FOUND;
                responseData.error = 'Reservation not found';
                return responseData;
            }

            const isOwner = reservation.userId && String(reservation.userId) === String(user.userId);
            if (!isOwner && user.role !== UserRole.SUPERINTENDENT) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'You are not authorized to cancel this reservation';
                return responseData;
            }

            // const arrivalDate = new Date(reservation.dateOfArrival);
            // const now = new Date();
            // const twentyFourHoursInMs = 24 * 60 * 60 * 1000;

            // if (arrivalDate.getTime() - now.getTime() < twentyFourHoursInMs) {
            //     responseData.status = Status.BAD_REQUEST;
            //     responseData.error = 'Cannot cancel reservation within 24 hours of arrival.';
            //     return responseData;
            // }

            if (reservation.status === ReservationStatus.CANCELLED) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Reservation is already cancelled';
                return responseData;
            }

            const updatedReservation = await dbHelper.findOneAndUpdate(
                'reservation',
                { _id: reservationId, },
                { status: ReservationStatus.CANCELLED, },
                { new: true, }
            );

            if (!updatedReservation) {
                responseData.status = Status.INTERNAL_SERVER_ERROR;
                responseData.error = 'Failed to update reservation status';
                return responseData;
            }

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = 'Reservation cancelled successfully';
            responseData.reservation = {
                _id: updatedReservation._id,
                status: updatedReservation.status,
            };

            // Invalidate cache after successful cancellation
            await invalidateReservationCache();
        } catch (error) {
            console.error('Error cancelling reservation:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error cancelling reservation';
        }
        return responseData;
    },

    /**
     * Retrieves all reservations by the given status.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {string} status - The status of the reservations to fetch.
     * @param {Object} user - The user object containing the user ID and role.
     * @returns {Object} Response data with status, error, and an array of reservations on success.
     */
    getAllReservationsByStatus: async (dbHelper, status, user, options = {}) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error fetching reservations',
        };
        try {
            if (!user) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'User not logged in';
                return responseData;
            }

            if (user.role === UserRole.GUEST) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'You are not authorized to perform this action';
                return responseData;
            }

            if (!status) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Status is required';
                return responseData;
            }

            if (!isValidReservationStatus(status)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid status';
                return responseData;
            }

            const { limit, skip, sort, } = options || {};
            const sortOption = sort ? parseSort(sort) : { createdAt: -1, };
            const limitValue = clampLimit(limit);
            const skipValue = clampSkip(skip);

            // Create cache key with all relevant parameters
            const cacheKey = `get_reservations_by_status_v2:${status}:${limitValue}:${skipValue}:${JSON.stringify(sortOption)}`;

            // Try to get cached result
            try {
                const cachedResult = await safeRedisOperations.get(cacheKey);
                if (cachedResult) {
                    const parsed = JSON.parse(cachedResult);
                    responseData.status = Status.OK;
                    responseData.error = null;
                    responseData.reservations = parsed.reservations;
                    responseData.totalCount = parsed.totalCount;
                    return responseData;
                }
            } catch (cacheError) {
                console.warn('Cache read error for getAllReservationsByStatus:', cacheError);
            }

            const [raw, totalCount] = await Promise.all([
                dbHelper.findMany(
                    'reservation',
                    { status, },
                    {
                        projection: { 
                            _id: 1,
                            guestName: 1, 
                            guestEmail: 1, 
                            serviceType: 1, 
                            createdAt: 1,
                            userId: 1,
                            facility: 1
                        },
                        sort: sortOption,
                        limit: limitValue,
                        skip: skipValue,
                    }
                ),
                dbHelper.count('reservation', { status })
            ]);

            const list = (raw || []).map((r) => (typeof r.toObject === 'function' ? r.toObject() : r));
            const userIds = toValidObjectIdStrings(list.map((r) => r.userId));
            const facilityIds = toValidObjectIdStrings(list.map((r) => r.facility));

            let emailById = new Map();
            if (userIds.length) {
                const users = await dbHelper.findMany(
                    'user',
                    { _id: { $in: userIds, }, },
                    { projection: { _id: 1, email: 1, }, }
                );
                emailById = new Map((users || []).map((u) => [String(u._id), u.email,]));
            }

            let facilityById = new Map();
            if (facilityIds.length) {
                const facilities = await dbHelper.findMany(
                    'facility',
                    { _id: { $in: facilityIds, }, },
                    { projection: { _id: 1, name: 1, }, }
                );
                facilityById = new Map((facilities || []).map((f) => [String(f._id), f.name,]));
            }

            const withEmails = list.map((r) => ({
                _id: r._id,
                guestName: r.guestName,
                guestEmail: r.guestEmail ?? emailById.get(String(r.userId)) ?? null,
                serviceType: r.serviceType,
                createdAt: r.createdAt,
                facilityName: facilityById.get(String(r.facility)) ?? null,
            }));

            try {
                await safeRedisOperations.set(cacheKey, JSON.stringify({ reservations: withEmails, totalCount }), { EX: 60 }); // 1 minute TTL
            } catch (cacheError) {
                console.warn('Cache write error for getAllReservationsByStatus:', cacheError);
            }

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.reservations = withEmails;
            responseData.totalCount = totalCount;
            return responseData;
        } catch (error) {
            console.error('Error fetching reservations by status:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error fetching reservations';
            return responseData;
        }
    },

    /**
     * Searches for reservations based on the provided query object.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {Object} options - Additional options for the search.
     * @param {Object} user - The user object containing the user ID and role.
     * @returns {Object} Response data with status, error, and an array of reservations on success.
     */
    searchReservations: async (dbHelper, options = {}, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error searching reservations',
            reservations: [],
        };

        try {
            if (!user) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'User not logged in';
                return responseData;
            }
            if (user.role === UserRole.GUEST) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'You are not authorized to perform this action';
                return responseData;
            }

            const {
                guestName,
                guestEmail,
                accountEmail,
                status,
                serviceType,
                facility,
                query,
                start,
                end,
                limit,
                skip,
                sort,
            } = options || {};

            const filter = {};

            if (isPresent(guestName)) {
                filter.guestName = new RegExp(escapeRegex(String(guestName).trim()), 'i');
            }

            if (isPresent(guestEmail)) {
                filter.guestEmail = new RegExp(escapeRegex(String(guestEmail).trim()), 'i');
            }

            if (isPresent(accountEmail)) {
                const users = await dbHelper.findMany(
                    'user',
                    { email: new RegExp(escapeRegex(String(accountEmail).trim()), 'i'), },
                    { projection: { _id: 1, }, }
                );
                const ids = (users || []).map((u) => String(u._id));
                if (ids.length) {
                    filter.userId = { $in: ids, };
                } else {
                    responseData.status = Status.OK;
                    responseData.error = null;
                    responseData.reservations = [];
                    return responseData;
                }
            }

            if (isPresent(status) && isValidReservationStatus(status)) {
                filter.status = status;
            }

            if (isPresent(serviceType)) {
                filter.serviceType = serviceType;
            }

            if (isPresent(facility)) {
                filter.facility = facility;
            }

            if (isPresent(query)) {
                const q = String(query).trim();
                const safe = escapeRegex(q);
                const or = [
                    { guestName: { $regex: safe, $options: 'i', }, },
                    { guestEmail: { $regex: safe, $options: 'i', }, },
                    { referenceNumber: { $regex: safe, $options: 'i', }, },
                    { telephone: { $regex: safe, $options: 'i', }, },
                    { serviceType: { $regex: safe, $options: 'i', }, },
                    { status: { $regex: safe, $options: 'i', }, },
                ];

                // Add user email search to query
                try {
                    const users = await dbHelper.findMany('user', 
                        { email: { $regex: safe, $options: 'i' } }, 
                        { projection: { _id: 1 } }
                    );
                    if (users.length > 0) {
                        or.push({ userId: { $in: users.map(u => u._id) } });
                    }
                } catch (userSearchError) {
                    console.error('Error searching user emails:', userSearchError);
                    responseData.status = Status.INTERNAL_SERVER_ERROR;
                    responseData.error = 'Error searching user emails';
                    return responseData;
                }

                if (/^[0-9a-fA-F]{24}$/.test(q)) {
                    or.push({ _id: q, });
                } else if (/^[0-9a-fA-F]{3,}$/.test(q)) {
                    or.push({
                        $expr: {
                            $regexMatch: {
                                input: { $toString: '$_id', },
                                regex: q,
                                options: 'i',
                            },
                        },
                    });
                }

                filter.$or = or;
            }

            if (isPresent(start) && isPresent(end) && isValidDate(start) && isValidDate(end)) {
                const sYMD = String(start).split('T')[0].split(' ')[0];
                const eYMD = String(end).split('T')[0].split(' ')[0];
                filter.$and = (filter.$and || []).concat([
                    {
                        $expr: {
                            $and: [
                                {
                                    $lte: [
                                        {
                                            $cond: [
                                                { $eq: [{ $type: '$dateOfArrival', }, 'string',], },
                                                { $dateFromString: { dateString: '$dateOfArrival', timezone: TZ, }, },
                                                { $dateTrunc: { date: '$dateOfArrival', unit: 'day', timezone: TZ, }, },
                                            ],
                                        },
                                        { $dateFromString: { dateString: eYMD, timezone: TZ, }, },
                                    ],
                                },
                                {
                                    $gte: [
                                        {
                                            $cond: [
                                                { $eq: [{ $type: '$dateOfDeparture', }, 'string',], },
                                                { $dateFromString: { dateString: '$dateOfDeparture', timezone: TZ, }, },
                                                { $dateTrunc: { date: '$dateOfDeparture', unit: 'day', timezone: TZ, }, },
                                            ],
                                        },
                                        { $dateFromString: { dateString: sYMD, timezone: TZ, }, },
                                    ],
                                },
                            ],
                        },
                    },
                ]);
            }

            if (Object.keys(filter).length === 0) {
                responseData.status = Status.OK;
                responseData.error = null;
                responseData.reservations = [];
                return responseData;
            }

            const sortOption = parseSort(sort) || { createdAt: -1, };
            const [docs, totalCount] = await Promise.all([
                dbHelper.findMany(
                    'reservation',
                    filter,
                    {
                        projection: { __v: 0, createdAt: 0, },
                        sort: sortOption,
                        limit: clampLimit(limit),
                        skip: clampSkip(skip),
                    }
                ),
                dbHelper.count('reservation', filter)
            ]);

            const list = (docs || []).map((d) => (typeof d.toObject === 'function' ? d.toObject() : d));
            const userIds = Array.from(new Set(list.map((r) => r.userId).filter(Boolean).map(String)));
            let emailById = new Map();
            if (userIds.length) {
                const users = await dbHelper.findMany(
                    'user',
                    { _id: { $in: userIds, }, },
                    { projection: { _id: 1, email: 1, }, }
                );
                emailById = new Map((users || []).map((u) => [String(u._id), u.email,]));
            }

            const withEmails = list.map((r) => ({
                ...r,
                guestEmail: r.guestEmail ?? (r.userId ? emailById.get(String(r.userId)) ?? null : null),
            }));

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.reservations = withEmails;
            responseData.totalCount = totalCount;
            return responseData;
        } catch (error) {
            console.error('Error searching reservations:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error searching reservations';
            return responseData;
        }
    },

    /**
     * Approves or declines a reservation by its ID.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {string} reservationId - The ID of the reservation to update.
     * @param {string} status - The new status for the reservation.
     * @param {Object} user - The user object containing the user ID and role.
     * @returns {Object} Response data with status, error, message, and updated reservation on success.
     */
    approveOrDeclineReservation: async (dbHelper, reservationId, status, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error approving or declining reservation',
        };
        try {
            if (!user || !user.userId) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'User not logged in';
                return responseData;
            }

            if (user.role !== UserRole.SUPERINTENDENT) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'You are not authorized to perform this action';
                return responseData;
            }

            if (!reservationId) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Reservation ID is required';
                return responseData;
            }

            if (!isValidReservationStatus(status)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid or missing status parameter';
                return responseData;
            }

            const reservation = await dbHelper.findOne('reservation', { _id: reservationId, });
            if (!reservation) {
                responseData.status = Status.NOT_FOUND;
                responseData.error = 'Reservation not found';
                return responseData;
            }

            if (status === ReservationStatus.APPROVED && reservation.nonAvailabilityCertFileId) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Cannot approve reservation: Non-Availability Certificate on file';
                return responseData;
            }

            if (reservation.status === ReservationStatus.APPROVED || reservation.status === ReservationStatus.DECLINED) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = `Reservation is already ${reservation.status.toLowerCase()}`;
                return responseData;
            }

            const updatedReservation = await dbHelper.findOneAndUpdate(
                'reservation',
                { _id: reservationId, },
                { status: status, },
                { new: true, }
            );

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = 'Reservation status updated successfully';
            responseData.reservation = {
                _id: updatedReservation._id,
                status: updatedReservation.status,
            };

            // Invalidate cache after successful status update
            await invalidateReservationCache();
        } catch (error) {
            console.error('Error approving or declining reservation:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error approving or declining reservation';
        }
        return responseData;
    },

    /**
     * Check in or check out a reservation by its ID.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {string} reservationId - The ID of the reservation to update.
     * @param {string} status - The new status for the reservation.
     * @param {Object} user - The user object containing the user ID and role.
     * @returns {Object} Response data with status, error, message, and updated reservation on success.
     */
    checkInOrCheckOutReservation: async (dbHelper, reservationId, status, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error checking in or checking out reservation',
        };
        try {
            if (!user || !user.userId) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'User not logged in';
                return responseData;
            }

            if (![UserRole.SUPERINTENDENT, UserRole.FRONTDESK,].includes(user.role)) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'You are not authorized to perform this action';
                return responseData;
            }

            if (!reservationId) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Reservation ID is required';
                return responseData;
            }

            if (!isValidReservationStatus(status)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid or missing status parameter';
                return responseData;
            }

            const reservation = await dbHelper.findOne('reservation', { _id: reservationId, });
            if (!reservation) {
                responseData.status = Status.NOT_FOUND;
                responseData.error = 'Reservation not found';
                return responseData;
            }

            if (reservation.status === status) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = `Reservation is already ${String(status).toLowerCase()}`;
                return responseData;
            }

            if (status === ReservationStatus.CHECKED_IN) {
                if (reservation.status !== ReservationStatus.CONFIRMED) {
                    responseData.status = Status.BAD_REQUEST;
                    responseData.error = 'Only confirmed reservations can be checked in';
                    return responseData;
                }
            }

            if (status === ReservationStatus.CHECKED_OUT) {
                if (reservation.status !== ReservationStatus.CHECKED_IN) {
                    responseData.status = Status.BAD_REQUEST;
                    responseData.error = 'Only checked-in reservations can be checked out';
                    return responseData;
                }
            }

            const updatedReservation = await dbHelper.findOneAndUpdate(
                'reservation',
                { _id: reservationId, },
                { status: status, },
                { new: true, }
            );

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = 'Reservation status updated successfully';
            responseData.reservation = {
                _id: updatedReservation._id,
                status: updatedReservation.status,
            };

            // Invalidate cache after successful check-in/check-out
            await invalidateReservationCache();
        } catch (error) {
            console.error('Error checking in or checking out reservation:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error checking in or checking out reservation';
        }
        return responseData;
    },

    /**
     * Deletes a reservation by its ID.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {string} reservationId - The ID of the reservation to delete.
     * @param {Object} user - The user object containing the user ID and role.
     * @returns {Object} Response data with status, error, message, and deleted reservation on success.
     */
    deleteReservation: async (dbHelper, reservationId, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error deleting reservation',
        };

        try {
            if (!user || !user.userId) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'User not logged in';
                return responseData;
            }

            if (user.role !== UserRole.SUPERINTENDENT) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'You are not authorized to perform this action';
                return responseData;
            }

            if (!reservationId) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Reservation ID is required';
                return responseData;
            }

            const reservation = await dbHelper.findOne('reservation', { _id: reservationId, });
            if (!reservation) {
                responseData.status = Status.NOT_FOUND;
                responseData.error = 'Reservation not found';
                return responseData;
            }

            if (![ReservationStatus.CANCELLED, ReservationStatus.CHECKED_OUT, ReservationStatus.DECLINED,].includes(reservation.status)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Only cancelled, checked-out, and declined reservations can be deleted';
                return responseData;
            }

            const files = await dbHelper.find('file', { reservationId: reservationId, });
            for (const file of files) {
                try {
                    await bucket.file(file.path).delete();
                } catch (err) {
                    console.error('Failed to delete file in bucket:', file.path, err.message);
                    responseData.status = Status.INTERNAL_SERVER_ERROR;
                    responseData.error = 'Failed to delete file in bucket';
                    return responseData;
                }
            }
            await dbHelper.deleteMany('file', { reservationId: reservationId, });

            const deletedReservation = await dbHelper.deleteOne('reservation', { _id: reservationId, });

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = 'Reservation deleted successfully';
            responseData.reservation = {
                _id: deletedReservation._id,
                status: deletedReservation.status,
            };

            // Invalidate cache after successful deletion
            await invalidateReservationCache();
        } catch (error) {
            console.error('Error deleting reservation:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error deleting reservation';
        }
        return responseData;
    },

    /**
     * Uploads a Non-Availability Certificate for a given reservation.
     * @param {Object} dbHelper - The MongoDB client
     * @param {string} reservationId - The ID of the reservation
     * @param {Object} file - The Non-Availability Certificate file object
     * @param {Object} user - The user object containing the user ID and role
     * @returns {Object} Response data with status, error, message, and updated reservation on success
     */
    uploadNonAvailabilityCertificate: async (dbHelper, reservationId, file, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error uploading Non-Availability Certificate',
        };

        try {
            if (!user || !user.userId) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'User not logged in';
                return responseData;
            }

            if (user.role !== UserRole.SUPERINTENDENT) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'You are not authorized to perform this action';
                return responseData;
            }

            if (!reservationId) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Reservation ID is required';
                return responseData;
            }

            const reservation = await dbHelper.findOne('reservation', { _id: reservationId, });
            if (!reservation) {
                responseData.status = Status.NOT_FOUND;
                responseData.error = 'Reservation not found';
                return responseData;
            }

            if (!file) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Missing Non-Availability Certificate file';
                return responseData;
            }

            if (!isValidFile(file)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid file format';
                return responseData;
            }

            const filename = `non_availability_certificate/${Date.now()}_${file.originalname.replace(/\s/g, '_')}`;
            const blob = bucket.file(filename);
            await new Promise((resolve, reject) => {
                const stream = blob.createWriteStream({
                    resumable: false,
                    contentType: file.mimetype,
                });
                stream.on('error', reject);
                stream.on('finish', resolve);
                stream.end(file.buffer);
            });

            let fileDoc = null;
            if (reservation.nonAvailabilityCertFileId) {
                fileDoc = await dbHelper.findOneAndUpdate('file', { _id: reservation.nonAvailabilityCertFileId, }, {
                    path: filename,
                    mimetype: file.mimetype,
                    size: file.size,
                    updatedAt: new Date(),
                });
            } else {
                fileDoc = await dbHelper.create('file', {
                    path: filename,
                    mimetype: file.mimetype,
                    size: file.size,
                    kind: FileKind.NONAVAILABILITY_CERTIFICATE,
                    reservationId: reservation._id,
                    userId: user.userId,
                    createdAt: new Date(),
                });
                await dbHelper.findOneAndUpdate('reservation', { _id: reservationId, }, { nonAvailabilityCertFileId: fileDoc._id, nonAvailabilityCertFileUploadedAt: new Date(), });
            }

            const updated = await dbHelper.findOne('reservation', { _id: reservationId, });

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = 'Non-Availability Certificate uploaded successfully';
            responseData.reservation = {
                _id: updated._id,
                nonAvailabilityCertFile: fileDoc?.path ?? null,
            };
            return responseData;
        } catch (err) {
            console.error('Error uploading Non-Availability Certificate:', err);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error uploading Non-Availability Certificate';
            return responseData;
        }
    },

    /**
     * Estimates the amount for a given facility, number of guests, and service type.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {Object} params - The parameters object containing the following properties:
     *   - facility (required): The ID of the facility.
     *   - adults (optional, default 0): The number of adults.
     *   - children (optional, default 0): The number of children.
     *   - pwds (optional, default 0): The number of persons with disabilities.
     *   - seniorCitizens (optional, default 0): The number of senior citizens.
     *   - serviceType (optional): The type of service (EVENT, EVENT_AND_LODGING, or LODGING).
     *   - addOns (optional): Array of addon IDs.
     *   - category (optional): The category (PRIVATE, GOVERNMENT, DEPED, PWDs, OTHERS).
     * @returns {Object} Response data with status, error, amount, and model on success.
     */
    estimate: async (dbHelper, params = {}) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error estimating amount',
        };

        try {
            const { facility, adults = 0, children = 0, pwds = 0, seniorCitizens = 0, serviceType, addOns, category, } = params;

            if (!facility) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'facility is required';
                return responseData;
            }

            const facilityDoc = await dbHelper.findOne('facility', { _id: facility, });
            if (!facilityDoc) {
                responseData.status = Status.NOT_FOUND;
                responseData.error = 'Facility not found';
                return responseData;
            }

            
            let addonIds = [];
            if (Array.isArray(addOns)) {
                addonIds = addOns.filter(isValidObjectId);
            } else if (typeof addOns === 'string' && addOns.trim()) {
                addonIds = addOns.split(',').map(id => id.trim()).filter(isValidObjectId);
            }
            let addonsTotal = 0;
            
            if (addonIds.length) {
                const services = await dbHelper.findMany(
                    'addon',
                    { _id: { $in: addonIds, }, },
                    { projection: { _id: 1, price: 1, }, }
                );
                const foundIds = new Set((services || []).map((s) => String(s._id)));
                const unknown = addonIds.filter((id) => !foundIds.has(String(id)));
                if (unknown.length) {
                    responseData.status = Status.BAD_REQUEST;
                    responseData.error = 'Unknown special service id(s): ' + unknown.join(', ');
                    return responseData;
                }
                addonsTotal = services.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
            }

            const svcType = serviceType ||
            ((facilityDoc.facilityType === FacilityType.DORMITORY || facilityDoc.facilityType === FacilityType.COTTAGE)
                ? ServiceType.LODGING
                : ServiceType.EVENT);

            const { amount, model, baseAmount, facilityFee, serviceFee, discount } = computeEstimate({
                facilityDoc,
                adults: Number(adults) || 0,
                children: Number(children) || 0,
                pwds: Number(pwds) || 0,
                seniorCitizens: Number(seniorCitizens) || 0,
                serviceType: svcType,
                addonsTotal,
                category,
            });


            responseData.status = Status.OK;
            responseData.error = null;
            responseData.amount = amount;
            responseData.model = model;
            responseData.baseAmount = baseAmount;
            responseData.facilityFee = facilityFee;
            responseData.serviceFee = serviceFee;
            responseData.discount = discount;
            responseData.addonsTotal = addonsTotal;
        } catch (err) {
            console.error('Error estimating amount:', err);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error estimating amount';
        }
        return responseData;
    },

    /**
     * Checks if a facility is available for a date range (preflight).
     * @param {Object} dbHelper
     * @param {Object} params - { facility, start, end }
     * @param {Object} user - Optional user object for role-based validation
     * @returns {Object} { status, error, available, reason }
     */
    checkAvailability: async (dbHelper, params = {}, user = null) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error checking availability',
            available: false,
        };

        try {
            const { facility, start, end, } = params;

            if (!facility) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'facility is required';
                return responseData;
            }
            if (!isValidDate(start) || !isValidDate(end)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid date format';
                return responseData;
            }
            if (!isValidDateRange(start, end, user)) {
                responseData.status = Status.BAD_REQUEST;
                const errorMessage = user && user.role === UserRole.FRONTDESK 
                    ? 'Invalid date range: ensure arrival is today or later and departure is after arrival'
                    : 'Invalid date range: ensure arrival is today or later, departure is after arrival, and arrival is at least 2 months from today';
                responseData.error = errorMessage;
                return responseData;
            }

            const facilityDoc = await dbHelper.findOne('facility', { _id: facility, });
            if (!facilityDoc) {
                responseData.status = Status.NOT_FOUND;
                responseData.error = 'Facility not found';
                return responseData;
            }
            if (facilityDoc.status !== FacilityStatus.AVAILABLE) {
                responseData.status = Status.OK;
                responseData.error = null;
                responseData.available = false;
                responseData.reason = 'Facility is not available for booking.';
                return responseData;
            }

            const startDate = normalizeDateOnly(start);
            const endDate = normalizeDateOnly(end);

            if (!startDate || !endDate) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Unable to interpret provided dates';
                return responseData;
            }

            const blockingStatuses = [
                ReservationStatus.PENDING,
                ReservationStatus.APPROVED,
                ReservationStatus.CONFIRMED,
                ReservationStatus.CHECKED_IN,
            ];

            const overlapping = await dbHelper.findOne('reservation', {
                facility: facilityDoc._id,
                status: { $in: blockingStatuses, },
                dateOfArrival: { $lt: endDate, },
                dateOfDeparture: { $gt: startDate, },
            });

            if (overlapping) {
                responseData.status = Status.OK;
                responseData.error = null;
                responseData.available = false;
                responseData.reason = 'Facility is not available for the selected dates.';
                return responseData;
            }

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.available = true;
            return responseData;
        } catch (err) {
            console.error('Error checking availability:', err);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error checking availability';
            return responseData;
        }
    },
};

export default reservationModule;

function isValidPhone(number) {
    return /^(\+63|0)9\d{9}$/.test(number);
}

function isValidObjectId(v) {
    return v && /^[0-9a-fA-F]{24}$/.test(String(v));
}

function toValidObjectIdStrings(values) {
    return Array.from(new Set(
        (values || [])
            .map((v) => v && (v._id ?? v))
            .filter(isValidObjectId)
            .map((v) => String(v))
    ));
}

function isValidCategory(category) {
    return Object.values(Category).includes(category);
}

function isValidGuestType(type) {
    return Object.values(GuestType).includes(type);
}

function isValidReservationStatus(status) {
    return Object.values(ReservationStatus).includes(status);
}

function isNonNegativeInteger(value) {
    return Number.isInteger(Number(value)) && Number(value) >= 0;
}

function escapeRegex(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isValidDate(dateStr) {
    if (!dateStr) return false;

    const dateOnly = dateStr.split('T')[0].split(' ')[0];

    const dateFormatRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateFormatRegex.test(dateOnly)) return false;

    const date = new Date(dateOnly);
    return !isNaN(date.getTime());
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

function isValidDateRange(dateOfArrival, dateOfDeparture, user = null) {
    if (!isValidDate(dateOfArrival) || !isValidDate(dateOfDeparture)) return false;

    const arrival = normalizeDateOnly(dateOfArrival);
    const departure = normalizeDateOnly(dateOfDeparture);
    const today = normalizeDateOnly(new Date().toISOString().split('T')[0]);

    if (!arrival || !departure || !today) return false;
    if (arrival < today) return false;
    if (departure <= arrival) return false;
    
    // Skip 2-month constraint for frontdesk users
    if (user && user.role === UserRole.FRONTDESK) {
        return true;
    }
    
    // Calculate minimum advance date (2 months from today) using the normalized today date
    const minAdvanceDate = new Date(today);
    minAdvanceDate.setMonth(minAdvanceDate.getMonth() + 2);
    
    if (arrival < minAdvanceDate) return false;

    return true;
}

function normalizeDateOnly(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const ymd = dateStr.split('T')[0].split(' ')[0];
    const d = new Date(`${ymd}T00:00:00${APP_TZ_OFFSET}`);
    return isNaN(d.getTime()) ? null : d;
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function isValidTime(timeStr) {
    const timeFormatRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    return timeFormatRegex.test(timeStr);
}

function isValidServiceType(type) {
    return Object.values(ServiceType).includes(type);
}

function isValidLength(value, maxLength) {
    if (!value) return true;
    return value.length <= maxLength;
}

function isValidFile(file) {
    if (!file) return false;
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',];
    const maxFileSize = 5 * 1024 * 1024;
    return allowedTypes.includes(file.mimetype) && file.size <= maxFileSize;
}

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
