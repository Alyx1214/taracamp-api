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

const invalidateReservationCache = async () => {
    try {
        const keys = await safeRedisOperations.keys('get_reservations_by_status:*');
        const keysV2 = await safeRedisOperations.keys('get_reservations_by_status_v2:*');
        const reservationKeys = await safeRedisOperations.keys('reservation_by_id:*');
        const allKeys = [...keys, ...keysV2, ...reservationKeys];
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
     * @param {Array} pwdIdFiles - Array of PWD ID files (optional).
     * @param {Object} user - The logged-in user.
     * @param {Object} userSocketMap - The map of user sockets.
     * @return {Promise<Object>} A promise that resolves to an object with the status, error, message, reservationId, and reservation properties.
     */
    addReservation: async (dbHelper, data, letterOfIntentFile, seniorCitizenIdFile, pwdIdFiles, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error on booking reservation',
        };

        try {
            const {
                guestName, homeAddress, officeAddress, category, guestType,
                telephone, officeTelephone, numberOfAdults, numberOfChildren, numberOfPwds, numberOfSeniorCitizens,
                emergencyContact, emergencyContactPerson, dateOfArrival, dateOfDeparture, facility,
                serviceType, timeOfArrival, addOns, otherRequests, guestEmail,
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

            // Require at least 1 PWD guest when PWD category is selected
            if (category === Category.PWDS) {
                const pwds = parseInt(numberOfPwds) || 0;
                if (pwds < 1) {
                    responseData.status = Status.BAD_REQUEST;
                    responseData.error = 'PWD category requires at least 1 PWD guest.';
                    return responseData;
                }
            }

            // Require at least 1 senior citizen guest when Senior Citizen category is selected
            if (category === Category.SENIOR_CITIZEN) {
                const seniorCitizens = parseInt(numberOfSeniorCitizens) || 0;
                if (seniorCitizens < 1) {
                    responseData.status = Status.BAD_REQUEST;
                    responseData.error = 'Senior Citizen category requires at least 1 senior citizen guest.';
                    return responseData;
                }
            }

            if (!isValidDate(dateOfArrival) || !isValidDate(dateOfDeparture)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid date format';
                return responseData;
            }

            if (!isValidDateRange(dateOfArrival, dateOfDeparture, user)) {
                responseData.status = Status.BAD_REQUEST;
                const errorMessage = user && (user.role === UserRole.FRONTDESK || user.role === UserRole.SUPERINTENDENT)
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

            // Individuals can only select Lodging service type
            if (guestType === GuestType.INDIVIDUAL && serviceType !== ServiceType.LODGING) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Individuals can only select Lodging service type. Event and Event and Lodging are not available for individual reservations.';
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

            // Individuals cannot select Conference facilities
            if (guestType === GuestType.INDIVIDUAL && facilityDoc.facilityType === FacilityType.CONFERENCE) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Individuals cannot select Conference facility type. Please select Dormitory or Cottage instead.';
                return responseData;
            }

            if (facilityDoc.status !== FacilityStatus.AVAILABLE) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Facility is not available for booking.';
                return responseData;
            }

            let addonIds = [];
            if (Array.isArray(addOns)) {
                addonIds = addOns.filter(isValidObjectId);
            } else if (typeof addOns === 'string' && addOns.trim()) {
                try {
                    const parsed = JSON.parse(addOns);
                    if (Array.isArray(parsed)) {
                        addonIds = parsed.filter(isValidObjectId);
                    } else {
                        addonIds = addOns.split(',').map(id => id.trim()).filter(isValidObjectId);
                    }
                } catch {
                    addonIds = addOns.split(',').map(id => id.trim()).filter(isValidObjectId);
                }
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

            // Validate and handle PWD ID files
            if (pwds > 0 && (!pwdIdFiles || !Array.isArray(pwdIdFiles) || pwdIdFiles.length === 0)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'PWD ID file(s) are required when there are PWD guests in the reservation';
                return responseData;
            }
            
            if (pwdIdFiles && Array.isArray(pwdIdFiles) && pwdIdFiles.length > 0 && pwds <= 0) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'PWD ID file(s) should only be uploaded when there are PWD guests in the reservation';
                return responseData;
            }

            // Handle PWD ID files (will be saved after reservation is created to link reservationId)
            const pwdIdFileDocs = [];
            if (pwds > 0 && pwdIdFiles && Array.isArray(pwdIdFiles) && pwdIdFiles.length > 0) {
                for (const file of pwdIdFiles) {
                    if (!file) continue;
                    try {
                        const filename = `pwd_id/${Date.now()}_${file.originalname.replace(/\s/g, '_')}`;
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

                        const fileDoc = await dbHelper.create('file', {
                            path: filename,
                            mimetype: file.mimetype,
                            size: file.size,
                            kind: FileKind.SENIOR_CITIZEN_ID, // Using same kind for now
                            userId: user.userId,
                            createdAt: new Date(),
                        });
                        pwdIdFileDocs.push(fileDoc);
                    } catch (err) {
                        console.error('Error uploading PWD ID file:', err);
                        responseData.status = Status.INTERNAL_SERVER_ERROR;
                        responseData.error = 'PWD ID file upload failed: ' + err.message;
                        return responseData;
                    }
                }
            }

            // For walk-in reservations (admin creating for guest) or reservations created by frontdesk/superintendent:
            // - If arrival date is today → CONFIRMED
            // - If arrival date is future → PENDING
            // Otherwise, use default PENDING status
            let initialStatus = ReservationStatus.PENDING;
            const isWalkIn = creatingForGuest || (user && (user.role === UserRole.FRONTDESK || user.role === UserRole.SUPERINTENDENT));
            
            if (isWalkIn) {
                const arrivalDate = normalizeDateOnly(dateOfArrival);
                const today = normalizeDateOnly(new Date().toISOString().split('T')[0]);
                
                if (arrivalDate && today && arrivalDate.getTime() === today.getTime()) {
                    // Arrival date is today → CONFIRMED
                    initialStatus = ReservationStatus.CONFIRMED;
                } else {
                    // Arrival date is future → PENDING
                    initialStatus = ReservationStatus.PENDING;
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
                dateOfArrival,
                dateOfDeparture,
                timeOfArrival,
            });

            if (!Number.isFinite(totalEstimatedAmount)) {
                responseData.status = Status.INTERNAL_SERVER_ERROR;
                responseData.error = 'Failed to compute estimated amount';
                return responseData;
            }

            // Generate unique reservation code using shortened timestamp + random for better readability
            const timestamp = Date.now();
            // Use last 8 digits of timestamp (still unique for ~3 years) + 4-digit random
            const shortTimestamp = timestamp.toString().slice(-8);
            const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
            const reservationCode = `TC${shortTimestamp}${random}`;

            // Validate capacity and dormitory requirements before transaction
            if (total > facilityDoc.capacity) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = `Number of guests (${total}) exceeds the facility capacity (${facilityDoc.capacity}).`;
                return responseData;
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

                    // Only block if there are APPROVED, CONFIRMED, or CHECKED_IN reservations
                    // PENDING reservations are allowed to overlap - they'll be auto-declined when one is approved
                    const blockingStatuses = [
                        ReservationStatus.APPROVED,
                        ReservationStatus.CONFIRMED,
                        ReservationStatus.CHECKED_IN,
                    ];

                    const overlapping = await dbHelper.findOneWithTransaction('reservation', {
                        facility: facility,
                        status: { $in: blockingStatuses, },
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
                // Handle duplicate reservation code error
                if (transactionError?.code === 11000 && transactionError?.keyPattern?.reservationCode) {
                    // Retry with a new code if duplicate key error
                    const retryTimestamp = Date.now();
                    const retryShortTimestamp = retryTimestamp.toString().slice(-8);
                    const retryRandom = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
                    reservationData.reservationCode = `TC${retryShortTimestamp}${retryRandom}`;
                    
                    try {
                        await dbHelper.withTransaction(async (session) => {
                            reservation = await dbHelper.createWithTransaction('reservation', reservationData, session);
                        });
                    } catch (retryError) {
                        if (retryError.message.includes('Facility is not available for booking') ||
                            retryError.message.includes('already have a reservation') ||
                            retryError.message.includes('not available for the selected dates')) {
                            responseData.status = Status.BAD_REQUEST;
                            responseData.error = retryError.message;
                            return responseData;
                        }
                        throw retryError;
                    }
                } else if (transactionError.message.includes('Facility is not available for booking') ||
                    transactionError.message.includes('already have a reservation') ||
                    transactionError.message.includes('not available for the selected dates')) {
                    responseData.status = Status.BAD_REQUEST;
                    responseData.error = transactionError.message;
                    return responseData;
                } else {
                    // Re-throw unexpected errors
                    throw transactionError;
                }
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

            // Link PWD ID files to reservation
            if (pwdIdFileDocs && pwdIdFileDocs.length > 0) {
                for (const fileDoc of pwdIdFileDocs) {
                    if (fileDoc?._id) {
                        try {
                            await dbHelper.findOneAndUpdate('file', { _id: fileDoc._id, }, { reservationId: reservation._id, });
                        } catch (e) {
                            console.error('Failed to backfill reservationId on PWD ID file:', e?.message);
                            // Don't fail the entire request if one file update fails
                        }
                    }
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

            // Try cache first (but skip if cache has old structure without guest counts)
            const cacheKey = `reservation_by_id:${reservationId}`;
            try {
                const cachedResult = await safeRedisOperations.get(cacheKey);
                if (cachedResult) {
                    const parsed = JSON.parse(cachedResult);
                    // Check if cached data has guest count details (new format)
                    // If not, skip cache and fetch fresh from database
                    if (parsed.reservation?.numberOfGuests?.adult !== undefined ||
                        parsed.reservation?.numberOfGuests?.children !== undefined ||
                        parsed.reservation?.numberOfGuests?.pwds !== undefined ||
                        parsed.reservation?.numberOfGuests?.seniorCitizen !== undefined) {
                        responseData.status = Status.OK;
                        responseData.error = null;
                        
                        // Ensure arrays are always present, even if empty
                        let seniorCitizenIdFiles = Array.isArray(parsed.reservation.seniorCitizenIdFiles) 
                            ? parsed.reservation.seniorCitizenIdFiles 
                            : [];
                        let pwdIdFiles = Array.isArray(parsed.reservation.pwdIdFiles) 
                            ? parsed.reservation.pwdIdFiles 
                            : [];
                        
                        // Regenerate signed URLs for senior citizen ID files
                        if (seniorCitizenIdFiles.length > 0) {
                            const seniorUrlPromises = seniorCitizenIdFiles.map(async (file) => {
                                if (!file.path) return file;
                                try {
                                    const [signedUrl] = await bucket.file(file.path).getSignedUrl({
                                        version: 'v4',
                                        expires: Date.now() + 1000 * 60 * 60,
                                        action: 'read',
                                    });
                                    return {
                                        ...file,
                                        url: signedUrl,
                                    };
                                } catch (err) {
                                    console.warn('Error generating signed URL for Senior Citizen ID file from cache:', err);
                                    return file;
                                }
                            });
                            seniorCitizenIdFiles = await Promise.all(seniorUrlPromises);
                        }
                        
                        // Regenerate signed URLs for PWD ID files
                        if (pwdIdFiles.length > 0) {
                            const pwdUrlPromises = pwdIdFiles.map(async (file) => {
                                if (!file.path) return file;
                                try {
                                    const [signedUrl] = await bucket.file(file.path).getSignedUrl({
                                        version: 'v4',
                                        expires: Date.now() + 1000 * 60 * 60,
                                        action: 'read',
                                    });
                                    return {
                                        ...file,
                                        url: signedUrl,
                                    };
                                } catch (err) {
                                    console.warn('Error generating signed URL for PWD ID file from cache:', err);
                                    return file;
                                }
                            });
                            pwdIdFiles = await Promise.all(pwdUrlPromises);
                        }
                        
                        // Regenerate signed URL for letter of intent if path exists
                        let letterOfIntentFile = null;
                        if (parsed.reservation.letterOfIntentFile) {
                            // If it's already a URL, use it; otherwise try to regenerate from path
                            if (typeof parsed.reservation.letterOfIntentFile === 'string') {
                                // It's already a URL, use it
                                letterOfIntentFile = parsed.reservation.letterOfIntentFile;
                            }
                        } else {
                            // Try to find the file path and generate URL
                            try {
                                let loiPath = null;
                                if (parsed.reservation.letterOfIntentFileId) {
                                    const f = await dbHelper.findOne('file', { _id: parsed.reservation.letterOfIntentFileId });
                                    loiPath = f?.path ?? null;
                                } else {
                                    const f = await dbHelper.findOne('file', { reservationId, kind: FileKind.LETTER_OF_INTENT });
                                    loiPath = f?.path ?? null;
                                }
                                if (loiPath) {
                                    [letterOfIntentFile] = await bucket.file(loiPath).getSignedUrl({
                                        version: 'v4',
                                        expires: Date.now() + 1000 * 60 * 60,
                                        action: 'read',
                                    });
                                }
                            } catch (loiError) {
                                console.warn('Error generating signed URL for LOI file from cache:', loiError);
                            }
                        }
                        
                        parsed.reservation.seniorCitizenIdFiles = seniorCitizenIdFiles;
                        parsed.reservation.pwdIdFiles = pwdIdFiles;
                        parsed.reservation.letterOfIntentFile = letterOfIntentFile;
                        
                        responseData.reservation = parsed.reservation;
                        return responseData;
                    }
                    // Cache has old format, invalidate it and fetch fresh
                    await safeRedisOperations.del(cacheKey);
                }
            } catch (cacheError) {
                console.warn('Cache read error for getReservationById:', cacheError);
            }

            const reservation = await dbHelper.findOne('reservation', { _id: reservationId });
            const facilityDoc = reservation?.facility
            ? await dbHelper.findOne('facility', { _id: reservation.facility })
            : null;

            // Fetch user email if userId exists
            let userEmail = null;
            if (reservation?.userId) {
                try {
                    const userDoc = await dbHelper.findOne('user', { _id: reservation.userId }, { projection: { email: 1 } });
                    userEmail = userDoc?.email || null;
                } catch (userError) {
                    console.warn('Error fetching user email for reservation:', userError);
                }
            }

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
                try {
                    [url] = await bucket.file(loiPath).getSignedUrl({
                    version: 'v4',
                    expires: Date.now() + 1000 * 60 * 60,
                    action: 'read',
                    });
                } catch (signedUrlError) {
                    console.error('Error generating signed URL for LOI file:', signedUrlError);
                    // Don't set responseData.error here, just log it
                    // The URL will remain null, but we'll still return the reservation
                }
            }
            } catch (urlError) {
            console.error('Error fetching LOI file:', urlError);
            // Don't set responseData.error here, just log it
            // The URL will remain null, but we'll still return the reservation
            }

            // Fetch Senior Citizen ID files (exclude PWD files which have path prefix 'pwd_id/')
            let seniorCitizenIdFiles = [];
            try {
                const seniorCitizenFiles = await dbHelper.find('file', { 
                    reservationId, 
                    kind: FileKind.SENIOR_CITIZEN_ID 
                });
                if (seniorCitizenFiles && seniorCitizenFiles.length > 0) {
                    // Filter out PWD files (they have path prefix 'pwd_id/')
                    const seniorFiles = seniorCitizenFiles.filter(file => 
                        !file.path || !file.path.startsWith('pwd_id/')
                    );
                    if (seniorFiles.length > 0) {
                        const urlPromises = seniorFiles.map(async (file) => {
                            try {
                                const [signedUrl] = await bucket.file(file.path).getSignedUrl({
                                    version: 'v4',
                                    expires: Date.now() + 1000 * 60 * 60,
                                    action: 'read',
                                });
                                return {
                                    url: signedUrl,
                                    name: file.originalname || file.name || 'Senior Citizen ID',
                                    path: file.path,
                                };
                            } catch (err) {
                                console.warn('Error generating signed URL for Senior Citizen ID file:', err);
                                return null;
                            }
                        });
                        seniorCitizenIdFiles = (await Promise.all(urlPromises)).filter(Boolean);
                    }
                }
            } catch (seniorError) {
                console.warn('Error fetching Senior Citizen ID files:', seniorError);
            }

            // Fetch PWD ID files (distinguished by path prefix 'pwd_id/')
            let pwdIdFiles = [];
            try {
                // PWD files are stored with path prefix 'pwd_id/' to distinguish them from senior citizen files
                const allIdFiles = await dbHelper.find('file', { 
                    reservationId, 
                    kind: FileKind.SENIOR_CITIZEN_ID 
                });
                if (allIdFiles && allIdFiles.length > 0) {
                    // Filter files by path prefix to identify PWD files
                    const pwdFiles = allIdFiles.filter(file => 
                        file.path && file.path.startsWith('pwd_id/')
                    );
                    if (pwdFiles.length > 0) {
                        const urlPromises = pwdFiles.map(async (file) => {
                            try {
                                const [signedUrl] = await bucket.file(file.path).getSignedUrl({
                                    version: 'v4',
                                    expires: Date.now() + 1000 * 60 * 60,
                                    action: 'read',
                                });
                                return {
                                    url: signedUrl,
                                    name: file.originalname || file.name || 'PWD ID',
                                    path: file.path,
                                };
                            } catch (err) {
                                console.warn('Error generating signed URL for PWD ID file:', err);
                                return null;
                            }
                        });
                        pwdIdFiles = (await Promise.all(urlPromises)).filter(Boolean);
                    }
                }
            } catch (pwdError) {
                console.warn('Error fetching PWD ID files:', pwdError);
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
            // Keep guest count details for edit functionality
            // Note: These fields are preserved to allow editing reservations
            // The individual guest counts (adult, children, pwds, seniorCitizen) are kept
            // Only the total is typically needed for display, but we preserve all for editing

            const facilityIdStr =
            (facilityDoc?._id && String(facilityDoc._id)) ||
            (reservation.facility && String(reservation.facility)) ||
            null;

            reservationObject.facility = {
            _id: facilityIdStr,
            name: facilityDoc?.name ?? facilityDoc?.facilityName ?? null,
            facilityType: facilityDoc?.facilityType ?? reservation.facilityType ?? null,
            capacity: facilityDoc?.capacity != null ? Number(facilityDoc.capacity) : null,
            ratePerPerson: facilityDoc?.ratePerPerson != null ? Number(facilityDoc.ratePerPerson) : null,
            };

            reservationObject.facilityType = reservationObject.facility.facilityType;
            reservationObject.facilityName = reservationObject.facility.name;

            reservationObject.letterOfIntentFile = url;
            reservationObject.nonAvailabilityCertFile = nonAvailabilityUrl;
            reservationObject.hasNonAvailabilityCert = hasNonAvailabilityCert || !!reservation.nonAvailabilityCertFileId;
            // Ensure arrays are always returned, even if empty
            reservationObject.seniorCitizenIdFiles = Array.isArray(seniorCitizenIdFiles) ? seniorCitizenIdFiles : [];
            reservationObject.pwdIdFiles = Array.isArray(pwdIdFiles) ? pwdIdFiles : [];
            
            // Include user email (account email) if available
            reservationObject.userEmail = userEmail;
            
            // Ensure emergencyContactPerson is included even if undefined
            if (reservationObject.emergencyContactPerson === undefined) {
                reservationObject.emergencyContactPerson = reservation.emergencyContactPerson || '';
            }

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
            
            // Populate facility and addOns, then calculate breakdown for each reservation
            const enrichedReservations = await Promise.all((reservations || []).map(async (reservation) => {
                const reservationObj = typeof reservation.toObject === 'function' ? reservation.toObject() : reservation;
                
                // Fetch facility info
                let facilityDoc = null;
                let facilityName = null;
                let facilityType = null;
                if (reservationObj.facility) {
                    try {
                        facilityDoc = await dbHelper.findOne('facility', { _id: reservationObj.facility });
                        if (facilityDoc) {
                            const facilityObj = typeof facilityDoc.toObject === 'function' ? facilityDoc.toObject() : facilityDoc;
                            facilityName = facilityObj.name || null;
                            facilityType = facilityObj.facilityType || null;
                        }
                    } catch (facilityError) {
                        console.warn('Error fetching facility for reservation:', facilityError);
                    }
                }
                
                // Fetch addOns details
                let addOnsDetails = [];
                let addonsTotal = 0;
                if (Array.isArray(reservationObj.addOns) && reservationObj.addOns.length > 0) {
                    try {
                        const addOns = await dbHelper.findMany('addon', { _id: { $in: reservationObj.addOns } });
                        addOnsDetails = (addOns || []).map(addon => ({
                            _id: addon._id,
                            name: addon.name || 'N/A',
                            price: Number(addon.price) || 0,
                            unit: addon.unit || null,
                        }));
                        addonsTotal = addOnsDetails.reduce((sum, addon) => sum + (Number(addon.price) || 0), 0);
                    } catch (addonError) {
                        console.warn('Error fetching addOns for reservation:', addonError);
                    }
                }
                
                // Calculate breakdown using computeEstimate
                let breakdown = {
                    facilityFee: 0,
                    serviceFee: 0,
                    discount: 0,
                    addOnsTotal: addonsTotal,
                };
                
                if (facilityDoc) {
                    try {
                        const estimateResult = computeEstimate({
                            facilityDoc,
                            adults: reservationObj?.numberOfGuests?.adult || 0,
                            children: reservationObj?.numberOfGuests?.children || 0,
                            pwds: reservationObj?.numberOfGuests?.pwds || 0,
                            seniorCitizens: reservationObj?.numberOfGuests?.seniorCitizen || 0,
                            serviceType: reservationObj?.serviceType,
                            addonsTotal: addonsTotal,
                            category: reservationObj?.category,
                            dateOfArrival: reservationObj?.dateOfArrival,
                            dateOfDeparture: reservationObj?.dateOfDeparture,
                            timeOfArrival: reservationObj?.timeOfArrival,
                        });
                        
                        breakdown = {
                            facilityFee: estimateResult.facilityFee || 0,
                            serviceFee: estimateResult.serviceFee || 0,
                            discount: estimateResult.discount || 0,
                            addOnsTotal: addonsTotal,
                        };
                    } catch (estimateError) {
                        console.warn('Error calculating estimate for reservation:', estimateError);
                    }
                }
                
                return {
                    ...reservationObj,
                    facilityName,
                    facilityType,
                    addOns: addOnsDetails,
                    breakdown,
                };
            }));
            
            responseData.status = Status.OK;
            responseData.error = null;
            responseData.reservations = enrichedReservations;
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
            if (!isOwner && user.role !== UserRole.SUPERINTENDENT && user.role !== UserRole.FRONTDESK) {
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

            const { limit, skip, sort } = options || {};
            const sortOption = sort ? parseSort(sort) : { createdAt: -1, };
            const limitValue = clampLimit(limit);
            const skipValue = clampSkip(skip);

            // Simple status-only filter (for filtered queries, use searchReservations)
            const filter = { status };

            const [raw, totalCount] = await Promise.all([
                dbHelper.findMany(
                    'reservation',
                    filter,
                    {
                        projection: { 
                            _id: 1,
                            guestName: 1, 
                            guestEmail: 1, 
                            serviceType: 1, 
                            createdAt: 1,
                            userId: 1,
                            facility: 1,
                            dateOfArrival: 1
                        },
                        sort: sortOption,
                        limit: limitValue,
                        skip: skipValue,
                    }
                ),
                dbHelper.count('reservation', filter)
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
                category,
                facility,
                facilityType,
                query,
                start,
                startDate,
                end,
                endDate,
                dateField,
                paymentMethod,
                limit,
                skip,
                sort,
            } = options || {};
            
            // Support both 'start'/'end' and 'startDate'/'endDate' parameter names
            const dateStart = start || startDate;
            const dateEnd = end || endDate;
            // Default to dateOfArrival if dateField not specified (for backward compatibility)
            const dateFieldToUse = dateField || 'dateOfArrival';

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

            if (isPresent(category)) {
                filter.category = category;
            }

            if (isPresent(facility)) {
                filter.facility = facility;
            }

            // Filter by facility type - need to look up facilities first
            if (isPresent(facilityType)) {
                try {
                    const facilitiesWithType = await dbHelper.findMany(
                        'facility',
                        { facilityType: String(facilityType).trim(), },
                        { projection: { _id: 1, }, }
                    );
                    const facilityIds = (facilitiesWithType || []).map((f) => String(f._id));
                    if (facilityIds.length === 0) {
                        // No facilities match this type, return empty result
                        responseData.status = Status.OK;
                        responseData.error = null;
                        responseData.reservations = [];
                        responseData.totalCount = 0;
                        return responseData;
                    }
                    // If facility filter already exists, intersect with facilityType results
                    if (filter.facility) {
                        const existingFacilityId = String(filter.facility);
                        if (!facilityIds.includes(existingFacilityId)) {
                            // Facility doesn't match type, return empty
                            responseData.status = Status.OK;
                            responseData.error = null;
                            responseData.reservations = [];
                            responseData.totalCount = 0;
                            return responseData;
                        }
                        // Facility matches type, keep existing filter
                    } else {
                        // Filter by facility IDs that match the type
                        // MongoDB will handle string ObjectId conversion automatically
                        filter.facility = { $in: facilityIds, };
                    }
                } catch (facilityTypeError) {
                    console.error('Error filtering by facility type:', facilityTypeError);
                    responseData.status = Status.INTERNAL_SERVER_ERROR;
                    responseData.error = 'Error filtering by facility type';
                    return responseData;
                }
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

                // Add facility type and name search to query
                try {
                    // Search for facilities matching by type or name
                    const facilitiesWithMatchingTypeOrName = await dbHelper.findMany(
                        'facility',
                        {
                            $or: [
                                { facilityType: { $regex: safe, $options: 'i' } },
                                { name: { $regex: safe, $options: 'i' } }
                            ]
                        },
                        { projection: { _id: 1 } }
                    );
                    if (facilitiesWithMatchingTypeOrName.length > 0) {
                        const facilityIds = facilitiesWithMatchingTypeOrName.map(f => f._id);
                        or.push({ facility: { $in: facilityIds } });
                    }
                } catch (facilitySearchError) {
                    console.error('Error searching facility types and names:', facilitySearchError);
                    // Don't fail the entire search if facility search fails, just log it
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

            // Date range filtering - support dateOfArrival, dateOfDeparture, or createdAt
            // Support filtering with just startDate, just endDate, or both
            if (isPresent(dateStart) && isValidDate(dateStart)) {
                const sYMD = String(dateStart).split('T')[0].split(' ')[0];
                const startDate = new Date(sYMD + 'T00:00:00' + APP_TZ_OFFSET);
                const dateFieldKey = dateFieldToUse;
                filter[dateFieldKey] = filter[dateFieldKey] || {};
                filter[dateFieldKey].$gte = startDate;
            }
            
            if (isPresent(dateEnd) && isValidDate(dateEnd)) {
                const eYMD = String(dateEnd).split('T')[0].split(' ')[0];
                // Add 1 day and subtract 1 millisecond to include the entire end date
                const endDate = new Date(eYMD + 'T00:00:00' + APP_TZ_OFFSET);
                endDate.setDate(endDate.getDate() + 1);
                endDate.setMilliseconds(endDate.getMilliseconds() - 1);
                const dateFieldKey = dateFieldToUse;
                filter[dateFieldKey] = filter[dateFieldKey] || {};
                filter[dateFieldKey].$lte = endDate;
            }

            // Filter by payment method if provided
            if (isPresent(paymentMethod)) {
                // Map frontend payment method values to database values
                const paymentMethodMap = {
                    'DBP': 'dbp',
                    'GCash': 'gcash',
                    'GrabPay': 'grab_pay',
                    'gcash': 'gcash',
                    'grab_pay': 'grab_pay',
                    'card': 'card',
                    'paymaya': 'paymaya',
                    'dbp': 'dbp',
                };
                const dbPaymentMethod = paymentMethodMap[paymentMethod] || paymentMethod;
                
                const payments = await dbHelper.findMany(
                    'payment',
                    { paymentMethodType: dbPaymentMethod },
                    { projection: { reservationId: 1 } }
                );
                const reservationIdsWithPaymentMethod = (payments || [])
                    .map(p => p.reservationId)
                    .filter(Boolean)
                    .map(String);
                
                if (reservationIdsWithPaymentMethod.length === 0) {
                    // No reservations with this payment method, return empty
                    responseData.status = Status.OK;
                    responseData.error = null;
                    responseData.reservations = [];
                    responseData.totalCount = 0;
                    return responseData;
                }
                
                // Add reservation ID filter
                if (filter._id) {
                    // If _id filter already exists, intersect with payment method results
                    const existingIds = Array.isArray(filter._id.$in) ? filter._id.$in : [filter._id];
                    const intersection = existingIds.filter(id => reservationIdsWithPaymentMethod.includes(String(id)));
                    if (intersection.length === 0) {
                        responseData.status = Status.OK;
                        responseData.error = null;
                        responseData.reservations = [];
                        responseData.totalCount = 0;
                        return responseData;
                    }
                    filter._id = { $in: intersection };
                } else {
                    filter._id = { $in: reservationIdsWithPaymentMethod };
                }
            }

            // Allow status-only filter (for getAllReservationsByStatus use case)
            // If no filters at all, return empty (this prevents accidental full table scans)
            if (Object.keys(filter).length === 0 && !isPresent(status)) {
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
                        projection: { __v: 0, },
                        sort: sortOption,
                        limit: clampLimit(limit),
                        skip: clampSkip(skip),
                    }
                ),
                dbHelper.count('reservation', filter)
            ]);

            const list = (docs || []).map((d) => (typeof d.toObject === 'function' ? d.toObject() : d));
            const userIds = Array.from(new Set(list.map((r) => r.userId).filter(Boolean).map(String)));
            const facilityIds = Array.from(new Set(list.map((r) => r.facility).filter(Boolean).map(String)));
            
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
            let facilityTypeById = new Map();
            if (facilityIds.length) {
                const facilities = await dbHelper.findMany(
                    'facility',
                    { _id: { $in: facilityIds, }, },
                    { projection: { _id: 1, name: 1, facilityType: 1, }, }
                );
                facilityById = new Map((facilities || []).map((f) => [String(f._id), f.name,]));
                facilityTypeById = new Map((facilities || []).map((f) => [String(f._id), f.facilityType,]));
            }

            const withEmails = list.map((r) => ({
                ...r,
                guestEmail: r.guestEmail ?? (r.userId ? emailById.get(String(r.userId)) ?? null : null),
                facilityName: r.facility ? facilityById.get(String(r.facility)) ?? null : null,
                facilityType: r.facility ? facilityTypeById.get(String(r.facility)) ?? null : null,
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
     * @returns {Object} Response data with status, error, message, updated reservation, and autoDeclinedReservations on success.
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

            if (reservation.status !== ReservationStatus.PENDING) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = `Reservation must be pending before it can be ${status === ReservationStatus.APPROVED ? 'approved' : 'declined'}. Current status: ${reservation.status}`;
                return responseData;
            }

            // Check for conflicts before approving (only for APPROVED status)
            // Use transaction to prevent race conditions when multiple admins approve simultaneously
            let updatedReservation;
            let autoDeclinedReservations = [];
            if (status === ReservationStatus.APPROVED) {
                await dbHelper.withTransaction(async (session) => {
                    // Re-check reservation status within transaction
                    const reservationInTransaction = await dbHelper.findOneWithTransaction('reservation', { _id: reservationId }, {}, session);
                    if (!reservationInTransaction) {
                        throw new Error('Reservation not found');
                    }
                    if (reservationInTransaction.status !== ReservationStatus.PENDING) {
                        throw new Error(`Reservation must be pending before it can be approved. Current status: ${reservationInTransaction.status}`);
                    }

                    const blockingStatuses = [
                        ReservationStatus.PENDING,
                        ReservationStatus.APPROVED,
                        ReservationStatus.CONFIRMED,
                        ReservationStatus.CHECKED_IN,
                    ];

                    // Check for overlapping reservations with blocking statuses within transaction
                    // Exclude the current reservation being approved
                    // Dates are already normalized when stored, so we can use them directly
                    // However, we need to ensure we're comparing Date objects correctly
                    const arrivalDate = reservationInTransaction.dateOfArrival;
                    const departureDate = reservationInTransaction.dateOfDeparture;
                    
                    if (!arrivalDate || !departureDate) {
                        throw new Error('Invalid date values in reservation');
                    }
                    
                    // Ensure dates are Date objects for MongoDB comparison
                    const normalizedArrival = arrivalDate instanceof Date ? arrivalDate : new Date(arrivalDate);
                    const normalizedDeparture = departureDate instanceof Date ? departureDate : new Date(departureDate);
                    
                    const overlapping = await dbHelper.findManyWithTransaction('reservation', {
                        _id: { $ne: reservationId },
                        facility: reservationInTransaction.facility,
                        status: { $in: blockingStatuses },
                        $or: [
                            {
                                dateOfArrival: { $lte: normalizedDeparture },
                                dateOfDeparture: { $gte: normalizedArrival },
                            },
                        ],
                    }, {}, session);

                    // Check if there are any APPROVED or CONFIRMED overlapping reservations (can't auto-decline these)
                    const approvedOrConfirmedOverlapping = overlapping.filter(r => 
                        r.status === ReservationStatus.APPROVED || r.status === ReservationStatus.CONFIRMED
                    );

                    if (approvedOrConfirmedOverlapping.length > 0) {
                        const conflictingStatus = approvedOrConfirmedOverlapping[0].status || 'unknown';
                        const conflictingId = approvedOrConfirmedOverlapping[0]._id?.toString() || 'unknown';
                        throw new Error(`Cannot approve reservation: Facility is already booked for the selected dates by another reservation (ID: ${conflictingId}, Status: ${conflictingStatus}).`);
                    }

                    // Also check for CHECKED_IN status (facility is currently in use)
                    const checkedInOverlapping = overlapping.filter(r => 
                        r.status === ReservationStatus.CHECKED_IN
                    );

                    if (checkedInOverlapping.length > 0) {
                        const conflictingId = checkedInOverlapping[0]._id?.toString() || 'unknown';
                        throw new Error(`Cannot approve reservation: Facility is currently checked in by another reservation (ID: ${conflictingId}).`);
                    }

                    // Auto-decline all conflicting pending reservations
                    const pendingOverlapping = overlapping.filter(r => 
                        r.status === ReservationStatus.PENDING
                    );

                    // Store reservation info for notifications (before updating)
                    autoDeclinedReservations = pendingOverlapping.map(r => ({
                        _id: r._id,
                        userId: r.userId,
                        guestEmail: r.guestEmail,
                        guestName: r.guestName,
                    }));

                    for (const conflictingReservation of pendingOverlapping) {
                        await dbHelper.updateOneWithTransaction(
                            'reservation',
                            { _id: conflictingReservation._id },
                            { status: ReservationStatus.DECLINED },
                            session
                        );
                    }

                    // Update reservation within transaction
                    updatedReservation = await dbHelper.updateOneWithTransaction(
                        'reservation',
                        { _id: reservationId },
                        { status: status },
                        session
                    );
                });
            } else {
                // For declined status, no conflict check needed
                updatedReservation = await dbHelper.findOneAndUpdate(
                    'reservation',
                    { _id: reservationId, },
                    { status: status, },
                    { new: true, }
                );
            }

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = 'Reservation status updated successfully';
            responseData.reservation = {
                _id: updatedReservation._id,
                status: updatedReservation.status,
            };
            
            // Include auto-declined reservations in response (only for approved status)
            if (status === ReservationStatus.APPROVED && autoDeclinedReservations.length > 0) {
                responseData.autoDeclinedReservations = autoDeclinedReservations;
            }

            // Invalidate cache after successful status update
            await invalidateReservationCache();
        } catch (error) {
            console.error('Error approving or declining reservation:', error);
            
            // Handle specific error messages from transaction
            if (error.message) {
                if (error.message.includes('Reservation not found')) {
                    responseData.status = Status.NOT_FOUND;
                    responseData.error = error.message;
                } else if (error.message.includes('Cannot approve reservation') || 
                           error.message.includes('must be pending')) {
                    responseData.status = Status.BAD_REQUEST;
                    responseData.error = error.message;
                } else {
                    responseData.status = Status.INTERNAL_SERVER_ERROR;
                    responseData.error = error.message || 'Error approving or declining reservation';
                }
            } else {
                responseData.status = Status.INTERNAL_SERVER_ERROR;
                responseData.error = 'Error approving or declining reservation';
            }
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
    checkInOrCheckOutReservation: async (dbHelper, reservationId, status, user, options = {}) => {
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

            const update = { status };
            if (status === ReservationStatus.CHECKED_IN) {
                update.checkedInAt = new Date();
            }
            if (status === ReservationStatus.CHECKED_OUT) {
                const nameFromOptions = typeof options.employeeName === 'string' && options.employeeName.trim().length > 0
                    ? options.employeeName.trim()
                    : null;
                const fallbackName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || null;
                if (nameFromOptions || fallbackName) {
                    update.checkedOutBy = nameFromOptions || fallbackName;
                    update.checkedOutAt = new Date();
                }
            }

            const updatedReservation = await dbHelper.findOneAndUpdate(
                'reservation',
                { _id: reservationId, },
                update,
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
                dateOfArrival: params.dateOfArrival,
                dateOfDeparture: params.dateOfDeparture,
                timeOfArrival: params.timeOfArrival,
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
                const errorMessage = user && (user.role === UserRole.FRONTDESK || user.role === UserRole.SUPERINTENDENT)
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

            const query = {
                facility: facilityDoc._id,
                status: { $in: blockingStatuses, },
                dateOfArrival: { $lt: endDate, },
                dateOfDeparture: { $gt: startDate, },
            };

            // Exclude current reservation when editing
            if (params.excludeReservationId) {
                query._id = { $ne: params.excludeReservationId };
            }

            const overlapping = await dbHelper.findOne('reservation', query);

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

    /**
     * Updates a reservation in the database.
     * @param {Object} dbHelper - The database helper object.
     * @param {string} reservationId - The ID of the reservation to update.
     * @param {Object} data - The reservation data to update.
     * @param {Object} letterOfIntentFile - The Letter of Intent file (optional).
     * @param {Object} seniorCitizenIdFiles - Array of Senior Citizen ID files (optional).
     * @param {Object} pwdIdFiles - Array of PWD ID files (optional).
     * @param {Object} user - The logged-in user.
     * @returns {Object} Response data with status, error, message, and updated reservation on success.
     */
    updateReservation: async (dbHelper, reservationId, data, letterOfIntentFile, seniorCitizenIdFiles, pwdIdFiles, user, serviceContractFile = null, moaFile = null, fundsFile = null) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error updating reservation',
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

            // Fetch existing reservation
            const existingReservation = await dbHelper.findOne('reservation', { _id: reservationId });
            if (!existingReservation) {
                responseData.status = Status.NOT_FOUND;
                responseData.error = 'Reservation not found';
                return responseData;
            }

            // Check authorization
            const isOwner = existingReservation.userId && String(existingReservation.userId) === String(user.userId);
            const isAdmin = user.role === UserRole.ACCOUNTING || user.role === UserRole.SUPERINTENDENT || 
                           user.role === UserRole.FRONTDESK;
            const isCreatingForGuest = existingReservation.guestEmail && 
                                      (user.role === UserRole.ACCOUNTING || user.role === UserRole.SUPERINTENDENT || 
                                       user.role === UserRole.FRONTDESK);

            if (!isOwner && !isAdmin && !isCreatingForGuest) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'Not authorized to update this reservation';
                return responseData;
            }

            // Extract data fields
            const {
                guestName, homeAddress, officeAddress, category, guestType,
                telephone, officeTelephone, numberOfAdults, numberOfChildren, numberOfPwds, numberOfSeniorCitizens,
                emergencyContact, emergencyContactPerson, dateOfArrival, dateOfDeparture, facility,
                serviceType, timeOfArrival, addOns, otherRequests, guestEmail, status,
            } = data;

            // Validate required fields if provided
            if (guestName !== undefined && !isPresent(guestName)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Guest name is required';
                return responseData;
            }

            if (homeAddress !== undefined && !isPresent(homeAddress)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Home address is required';
                return responseData;
            }

            if (category !== undefined && !isValidCategory(category)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid category';
                return responseData;
            }

            if (telephone !== undefined && !isValidPhone(telephone)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid phone number';
                return responseData;
            }

            if (emergencyContact !== undefined && !isValidPhone(emergencyContact)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid emergency contact number';
                return responseData;
            }

            const normalizePhone = (phone) => {
                if (!phone) return '';
                return phone.replace(/^\+63/, '').replace(/^0/, '');
            };

            if (telephone !== undefined && emergencyContact !== undefined && 
                normalizePhone(telephone) === normalizePhone(emergencyContact)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Phone number and emergency contact number must be different';
                return responseData;
            }

            if (dateOfArrival !== undefined && !isValidDate(dateOfArrival)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid date format';
                return responseData;
            }

            if (dateOfDeparture !== undefined && !isValidDate(dateOfDeparture)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid date format';
                return responseData;
            }

            if (dateOfArrival !== undefined && dateOfDeparture !== undefined && 
                !isValidDateRange(dateOfArrival, dateOfDeparture, user)) {
                responseData.status = Status.BAD_REQUEST;
                const errorMessage = user && (user.role === UserRole.FRONTDESK || user.role === UserRole.SUPERINTENDENT)
                    ? 'Invalid date range: ensure arrival is today or later and departure is after arrival'
                    : 'Invalid date range: ensure arrival is today or later, departure is after arrival, and arrival is at least 2 months from today';
                responseData.error = errorMessage;
                return responseData;
            }

            if (timeOfArrival !== undefined && !isValidTime(timeOfArrival)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid time format';
                return responseData;
            }

            if (guestType !== undefined && !isValidGuestType(guestType)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid guest type';
                return responseData;
            }

            if (serviceType !== undefined && !isValidServiceType(serviceType)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid service type';
                return responseData;
            }

            // Individuals can only select Lodging service type
            // Use the new guestType if provided, otherwise use existing reservation's guestType
            const currentGuestType = guestType !== undefined ? guestType : existingReservation.guestType;
            const currentServiceType = serviceType !== undefined ? serviceType : existingReservation.serviceType;
            if (currentGuestType === GuestType.INDIVIDUAL && currentServiceType !== ServiceType.LODGING) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Individuals can only select Lodging service type. Event and Event and Lodging are not available for individual reservations.';
                return responseData;
            }

            if (otherRequests !== undefined && !isValidLength((otherRequests || '').trim(), 500)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Requests must be 500 characters or less';
                return responseData;
            }

            if (letterOfIntentFile && !isValidFile(letterOfIntentFile)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid Letter of Intent file';
                return responseData;
            }

            if (moaFile && !isValidFile(moaFile)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid Memorandum of Agreement file. File must be PDF, DOC, or DOCX and less than 5MB.';
                return responseData;
            }

            if (serviceContractFile && !isValidFile(serviceContractFile)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid Service Contract file. File must be PDF, DOC, or DOCX and less than 5MB.';
                return responseData;
            }

            if (fundsFile && !isValidFile(fundsFile)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid Certificate of Availability of Funds file. File must be PDF, DOC, or DOCX and less than 5MB.';
                return responseData;
            }

            // Validate guest counts
            const adults = numberOfAdults !== undefined ? parseInt(numberOfAdults) : existingReservation.numberOfGuests?.adult || 0;
            const children = numberOfChildren !== undefined ? parseInt(numberOfChildren) : existingReservation.numberOfGuests?.children || 0;
            const pwds = numberOfPwds !== undefined ? parseInt(numberOfPwds) : existingReservation.numberOfGuests?.pwds || 0;
            const seniorCitizens = numberOfSeniorCitizens !== undefined ? parseInt(numberOfSeniorCitizens) : existingReservation.numberOfGuests?.seniorCitizen || 0;
            const total = adults + children + pwds + seniorCitizens;

            if (numberOfAdults !== undefined && !isNonNegativeInteger(numberOfAdults)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Number of adults must be a non-negative integer';
                return responseData;
            }

            if (numberOfChildren !== undefined && !isNonNegativeInteger(numberOfChildren)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Number of children must be a non-negative integer';
                return responseData;
            }

            if (numberOfPwds !== undefined && !isNonNegativeInteger(numberOfPwds)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Number of PWDs must be a non-negative integer';
                return responseData;
            }

            if (numberOfSeniorCitizens !== undefined && !isNonNegativeInteger(numberOfSeniorCitizens)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Number of senior citizens must be a non-negative integer';
                return responseData;
            }

            if (total <= 0) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'At least one guest is required';
                return responseData;
            }

            // Validate category requirements
            const finalCategory = category !== undefined ? category : existingReservation.category;
            if (finalCategory === Category.PWDS) {
                if (pwds < 1) {
                    responseData.status = Status.BAD_REQUEST;
                    responseData.error = 'PWD category requires at least 1 PWD guest.';
                    return responseData;
                }
            }
            if (finalCategory === Category.SENIOR_CITIZEN) {
                if (seniorCitizens < 1) {
                    responseData.status = Status.BAD_REQUEST;
                    responseData.error = 'Senior Citizen category requires at least 1 senior citizen guest.';
                    return responseData;
                }
            }

            // Validate facility if provided
            const facilityId = facility !== undefined ? String(facility) : existingReservation.facility;
            const facilityDoc = await dbHelper.findOne('facility', { _id: facilityId });
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

            // Validate capacity
            if (total > facilityDoc.capacity) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = `Number of guests (${total}) exceeds the facility capacity (${facilityDoc.capacity}).`;
                return responseData;
            }

            // Validate addons if provided
            let addonIds = existingReservation.addOns || [];
            if (addOns !== undefined) {
                if (Array.isArray(addOns)) {
                    addonIds = addOns.filter(isValidObjectId);
                } else if (typeof addOns === 'string' && addOns.trim()) {
                    try {
                        const parsed = JSON.parse(addOns);
                        if (Array.isArray(parsed)) {
                            addonIds = parsed.filter(isValidObjectId);
                        } else {
                            addonIds = addOns.split(',').map(id => id.trim()).filter(isValidObjectId);
                        }
                    } catch {
                        addonIds = addOns.split(',').map(id => id.trim()).filter(isValidObjectId);
                    }
                } else {
                    addonIds = [];
                }

                if (addonIds.length > 0) {
                    const services = await dbHelper.findMany(
                        'addon',
                        { _id: { $in: addonIds } },
                        { projection: { _id: 1, price: 1 } }
                    );
                    const foundIds = new Set((services || []).map((s) => String(s._id)));
                    const unknown = addonIds.filter((id) => !foundIds.has(String(id)));
                    if (unknown.length) {
                        responseData.status = Status.BAD_REQUEST;
                        responseData.error = 'Unknown special service id(s): ' + unknown.join(', ');
                        return responseData;
                    }
                }
            }

            // Handle file uploads
            let loiFileDoc = null;
            
            // Handle Letter of Intent file (separate from MOA)
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

                    loiFileDoc = await dbHelper.create('file', {
                        path: filename,
                        mimetype: letterOfIntentFile.mimetype,
                        size: letterOfIntentFile.size,
                        kind: FileKind.LETTER_OF_INTENT,
                        userId: user.userId,
                        reservationId: reservationId,
                        createdAt: new Date(),
                    });
                } catch (err) {
                    responseData.status = Status.INTERNAL_SERVER_ERROR;
                    responseData.error = 'Letter of Intent upload failed: ' + err.message;
                    return responseData;
                }
            }

            // Handle MOA (Memorandum of Agreement) file upload (separate from Letter of Intent)
            let moaFileDoc = null;
            if (moaFile) {
                try {
                    const filename = `memorandum_of_agreement/${Date.now()}_${moaFile.originalname.replace(/\s/g, '_')}`;
                    const blob = bucket.file(filename);
                    await new Promise((resolve, reject) => {
                        const stream = blob.createWriteStream({
                            resumable: false,
                            contentType: moaFile.mimetype,
                        });
                        stream.on('error', reject);
                        stream.on('finish', resolve);
                        stream.end(moaFile.buffer);
                    });

                    moaFileDoc = await dbHelper.create('file', {
                        path: filename,
                        mimetype: moaFile.mimetype,
                        size: moaFile.size,
                        kind: FileKind.MEMORANDUM_OF_AGREEMENT,
                        userId: user.userId,
                        reservationId: reservationId,
                        createdAt: new Date(),
                    });
                } catch (err) {
                    console.error('Error uploading MOA file:', err);
                    responseData.status = Status.INTERNAL_SERVER_ERROR;
                    responseData.error = 'Memorandum of Agreement upload failed: ' + err.message;
                    return responseData;
                }
            }

            // Handle Senior Citizen ID files
            const seniorCitizenIdFileDocs = [];
            if (seniorCitizens > 0 && seniorCitizenIdFiles && Array.isArray(seniorCitizenIdFiles) && seniorCitizenIdFiles.length > 0) {
                for (const file of seniorCitizenIdFiles) {
                    if (!file) continue;
                    try {
                        const filename = `senior_citizen_id/${Date.now()}_${file.originalname.replace(/\s/g, '_')}`;
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

                        const fileDoc = await dbHelper.create('file', {
                            path: filename,
                            mimetype: file.mimetype,
                            size: file.size,
                            kind: FileKind.SENIOR_CITIZEN_ID,
                            userId: user.userId,
                            reservationId: reservationId,
                            createdAt: new Date(),
                        });
                        seniorCitizenIdFileDocs.push(fileDoc);
                    } catch (err) {
                        console.error('Error uploading Senior Citizen ID file:', err);
                    }
                }
            }

            // Handle PWD ID files (similar to Senior Citizen ID)
            const pwdIdFileDocs = [];
            if (pwds > 0 && pwdIdFiles && Array.isArray(pwdIdFiles) && pwdIdFiles.length > 0) {
                for (const file of pwdIdFiles) {
                    if (!file) continue;
                    try {
                        const filename = `pwd_id/${Date.now()}_${file.originalname.replace(/\s/g, '_')}`;
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

                        const fileDoc = await dbHelper.create('file', {
                            path: filename,
                            mimetype: file.mimetype,
                            size: file.size,
                            kind: FileKind.SENIOR_CITIZEN_ID, // Using same kind for now
                            userId: user.userId,
                            reservationId: reservationId,
                            createdAt: new Date(),
                        });
                        pwdIdFileDocs.push(fileDoc);
                    } catch (err) {
                        console.error('Error uploading PWD ID file:', err);
                    }
                }
            }

            // Handle Service Contract file upload
            let serviceContractFileDoc = null;
            if (serviceContractFile) {
                try {
                    const filename = `service_contract/${Date.now()}_${serviceContractFile.originalname.replace(/\s/g, '_')}`;
                    const blob = bucket.file(filename);
                    await new Promise((resolve, reject) => {
                        const stream = blob.createWriteStream({
                            resumable: false,
                            contentType: serviceContractFile.mimetype,
                        });
                        stream.on('error', reject);
                        stream.on('finish', resolve);
                        stream.end(serviceContractFile.buffer);
                    });

                    serviceContractFileDoc = await dbHelper.create('file', {
                        path: filename,
                        mimetype: serviceContractFile.mimetype,
                        size: serviceContractFile.size,
                        kind: FileKind.SERVICE_CONTRACT,
                        userId: user.userId,
                        reservationId: reservationId,
                        createdAt: new Date(),
                    });
                } catch (err) {
                    console.error('Error uploading Service Contract file:', err);
                    responseData.status = Status.INTERNAL_SERVER_ERROR;
                    responseData.error = 'Service Contract upload failed: ' + err.message;
                    return responseData;
                }
            }

            // Handle Certificate of Availability of Funds file upload
            let fundsFileDoc = null;
            if (fundsFile) {
                try {
                    const filename = `certificate_of_funds/${Date.now()}_${fundsFile.originalname.replace(/\s/g, '_')}`;
                    const blob = bucket.file(filename);
                    await new Promise((resolve, reject) => {
                        const stream = blob.createWriteStream({
                            resumable: false,
                            contentType: fundsFile.mimetype,
                        });
                        stream.on('error', reject);
                        stream.on('finish', resolve);
                        stream.end(fundsFile.buffer);
                    });

                    fundsFileDoc = await dbHelper.create('file', {
                        path: filename,
                        mimetype: fundsFile.mimetype,
                        size: fundsFile.size,
                        kind: FileKind.CERTIFICATE_OF_AVAILABILITY_OF_FUNDS,
                        userId: user.userId,
                        reservationId: reservationId,
                        createdAt: new Date(),
                    });
                } catch (err) {
                    console.error('Error uploading Certificate of Availability of Funds file:', err);
                    responseData.status = Status.INTERNAL_SERVER_ERROR;
                    responseData.error = 'Certificate of Availability of Funds upload failed: ' + err.message;
                    return responseData;
                }
            }

            // Calculate new estimated amount
            const addonsTotal = addonIds.length > 0
                ? (await dbHelper.findMany('addon', { _id: { $in: addonIds } }, { projection: { _id: 1, price: 1 } }))
                    .reduce((sum, s) => sum + (Number(s.price) || 0), 0)
                : 0;

            const finalDateOfArrival = dateOfArrival !== undefined ? normalizeDateOnly(dateOfArrival) : existingReservation.dateOfArrival;
            const finalDateOfDeparture = dateOfDeparture !== undefined ? normalizeDateOnly(dateOfDeparture) : existingReservation.dateOfDeparture;
            const finalTimeOfArrival = timeOfArrival !== undefined ? timeOfArrival : existingReservation.timeOfArrival;

            const { amount: totalEstimatedAmount } = computeEstimate({
                facilityDoc,
                adults,
                children,
                pwds,
                seniorCitizens,
                serviceType: serviceType !== undefined ? serviceType : existingReservation.serviceType,
                addonsTotal,
                category: finalCategory,
                dateOfArrival: finalDateOfArrival,
                dateOfDeparture: finalDateOfDeparture,
                timeOfArrival: finalTimeOfArrival,
            });

            if (!Number.isFinite(totalEstimatedAmount)) {
                responseData.status = Status.INTERNAL_SERVER_ERROR;
                responseData.error = 'Failed to compute estimated amount';
                return responseData;
            }

            // Build update object
            const updateData = {};
            if (guestName !== undefined) updateData.guestName = guestName;
            if (homeAddress !== undefined) updateData.homeAddress = homeAddress;
            if (officeAddress !== undefined) updateData.officeAddress = officeAddress;
            if (category !== undefined) updateData.category = category;
            if (guestType !== undefined) updateData.guestType = guestType;
            if (telephone !== undefined) updateData.telephone = telephone;
            if (officeTelephone !== undefined) updateData.officeTelephone = officeTelephone;
            if (emergencyContact !== undefined) updateData.emergencyContact = emergencyContact;
            if (emergencyContactPerson !== undefined) updateData.emergencyContactPerson = emergencyContactPerson;
            if (dateOfArrival !== undefined) updateData.dateOfArrival = normalizeDateOnly(dateOfArrival);
            if (dateOfDeparture !== undefined) updateData.dateOfDeparture = normalizeDateOnly(dateOfDeparture);
            if (timeOfArrival !== undefined) updateData.timeOfArrival = timeOfArrival;
            if (facility !== undefined) updateData.facility = facilityDoc._id;
            if (serviceType !== undefined) updateData.serviceType = serviceType;
            if (addOns !== undefined) updateData.addOns = addonIds;
            if (otherRequests !== undefined) updateData.otherRequests = otherRequests;
            if (guestEmail !== undefined) {
                if (guestEmail && !isValidEmail(guestEmail)) {
                    responseData.status = Status.BAD_REQUEST;
                    responseData.error = 'Invalid guest email';
                    return responseData;
                }
                updateData.guestEmail = guestEmail ? guestEmail.trim() : undefined;
            }
            // Allow status updates for admin users (to confirm reservations)
            // Also allow owners to confirm their reservation when uploading MOA or Service Contract
            if (status !== undefined) {
                if (isValidReservationStatus(status)) {
                    if (isAdmin) {
                        // Admin users can update status
                        if (status === ReservationStatus.CONFIRMED && existingReservation.status === ReservationStatus.APPROVED) {
                            updateData.status = status;
                        } else if (status !== ReservationStatus.CONFIRMED) {
                            // Allow other status updates if not trying to confirm
                            updateData.status = status;
                        } else {
                            responseData.status = Status.BAD_REQUEST;
                            responseData.error = 'Can only confirm approved reservations';
                            return responseData;
                        }
                    } else if (isOwner && status === ReservationStatus.CONFIRMED) {
                        // Allow owners to confirm their reservation when uploading confirmation documents
                        if (existingReservation.status === ReservationStatus.APPROVED) {
                            // Check if user is uploading MOA or Service Contract
                            if (moaFile || serviceContractFile) {
                                updateData.status = status;
                            } else {
                                responseData.status = Status.BAD_REQUEST;
                                responseData.error = 'Please upload Memorandum of Agreement or Service Contract to confirm your reservation';
                                return responseData;
                            }
                        } else {
                            responseData.status = Status.BAD_REQUEST;
                            responseData.error = 'Can only confirm approved reservations';
                            return responseData;
                        }
                    } else {
                        responseData.status = Status.FORBIDDEN;
                        responseData.error = 'Not authorized to update reservation status';
                        return responseData;
                    }
                } else {
                    responseData.status = Status.BAD_REQUEST;
                    responseData.error = 'Invalid status';
                    return responseData;
                }
            }

            updateData.numberOfGuests = {
                total: total,
                adult: adults,
                children: children,
                pwds: pwds,
                seniorCitizen: seniorCitizens,
            };

            updateData.totalEstimatedAmount = totalEstimatedAmount;

            if (loiFileDoc) {
                updateData.letterOfIntentFileId = loiFileDoc._id;
            }

            // Check for overlapping reservations (excluding current reservation)
            if (dateOfArrival !== undefined || dateOfDeparture !== undefined || facility !== undefined) {
                const finalFacility = facility !== undefined ? facilityDoc._id : existingReservation.facility;
                const finalArrival = dateOfArrival !== undefined ? normalizeDateOnly(dateOfArrival) : existingReservation.dateOfArrival;
                const finalDeparture = dateOfDeparture !== undefined ? normalizeDateOnly(dateOfDeparture) : existingReservation.dateOfDeparture;

                // Only block if there are APPROVED, CONFIRMED, or CHECKED_IN reservations
                // PENDING reservations are allowed to overlap - they'll be auto-declined when one is approved
                const blockingStatuses = [
                    ReservationStatus.APPROVED,
                    ReservationStatus.CONFIRMED,
                    ReservationStatus.CHECKED_IN,
                ];

                const overlapping = await dbHelper.findOne('reservation', {
                    _id: { $ne: reservationId },
                    facility: finalFacility,
                    status: { $in: blockingStatuses },
                    $or: [
                        {
                            dateOfArrival: { $lte: finalDeparture },
                            dateOfDeparture: { $gte: finalArrival },
                        },
                    ],
                });

                if (overlapping) {
                    responseData.status = Status.BAD_REQUEST;
                    responseData.error = 'Facility is not available for the selected dates.';
                    return responseData;
                }
            }

            // Update reservation
            const updatedReservation = await dbHelper.findOneAndUpdate(
                'reservation',
                { _id: reservationId },
                updateData,
                { new: true }
            );

            if (!updatedReservation) {
                responseData.status = Status.INTERNAL_SERVER_ERROR;
                responseData.error = 'Failed to update reservation';
                return responseData;
            }

            const reservationObject = updatedReservation.toObject();
            delete reservationObject.letterOfIntentUrl;
            delete reservationObject.__v;

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = 'Reservation updated successfully';
            responseData.reservationId = updatedReservation._id.toString();
            responseData.reservation = reservationObject;

            await invalidateReservationCache();
        } catch (error) {
            console.error('Error updating reservation:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error updating reservation: ' + error.message;
        }

        return responseData;
    },

    /**
     * Updates the meal preference for a reservation.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {string} reservationId - The ID of the reservation to update.
     * @param {boolean} willAvailMeals - Whether the guest will avail meals.
     * @param {Object} user - The user object containing the user ID and role.
     * @returns {Object} Response data with status, error, message, and updated reservation on success.
     */
    updateMealPreference: async (dbHelper, reservationId, willAvailMeals, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error updating meal preference',
        };
        try {
            if (!user || !user.userId) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'User not logged in';
                return responseData;
            }

            if (!reservationId) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Reservation ID is required';
                return responseData;
            }

            const reservation = await dbHelper.findOne('reservation', { _id: reservationId });
            if (!reservation) {
                responseData.status = Status.NOT_FOUND;
                responseData.error = 'Reservation not found';
                return responseData;
            }

            const isOwner = reservation.userId && String(reservation.userId) === String(user.userId);
            const isAdmin = user.role === UserRole.ACCOUNTING || user.role === UserRole.SUPERINTENDENT;

            if (!isOwner && !isAdmin) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'Not authorized to update this reservation';
                return responseData;
            }

            const updated = await dbHelper.findOneAndUpdate(
                'reservation',
                { _id: reservationId },
                { willAvailMeals: willAvailMeals === true || willAvailMeals === 'true' },
                { new: true }
            );

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = 'Meal preference updated successfully';
            responseData.reservation = {
                _id: updated._id,
                willAvailMeals: updated.willAvailMeals
            };

            await invalidateReservationCache();
        } catch (error) {
            console.error('Error updating meal preference:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error updating meal preference';
        }
        return responseData;
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
    
    // Skip 2-month constraint for frontdesk and superintendent users
    if (user && (user.role === UserRole.FRONTDESK || user.role === UserRole.SUPERINTENDENT)) {
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

/**
 * Normalizes a Date object to date-only (midnight in app timezone)
 * Works with both Date objects and date strings
 * Since dates in DB are already normalized, this ensures consistent comparison
 */
function normalizeDateToDateOnly(date) {
    if (!date) return null;
    // If it's already a Date object, extract the date part and normalize to app timezone
    if (date instanceof Date) {
        // Use the date's UTC methods to get year, month, day (avoids timezone issues)
        // Since dates in DB are stored normalized, we can safely extract the date components
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const ymd = `${year}-${month}-${day}`;
        // Create a new date at midnight in the app timezone
        const d = new Date(`${ymd}T00:00:00${APP_TZ_OFFSET}`);
        return isNaN(d.getTime()) ? null : d;
    }
    // If it's a string, use the existing normalizeDateOnly function
    if (typeof date === 'string') {
        return normalizeDateOnly(date);
    }
    return null;
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
