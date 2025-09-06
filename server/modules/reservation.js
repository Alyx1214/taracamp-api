import { Category, GuestType, Status, UserRole, FacilityStatus, ServiceType, ReservationStatus, FileKind, } from '../constants.js';
import notificationModule from './notification.js';
import { Storage, } from '@google-cloud/storage';
import dotenv from 'dotenv';
dotenv.config();

const storage = new Storage();
const bucket = storage.bucket(process.env.BUCKET_NAME);

const reservationModule = {
    /**
     * Adds a reservation to the database.
     * @param {Object} dbHelper - The database helper object.
     * @param {Object} data - The reservation data.
     * @param {Object} file - The Letter of Intent file.
     * @param {Object} user - The logged-in user.
     * @param {Object} userSocketMap - The map of user sockets.
     * @return {Promise<Object>} A promise that resolves to an object with the status, error, message, reservationId, and reservation properties.
     */
    addReservation: async (dbHelper, data, file, user, userSocketMap) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error on booking reservation',
        };

        try {
            const {
                guestName, homeAddress, officeAddress, category, guestType,
                telephone, officeTelephone, numberOfAdults, numberOfChildren, numberOfPwds,
                emergencyContact, dateOfArrival, dateOfDeparture, facility,
                serviceType, timeOfArrival, otherRequests, guestEmail,
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

            if (!file) {
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

            if (!isValidDateRange(dateOfArrival, dateOfDeparture)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid date range: ensure arrival is today or later, and departure is after arrival';
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

            if (!isValidFile(file)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid or missing Letter of Intent file';
                return responseData;
            }

            if (
                !isNonNegativeInteger(numberOfAdults) ||
                !isNonNegativeInteger(numberOfChildren) ||
                !isNonNegativeInteger(numberOfPwds)
            ) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Guest counts must be non-negative integers';
                return responseData;
            }

            const adults = parseInt(numberOfAdults) || 0;
            const children = parseInt(numberOfChildren) || 0;
            const pwds = parseInt(numberOfPwds) || 0;
            const total = adults + children + pwds;

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

            const userOverlapping = await dbHelper.findOne('reservation', creatingForGuest ? {
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
            });

            if (userOverlapping) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'You already have a reservation for this facility that overlaps with these dates.';
                return responseData;
            }

            const overlapping = await dbHelper.findOne('reservation', {
                facility: facility,
                $or: [
                    {
                        dateOfArrival: { $lte: new Date(dateOfDeparture), },
                        dateOfDeparture: { $gte: new Date(dateOfArrival), },
                    },
                ],
            });

            if (overlapping) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Facility is not available for the selected dates.';
                return responseData;
            }

            if (total > facilityDoc.capacity) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = `Number of guests (${total}) exceeds the facility capacity (${facilityDoc.capacity}).`;
                return responseData;
            }

            let loiFileDoc = null;
            if (file) {
                try {
                    const filename = `letter_of_intent/${Date.now()}_${file.originalname.replace(/\s/g, '_')}`;
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

                    try {
                        loiFileDoc = await dbHelper.create('file', {
                            path: filename,
                            mimetype: file.mimetype,
                            size: file.size,
                            kind: FileKind.LETTER_OF_INTENT,
                            userId: user.userId,
                            createdAt: new Date(),
                        });
                    } catch (createFileErr) {
                        console.error('Error creating file record for LOI:', createFileErr);
                        responseData.status = Status.INTERNAL_SERVER_ERROR;
                    }
                } catch (err) {
                    responseData.status = Status.INTERNAL_SERVER_ERROR;
                    responseData.error = 'Letter of Intent upload failed: ' + err.message;
                    return responseData;
                }
            }

            const { amount: totalEstimatedAmount, } = computeEstimate({
                facilityDoc,
                adults,
                children,
                pwds,
                serviceType,
            });

            if (!Number.isFinite(totalEstimatedAmount)) {
                responseData.status = Status.INTERNAL_SERVER_ERROR;
                responseData.error = 'Failed to compute estimated amount';
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
                },
                emergencyContact,
                dateOfArrival: normalizeDateOnly(dateOfArrival),
                dateOfDeparture: normalizeDateOnly(dateOfDeparture),
                timeOfArrival,
                facility: facilityDoc._id,
                serviceType,
                otherRequests,
                letterOfIntentFileId: loiFileDoc?._id ?? undefined,
                totalEstimatedAmount,
                userId: creatingForGuest ? undefined : user.userId,
                guestEmail: creatingForGuest ? guestEmail.trim() : undefined,
                createdAt: new Date(),
            };

            const reservation = await dbHelper.create('reservation', reservationData);

            if (loiFileDoc?._id) {
                try {
                    await dbHelper.findOneAndUpdate('file', { _id: loiFileDoc._id, }, { reservationId: reservation._id, });
                } catch (e) {
                    console.warn('Failed to backfill reservationId on LOI file:', e?.message);
                }
            }

            await notificationModule.createAndNotifyUser(dbHelper, {
                title: 'Congratulations, Camper! Confirmation Successful — your reservation is now confirmed. We can\'t wait to welcome you!',
                message: 'Thank you for choosing Teachers\' Camp! Your reservation has been confirmed. We\'re excited to welcome you and ensure you have a comfortable and memorable stay.',
                userId: user.userId,
                reservationId: reservation._id,
            }, userSocketMap);

            const reservationObject = reservation.toObject();
            delete reservationObject.letterOfIntentUrl;
            delete reservationObject.__v;
            delete reservationObject.createdAt;
            delete reservationObject.userId;
            if (reservationObject.numberOfGuests) {
                delete reservationObject.numberOfGuests.adult;
                delete reservationObject.numberOfGuests.children;
                delete reservationObject.numberOfGuests.pwds;
            }

            responseData.status = Status.CREATED;
            responseData.error = null;
            responseData.message = 'Reservation submitted successfully';
            responseData.reservationId = reservation._id.toString();
            responseData.reservation = reservationObject;
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

            const reservation = await dbHelper.findOne('reservation', { _id: reservationId, });
            const facilityDoc = reservation?.facility ? await dbHelper.findOne('facility', { _id: reservation.facility, }) : null;
            if (!reservation) {
                responseData.status = Status.NOT_FOUND;
                responseData.error = 'Reservation not found';
                return responseData;
            }

            let url = null;
            try {
                let loiPath = null;
                if (reservation.letterOfIntentFileId) {
                    const f = await dbHelper.findOne('file', { _id: reservation.letterOfIntentFileId, });
                    loiPath = f?.path ?? null;
                } else {
                    const f = await dbHelper.findOne('file', { reservationId: reservationId, kind: FileKind.LETTER_OF_INTENT, });
                    loiPath = f?.path ?? null;
                }
                if (loiPath) {
                    [url,] = await bucket.file(loiPath).getSignedUrl({
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
                    const f = await dbHelper.findOne('file', { _id: reservation.nonAvailabilityCertFileId, });
                    apprPath = f?.path ?? null;
                } else {
                    const f = await dbHelper.findOne('file', { reservationId: reservationId, kind: FileKind.NONAVAILABILITY_CERTIFICATE, });
                    apprPath = f?.path ?? null;
                }
                hasNonAvailabilityCert = !!apprPath;
                if (apprPath) {
                    [nonAvailabilityUrl,] = await bucket.file(apprPath).getSignedUrl({
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
            }

            reservationObject.letterOfIntentFile = url;
            reservationObject.nonAvailabilityCertFile = nonAvailabilityUrl;
            reservationObject.hasNonAvailabilityCert = hasNonAvailabilityCert || !!reservation.nonAvailabilityCertFileId;
            reservationObject.facilityType = facilityDoc?.facilityType ?? null;

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

            const raw = await dbHelper.findMany(
                'reservation',
                { status, },
                {
                    projection: { __v: 0, createdAt: 0, },
                    sort: sortOption,
                    limit: clampLimit(limit),
                    skip: clampSkip(skip),
                }
            );

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.reservations = raw;
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
     * @param {Object} query - The search and filter object.
     * @param {Object} user - The user object containing the user ID and role.
     * @returns {Object} Response data with status, error, and an array of reservations on success.
     */
    searchReservations: async (dbHelper, query, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error searching reservations',
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

            const dbQuery = buildReservationSearchQuery(query || {});

            const raw = await dbHelper.findMany(
                'reservation',
                dbQuery,
                { projection: { __v: 0, createdAt: 0, }, }
            );

            const list = (raw || []).map((r) => (typeof r.toObject === 'function' ? r.toObject() : r));
            const userIds = [...new Set(list.map((r) => String(r.userId)).filter(Boolean)),];

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
                guestEmail: r.guestEmail ?? emailById.get(String(r.userId)) ?? null,
            }));

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.reservations = withEmails;
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
        } catch (error) {
            console.error('Error approving or declining reservation:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error approving or declining reservation';
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

            const files = await dbHelper.find('file', { reservationId: reservationId, });
            for (const file of files) {
                try {
                    await bucket.file(file.path).delete();
                } catch (err) {
                    console.warn('Failed to delete file in bucket:', file.path, err.message);
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
     *   - serviceType (optional): The type of service (ACCOMMODATION or MEETING).
     * @returns {Object} Response data with status, error, amount, and model on success.
     */
    estimate: async (dbHelper, params = {}) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error estimating amount',
        };

        try {
            const { facility, adults = 0, children = 0, pwds = 0, serviceType, } = params;

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

            const svcType = serviceType ||
            ((facilityDoc.facilityType === 'DORMITORY' || facilityDoc.facilityType === 'COTTAGE')
                ? ServiceType.ACCOMMODATION
                : ServiceType.MEETING);

            const { amount, model, } = computeEstimate({
                facilityDoc,
                adults: Number(adults) || 0,
                children: Number(children) || 0,
                pwds: Number(pwds) || 0,
                serviceType: svcType,
            });

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.amount = amount;
            responseData.model = model;
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
     * @returns {Object} { status, error, available, reason }
     */
    checkAvailability: async (dbHelper, params = {}) => {
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
            if (!isValidDateRange(start, end)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid date range: ensure arrival is today or later, and departure is after arrival';
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

            const overlapping = await dbHelper.findOne('reservation', {
                facility: facilityDoc._id,
                $or: [
                    {
                        dateOfArrival: { $lte: endDate, },
                        dateOfDeparture: { $gte: startDate, },
                    },
                ],
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

function isValidObjectId(id) {
    return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
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

function isValidDate(dateStr) {
    if (!dateStr) return false;

    const dateOnly = dateStr.split('T')[0].split(' ')[0];

    const dateFormatRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateFormatRegex.test(dateOnly)) return false;

    const date = new Date(dateOnly);
    return !isNaN(date.getTime());
}

function isValidDateRange(dateOfArrival, dateOfDeparture) {
    if (!isValidDate(dateOfArrival) || !isValidDate(dateOfDeparture)) return false;

    const arrival = new Date(dateOfArrival.split('T')[0].split(' ')[0]);
    const departure = new Date(dateOfDeparture.split('T')[0].split(' ')[0]);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // Optional: add max window, eg, 6 months from today
    const maxAdvance = new Date(today); maxAdvance.setMonth(today.getMonth() + 6);

    if (isNaN(arrival.getTime()) || isNaN(departure.getTime())) return false;
    if (arrival < tomorrow) return false;
    if (departure <= arrival) return false;
    // if (arrival > maxAdvance) return false;       // Uncomment if you want to limit how far in advance

    return true;
}

function normalizeDateOnly(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const datePart = dateStr.split('T')[0].split(' ')[0];
    const normalized = new Date(datePart + 'T00:00:00');
    return isNaN(normalized.getTime()) ? null : normalized;
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

function buildReservationSearchQuery(query = {}) {
    const andConds = [];
    if (query.guestName) andConds.push({ guestName: { $regex: String(query.guestName), $options: 'i', }, });
    if (query.guestEmail) andConds.push({ guestEmail: { $regex: String(query.guestEmail), $options: 'i', }, });
    if (query.dateOfArrival) andConds.push({ dateOfArrival: query.dateOfArrival, });
    if (query.id) {
        const idStr = String(query.id).trim();
        if (/^[0-9a-fA-F]{24}$/.test(idStr)) {
            andConds.push({ _id: idStr, });
        }
    }
    if (query.serviceType) andConds.push({ serviceType: query.serviceType, });
    if (query.status) andConds.push({ status: query.status, });
    if (query.search) {
        const s = String(query.search).trim();
        if (s) {
            const orConds = [
                { guestName: { $regex: s, $options: 'i', }, },
                { referenceNumber: { $regex: s, $options: 'i', }, },
                { telephone: { $regex: s, $options: 'i', }, },
                { serviceType: { $regex: s, $options: 'i', }, },
                { status: { $regex: s, $options: 'i', }, },
            ];
            if (/^[0-9a-fA-F]{24}$/.test(s)) {
                orConds.push({ _id: s, });
            }
            andConds.push({ $or: orConds, });
        }
    }

    return andConds.length ? { $and: andConds, } : {};
}

function computeEstimate({ facilityDoc, adults = 0, children = 0, pwds = 0, serviceType, }) {
    const isAccommodation =
    serviceType === ServiceType.ACCOMMODATION ||
    facilityDoc?.facilityType === 'DORMITORY' ||
    facilityDoc?.facilityType === 'COTTAGE';

    const perPersonRate = Number(facilityDoc?.ratePerPerson);
    const flatBookingPrice = Number(
        facilityDoc?.price ?? facilityDoc?.conferencePrice ?? facilityDoc?.flatPrice
    );

    if (isAccommodation) {
        if (!Number.isFinite(perPersonRate) || perPersonRate < 0) {
            return { amount: 0, model: 'perPerson', };
        }
        const amount =
      adults * perPersonRate +
      (children + pwds) * perPersonRate * 0.80;
        return { amount, model: 'perPerson', };
    } else {
        if (!Number.isFinite(flatBookingPrice) || flatBookingPrice < 0) {
            return { amount: 0, model: 'flat', };
        }
        return { amount: flatBookingPrice, model: 'flat', };
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
