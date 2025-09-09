import fetch from 'node-fetch';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { Status, ReservationStatus, } from '../constants.js';

dotenv.config();

const PAYMONGO_BASE_URL = process.env.PAYMONGO_BASE_URL || 'https://api.paymongo.com/v1';

const paymentModule = {
    /**
     * Creates a PayMongo payment intent, or throws an error if input is invalid or user is not authorized.
     * @param {Object} dbHelper - a mongoDB client
     * @param {string} id - reservation id
     * @param {Object} data - optional
     * @param {number|string} data.amount - amount in PHP, or a string parsable to a number
     * @param {string} data.currency - optional, defaults to 'PHP'
     * @param {string[]} data.paymentMethodAllowed - optional, default is ['card', 'gcash', 'grab_pay', 'paymaya']
     * @param {string} data.description - optional
     * @param {string} data.statementDescriptor - optional
     * @param {Object} data.metadata - optional
     * @param {string} data.captureType - optional, default is 'automatic'
     * @param {Object} user - optional, required if id is provided
     * @param {string} user.userId - user id
     * @returns {Object} { status, error, paymentIntent }
     */
    createPaymentIntent: async (dbHelper, id, data, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error creating payment intent',
        };
        try {
            const reservationId = id || data?.reservationId || null;
            const {
                amount: clientAmount,
                currency = 'PHP',
                paymentMethodAllowed = ['card', 'gcash', 'grab_pay', 'paymaya',],
                description,
                statementDescriptor,
                metadata = {},
                captureType = 'automatic',
            } = data;

            if (!reservationId) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Reservation id is required';
                return responseData;
            }

            let amount = clientAmount;
            if (reservationId) {
                const reservation = await dbHelper.findOne('reservation', { _id: reservationId, });
                if (!reservation) {
                    responseData.status = Status.NOT_FOUND;
                    responseData.error = 'Reservation not found';
                    return responseData;
                }

                const requesterUserId = user?.userId;
                if (!requesterUserId || String(reservation.userId) !== String(requesterUserId)) {
                    responseData.status = Status.FORBIDDEN;
                    responseData.error = 'Not allowed to create payment for this reservation';
                    return responseData;
                }

                if (![ReservationStatus.APPROVED, ReservationStatus.CONFIRMED,].includes(reservation.status)) {
                    responseData.status = Status.FORBIDDEN;
                    responseData.error = 'Reservation must be APPROVED/CONFIRMED before payment';
                    return responseData;
                }

                const maxAmount = Number(reservation.totalEstimatedAmount) || 0;
                const clientNum = clientAmount != null ? Number(String(clientAmount).toString().replace(/,/g, '')) : null;
                if (clientNum != null && Number.isFinite(clientNum)) {
                    if (clientNum <= 0) {
                        responseData.status = Status.BAD_REQUEST;
                        responseData.error = 'Amount must be greater than 0';
                        return responseData;
                    }
                    if (clientNum > maxAmount) {
                        responseData.status = Status.BAD_REQUEST;
                        responseData.error = 'Amount exceeds reservation total';
                        return responseData;
                    }
                    amount = clientNum;
                } else {
                    amount = maxAmount;
                }
            }

            const cents = toCentavos(amount);
            if (!Number.isFinite(cents) || cents <= 0) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Valid positive amount is required';
                return responseData;
            }

            const descriptionFinal = description ?? (reservationId ? `Reservation ${reservationId}` : undefined);
            const payload = {
                amount: cents,
                currency: String(currency || 'PHP').toUpperCase(),
                payment_method_allowed: paymentMethodAllowed,
                capture_type: captureType,
                description: descriptionFinal,
                statement_descriptor: statementDescriptor,
                metadata: {
                    ...metadata,
                    userId: user?.userId || undefined,
                    reservationId: reservationId || metadata?.reservationId,
                },
            };

            const json = await paymongoRequest('POST', '/payment_intents', payload);
            const intent = json.data;

            try {
                await dbHelper.create('payment', {
                    piId: intent.id,
                    reservationId: reservationId || null,
                    userId: user?.userId || null,
                    amountCentavos: intent?.attributes?.amount,
                    currency: intent?.attributes?.currency,
                    description: intent?.attributes?.description,
                    status: intent?.attributes?.status,
                    paymentMethodType: Array.isArray(paymentMethodAllowed) && paymentMethodAllowed.length === 1
                        ? String(paymentMethodAllowed[0])
                        : undefined,
                    createdAt: new Date(),
                });
            } catch (_) {
            }

            responseData.status = Status.CREATED;
            responseData.error = null;
            responseData.paymentIntent = {
                id: intent.id,
                status: intent?.attributes?.status,
                clientKey: intent?.attributes?.client_key,
                amount: intent?.attributes?.amount,
                currency: intent?.attributes?.currency,
                description: intent?.attributes?.description,
                nextAction: intent?.attributes?.next_action || null,
            };
        } catch (error) {
            console.error('Error creating payment intent:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error creating payment intent';
        }
        return responseData;
    },

    /**
   * Attach a payment method to a payment intent.
   * @param {Object} dbHelper - the database access object
   * @param {Object} data - { paymentIntentId, paymentMethodId, returnUrl, paymentMethodType }
   * @returns {Object} { status, error, paymentIntent }
   */
    attachPaymentMethod: async (dbHelper, data) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error attaching payment method',
        };
        try {
            const { paymentIntentId, paymentMethodId, returnUrl, paymentMethodType, } = data || {};
            if (!paymentIntentId || !paymentMethodId) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'paymentIntentId and paymentMethodId are required';
                return responseData;
            }

            try {
                const intentCheck = await paymongoRequest('GET', `/payment_intents/${paymentIntentId}`);
                const i = intentCheck?.data;
                const meta = i?.attributes?.metadata || {};
                const resvId = meta?.reservationId;
                if (resvId) {
                    const reservation = await dbHelper.findOne('reservation', { _id: resvId, });
                    if (!reservation) {
                        responseData.status = Status.NOT_FOUND;
                        responseData.error = 'Reservation not found for this payment intent';
                        return responseData;
                    }
                    if (![ReservationStatus.APPROVED, ReservationStatus.CONFIRMED,].includes(reservation.status)) {
                        responseData.status = Status.FORBIDDEN;
                        responseData.error = 'Reservation must be APPROVED/CONFIRMED before payment';
                        return responseData;
                    }
                }
            } catch (precheckErr) {
                console.error('Failed to validate payment intent:', precheckErr);
                responseData.error = precheckErr.message || 'Failed to validate payment intent';
                return responseData;
            }

            const payload = {
                payment_method: paymentMethodId,
                return_url: returnUrl,
            };

            const json = await paymongoRequest('POST', `/payment_intents/${paymentIntentId}/attach`, payload);
            const intent = json.data;

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.paymentIntent = {
                id: intent.id,
                status: intent?.attributes?.status,
                lastPaymentError: intent?.attributes?.last_payment_error || null,
                nextAction: intent?.attributes?.next_action || null,
                clientKey: intent?.attributes?.client_key,
            };

            // Persist latest intent status on our payment record
            try {
                await dbHelper.findOneAndUpdate('payment', { piId: intent.id, }, {
                    $set: {
                        status: intent?.attributes?.status,
                        // If client passed the channel (gcash/paymaya), store it for display
                        paymentMethodType: paymentMethodType || undefined,
                        updatedAt: new Date(),
                    },
                });
            } catch (e) {
                console.error('Failed updating payment record after attach:', e);
            }
        } catch (error) {
            console.error('Error attaching payment method:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error attaching payment method';
        }
        return responseData;
    },

    /**
     * Fetches a payment intent by its ID.
     * @param {Object} dbHelper - The MongoDB client
     * @param {string} id - The ID of the payment intent to fetch
     * @returns {Object} Response data with status, error, and paymentIntent on success
     */
    getPaymentIntent: async (dbHelper, id) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error fetching payment intent',
        };
        try {
            if (!id) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Payment intent id is required';
                return responseData;
            }

            const json = await paymongoRequest('GET', `/payment_intents/${id}`);
            const intent = json.data;

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.paymentIntent = {
                id: intent.id,
                status: intent?.attributes?.status,
                amount: intent?.attributes?.amount,
                currency: intent?.attributes?.currency,
                description: intent?.attributes?.description,
                clientKey: intent?.attributes?.client_key,
            };
        } catch (error) {
            console.error('Error fetching payment intent:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error fetching payment intent';
        }
        return responseData;
    },

    /**
     * Creates a PayMongo payment method.
     * @param {Object} dbHelper - The MongoDB client
     * @param {Object} data - The data object containing the payment method details
     * @param {string} data.type - The type of payment method, e.g. 'card', 'gcash', 'grab_pay', 'paymaya'
     * @param {Object} [data.details] - Optional details for the payment method type
     * @param {Object} [data.billing] - Optional billing address
     * @returns {Object} Response data with status, error, and paymentMethod on success
     */
    createPaymentMethod: async (dbHelper, data) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error creating payment method',
        };
        try {
            const { type, details, billing, } = data || {};
            const redirectTypes = new Set(['gcash', 'grab_pay', 'paymaya',]);

            if (!type) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'type is required';
                return responseData;
            }

            const requiresDetails = !redirectTypes.has(String(type));
            if (requiresDetails && !details) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'details are required for this payment method type';
                return responseData;
            }

            const attributes = { type, billing, };
            if (requiresDetails || (details && Object.keys(details).length > 0)) {
                attributes.details = details;
            }

            const json = await paymongoRequest('POST', '/payment_methods', attributes);
            const pm = json.data;

            responseData.status = Status.CREATED;
            responseData.error = null;
            responseData.paymentMethod = {
                id: pm.id,
                type: pm?.attributes?.type,
            };
        } catch (error) {
            console.error('Error creating payment method:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error creating payment method';
        }
        return responseData;
    },

    /**
     * Handles a PayMongo webhook event.
     * @param {Object} dbHelper - The MongoDB client
     * @param {Object} headers - The headers of the webhook request
     * @param {string|Object} body - The body of the webhook request
     * @returns {Object} Response data with status, error, event, and optionally updatedReservation or note
     */
    handleWebhook: async (dbHelper, headers, body) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error handling webhook',
        };
        try {
            const secret = process.env.PAYMONGO_WEBHOOK_SECRET;
            const signatureHeader = headers?.['paymongo-signature'] || headers?.['PayMongo-Signature'];

            let rawBody = null;
            if (typeof body === 'string') rawBody = body;

            if (secret && signatureHeader && rawBody !== null) {
                const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
                if (!signatureHeader.includes(computed)) {
                    responseData.status = Status.FORBIDDEN;
                    responseData.error = 'Invalid webhook signature';
                    return responseData;
                }
            }

            const event = typeof body === 'string' ? JSON.parse(body) : body;

            const eventType = event?.data?.attributes?.type || event?.type || '';
            const resource = event?.data?.attributes?.data;
            const resourceType = resource?.type;
            const resourceStatus = resource?.attributes?.status;
            let metadata = resource?.attributes?.metadata || {};
            let reservationId = metadata?.reservationId;

            const isPaid = (
                typeof eventType === 'string' && (
                    eventType.includes('payment_intent.succeeded') ||
          eventType.includes('payment.paid')
                )
            ) || (
                resourceType === 'payment_intent' && resourceStatus === 'succeeded'
            );

            if (!reservationId && resourceType === 'payment') {
                const piId = resource?.attributes?.payment_intent_id || resource?.attributes?.payment_intent?.id;
                if (piId) {
                    // Try to recover reservationId from our DB first (created when PI was created)
                    try {
                        const existingPI = await dbHelper.findOne('payment', { piId, });
                        if (existingPI?.reservationId) {
                            reservationId = String(existingPI.reservationId);
                            metadata = { ...metadata, userId: existingPI.userId ? String(existingPI.userId) : metadata?.userId, reservationId, };
                        }
                    } catch (_) { /* noop */ }

                    // If still missing, fall back to PayMongo fetch (requires proper PAYMONGO_* envs)
                    if (!reservationId) {
                        try {
                            const piJson = await paymongoRequest('GET', `/payment_intents/${piId}`);
                            const pi = piJson?.data;
                            metadata = pi?.attributes?.metadata || metadata;
                            reservationId = metadata?.reservationId || reservationId;
                        } catch (e) {
                            console.error('Failed fetching payment intent for metadata:', e);
                        }
                    }
                }
            }

            let updatedReservation = null;
            let skippedReason = null;
            if (isPaid && reservationId && dbHelper) {
                try {
                    const reservation = await dbHelper.findOne('reservation', { _id: reservationId, });
                    if (!reservation) {
                        skippedReason = 'Reservation not found';
                    } else {
                        let totalPaid = 0;
                        try {
                            const successfulStatuses = ['paid', 'succeeded',];
                            const paidRows = await dbHelper.findMany('payment', { reservationId, status: { $in: successfulStatuses, }, }, { sort: { createdAt: 1, }, });
                            totalPaid = (paidRows || []).reduce((acc, p) => acc + (Number(p.amountCentavos || 0) / 100), 0);
                        } catch (_) {}

                        const total = Number(reservation.totalEstimatedAmount) || 0;
                        const nextStatus = totalPaid > 0 ? ReservationStatus.CONFIRMED : reservation.status;

                        if (nextStatus !== reservation.status) {
                            updatedReservation = await dbHelper.findOneAndUpdate(
                                'reservation',
                                { _id: reservationId, },
                                { status: nextStatus, }
                            );
                        }
                    }
                } catch (updateErr) {
                    console.error('Failed updating reservation status based on payments:', updateErr);
                }
            }

            // Persist payment info for listing/history
            try {
                const now = new Date();
                if (resourceType === 'payment_intent') {
                    const pi = resource;
                    await dbHelper.findOneAndUpdate('payment', { piId: pi.id, }, {
                        $set: {
                            status: pi?.attributes?.status,
                            amountCentavos: pi?.attributes?.amount ?? undefined,
                            currency: pi?.attributes?.currency ?? undefined,
                            description: pi?.attributes?.description ?? undefined,
                            updatedAt: now,
                        },
                    });
                } else if (resourceType === 'payment') {
                    const pay = resource;
                    const pid = pay.id;
                    const piId = pay?.attributes?.payment_intent_id || pay?.attributes?.payment_intent?.id;
                    const pmType = pay?.attributes?.payment_method?.type || pay?.attributes?.source?.type;
                    const refNo = pay?.attributes?.reference_number || pay?.attributes?.referenceNo || null;
                    const paidAtSec = pay?.attributes?.paid_at;
                    const paidAt = typeof paidAtSec === 'number' ? new Date(paidAtSec * 1000) : (pay?.attributes?.paid_at ? new Date(pay?.attributes?.paid_at) : null);
                    const amount = pay?.attributes?.amount;
                    const currency = pay?.attributes?.currency;
                    const description = pay?.attributes?.description;

                    const existing = piId ? await dbHelper.findOne('payment', { piId, }) : null;
                    if (existing) {
                        await dbHelper.findOneAndUpdate('payment', { _id: existing._id, }, {
                            $set: {
                                paymentId: pid,
                                status: pay?.attributes?.status,
                                amountCentavos: amount ?? existing.amountCentavos,
                                currency: currency ?? existing.currency,
                                description: description ?? existing.description,
                                paymentMethodType: pmType ?? existing.paymentMethodType,
                                referenceNumber: refNo ?? existing.referenceNumber,
                                paidAt: paidAt ?? existing.paidAt,
                                updatedAt: now,
                            },
                        });
                    } else {
                        await dbHelper.create('payment', {
                            piId: piId || null,
                            paymentId: pid,
                            reservationId: reservationId || null,
                            userId: metadata?.userId || null,
                            amountCentavos: amount,
                            currency,
                            description,
                            status: pay?.attributes?.status,
                            paymentMethodType: pmType,
                            referenceNumber: refNo,
                            createdAt: now,
                            updatedAt: now,
                            paidAt,
                        });
                    }
                }
            } catch (persistErr) {
                console.error('Failed persisting payment from webhook:', persistErr);
            }

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.event = event;
            if (updatedReservation) {
                responseData.updatedReservation = {
                    _id: updatedReservation._id,
                    status: updatedReservation.status,
                };
            } else if (skippedReason) {
                responseData.note = skippedReason;
            }
        } catch (error) {
            console.error('Error processing webhook:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error processing webhook';
        }
        return responseData;
    },

    /**
   * Reconciles a payment intent by fetching the latest state from PayMongo
   * and updating our DB with that information. If the intent is in a succeeded
   * state, marks the reservation as CONFIRMED if it isn't already.
   * @param {Object} dbHelper - The MongoDB client
   * @param {string} id - The payment intent ID to reconcile
   * @param {Object} user - The user object containing the user ID and role
   * @returns {Object} Response data with status, error, paymentIntent, and updatedReservation on success
   */
    reconcilePaymentIntent: async (dbHelper, id, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error reconciling payment intent',
        };
        try {
            if (!id) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Payment intent id is required';
                return responseData;
            }

            // Fetch latest intent state from PayMongo
            const intentJson = await paymongoRequest('GET', `/payment_intents/${id}`);
            const intent = intentJson?.data;
            const intentStatus = intent?.attributes?.status;
            const meta = intent?.attributes?.metadata || {};
            let reservationId = meta?.reservationId || null;

            // Try to recover reservationId from our DB if missing
            if (!reservationId) {
                try {
                    const existing = await dbHelper.findOne('payment', { piId: id, });
                    if (existing?.reservationId) reservationId = String(existing.reservationId);
                } catch (_) {}
            }

            if (!reservationId) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Unable to determine reservation for this intent';
                return responseData;
            }

            const reservation = await dbHelper.findOne('reservation', { _id: reservationId, });
            if (!reservation) {
                responseData.status = Status.NOT_FOUND;
                responseData.error = 'Reservation not found';
                return responseData;
            }

            // Authorization: only the reservation owner can reconcile (or allow admins later)
            const requesterUserId = user?.userId;
            if (!requesterUserId || String(reservation.userId) !== String(requesterUserId)) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'Not allowed to reconcile this reservation';
                return responseData;
            }

            // Persist latest intent info to our payment row
            try {
                await dbHelper.findOneAndUpdate('payment', { piId: id, }, {
                    $set: {
                        status: intentStatus,
                        amountCentavos: intent?.attributes?.amount,
                        currency: intent?.attributes?.currency,
                        description: intent?.attributes?.description,
                        updatedAt: new Date(),
                    },
                });
            } catch (_) {}

            // If succeeded, mark reservation CONFIRMED (policy: any successful payment confirms)
            let updatedReservation = null;
            if (String(intentStatus).toLowerCase() === 'succeeded') {
                try {
                    // Count successful payments (paid/succeeded)
                    const successfulStatuses = ['paid', 'succeeded',];
                    const paidRows = await dbHelper.findMany('payment', { reservationId, status: { $in: successfulStatuses, }, }, { sort: { createdAt: 1, }, });
                    const totalPaid = (paidRows || []).reduce((acc, p) => acc + (Number(p.amountCentavos || 0) / 100), 0);
                    if (totalPaid > 0 && reservation.status !== ReservationStatus.CONFIRMED) {
                        updatedReservation = await dbHelper.findOneAndUpdate('reservation', { _id: reservationId, }, { status: ReservationStatus.CONFIRMED, });
                    }
                } catch (e) {
                    console.error('Failed to confirm reservation during reconcile:', e);
                }
            }

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.paymentIntent = {
                id: intent.id,
                status: intentStatus,
                nextAction: intent?.attributes?.next_action || null,
            };
            if (updatedReservation) {
                responseData.updatedReservation = { _id: updatedReservation._id, status: updatedReservation.status, };
            }
            return responseData;
        } catch (error) {
            console.error('Error reconciling payment intent:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error reconciling payment intent';
            return responseData;
        }
    },

    /**
     * Fetches all payments associated with a reservation.
     * @param {Object} dbHelper - a mongoDB client
     * @param {string} reservationId - the ID of the reservation
     * @param {Object} user - the user object containing the user ID and role
     * @returns {Object} { status, error, data }
     */
    listPaymentsForReservation: async (dbHelper, reservationId, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error fetching payments',
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
            if (String(reservation.userId) !== String(user.userId)) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'Not allowed to access this reservation';
                return responseData;
            }

            const rows = await dbHelper.findMany('payment', { reservationId, }, { sort: { createdAt: -1, }, });
            responseData.status = Status.OK;
            responseData.error = null;
            responseData.data = rows.map((p) => ({
                _id: p._id,
                piId: p.piId,
                paymentId: p.paymentId,
                status: p.status,
                amountCentavos: p.amountCentavos,
                currency: p.currency,
                description: p.description,
                paymentMethodType: p.paymentMethodType,
                referenceNumber: p.referenceNumber,
                createdAt: p.createdAt,
                paidAt: p.paidAt,
            }));
            return responseData;
        } catch (error) {
            console.error('Error fetching payments:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error fetching payments';
            return responseData;
        }
    },

    /**
     * Computes the payment summary for a given reservation.
     * @param {Object} dbHelper - a mongoDB client
     * @param {string} reservationId - the ID of the reservation
     * @param {Object} user - the user object containing the user ID and role
     * @returns {Object} { status, error, data }
     */
    getPaymentSummary: async (dbHelper, reservationId, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error computing payment summary',
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
            if (String(reservation.userId) !== String(user.userId)) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'Not allowed to access this reservation';
                return responseData;
            }

            const total = Number(reservation.totalEstimatedAmount) || 0;
            let totalPaid = 0;
            try {
                const successfulStatuses = ['paid', 'succeeded',];
                const paidRows = await dbHelper.findMany(
                    'payment',
                    { reservationId, status: { $in: successfulStatuses, }, },
                    { sort: { createdAt: 1, }, }
                );
                totalPaid = (paidRows || []).reduce((acc, p) => acc + (Number(p.amountCentavos || 0) / 100), 0);
            } catch (_) {}
            // Policy: 30% downpayment, due 3 days after creation,
            // but never later than 1 day before arrival.
            const DOWNPAYMENT_PERCENT = 0.30;
            const DUE_IN_DAYS = 3;

            const createdAt = reservation.createdAt ? new Date(reservation.createdAt) : new Date();
            const arrival = reservation.dateOfArrival ? new Date(reservation.dateOfArrival) : null;

            const due = new Date(createdAt);
            due.setDate(due.getDate() + DUE_IN_DAYS);

            if (arrival && !Number.isNaN(arrival.getTime())) {
                const lastDayBeforeArrival = new Date(arrival);
                lastDayBeforeArrival.setDate(arrival.getDate() - 1);
                if (due > lastDayBeforeArrival) {
                    due.setTime(lastDayBeforeArrival.getTime());
                }
            }

            const downpaymentAmount = Math.max(0, Math.round(total * DOWNPAYMENT_PERCENT * 100) / 100);
            const remainingBalance = Math.max(0, Math.round((total - totalPaid) * 100) / 100);
            const isFullyPaid = remainingBalance <= 0;

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.data = {
                reservationId: String(reservation._id),
                totalEstimatedAmount: total,
                downpaymentPercent: DOWNPAYMENT_PERCENT,
                downpaymentAmount,
                totalPaid: Math.round(totalPaid * 100) / 100,
                remainingBalance,
                isFullyPaid,
                dueDate: due.toISOString(),
            };
            return responseData;
        } catch (err) {
            console.error('Error computing payment summary:', err);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error computing payment summary';
            return responseData;
        }
    },
};

export default paymentModule;

function getAuthHeader() {
    const secretKey = process.env.PAYMONGO_SECRET_KEY;
    if (!secretKey) throw new Error('PAYMONGO_SECRET_KEY is not set');
    const token = Buffer.from(`${secretKey}:`).toString('base64');
    return `Basic ${token}`;
}

async function paymongoRequest(method, pathname, attributesPayload) {
    const res = await fetch(`${PAYMONGO_BASE_URL}${pathname}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: getAuthHeader(),
        },
        body: attributesPayload ? JSON.stringify({ data: { attributes: attributesPayload, }, }) : undefined,
    });

    let json = {};
    try {
        json = await res.json();
    } catch (_) {}

    if (!res.ok) {
        const message = json?.errors?.[0]?.detail || res.statusText || 'PayMongo API error';
        const err = new Error(message);
        err.status = res.status;
        err.raw = json;
        throw err;
    }
    return json;
}

function toCentavos(amount) {
    let value = amount;
    if (typeof value === 'string') {
        const cleaned = value.trim().replace(/,/g, '');
        if (!/^-?\d+(?:\.\d+)?$/.test(cleaned)) return NaN;
        value = cleaned;
    }
    const n = Number(value);
    if (!Number.isFinite(n)) return NaN;
    return Math.round(n * 100);
}
