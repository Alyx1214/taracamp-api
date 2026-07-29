import fetch from 'node-fetch';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { Status, ReservationStatus, UserRole, ServiceType, Category, FacilityType, GuestType, FileKind, } from '../constants.js';
import { Storage } from '@google-cloud/storage';

dotenv.config();

const PAYMONGO_BASE_URL = process.env.PAYMONGO_BASE_URL || 'https://api.paymongo.com/v1';
const DOWNPAYMENT_PERCENT = 0.10;
const DUE_IN_DAYS = 3;

const storage = new Storage();
const bucket = storage.bucket(process.env.BUCKET_NAME);

const paymentModule = {
    /**
     * Creates a payment intent and returns the intent data.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {string} id - The ID of the reservation to create the payment intent for.
     * @param {Object} data - The data object containing the payment intent data.
     * @param {string} [data.reservationId] - The ID of the reservation to create the payment intent for.
     * @param {number} [data.amount] - The amount of the payment intent. Defaults to the total estimated amount of the reservation.
     * @param {string} [data.currency=PHP] - The currency of the payment intent.
     * @param {string[]} [data.paymentMethodAllowed=['card', 'gcash', 'grab_pay', 'paymaya', 'dbp']] - The allowed payment methods for the payment intent.
     * @param {string} [data.description] - The description of the payment intent.
     * @param {string} [data.statementDescriptor] - The statement descriptor of the payment intent.
     * @param {Object} [data.metadata] - The metadata object to attach to the payment intent.
     * @param {string} [data.captureType=automatic] - The capture type of the payment intent.
     * @param {Object} user - The user object containing the user ID and role.
     * @returns {Object} Response data with status, error, and paymentIntent on success.
     */
    createPaymentIntent: async (dbHelper, id, data, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error creating payment intent',
        };
        let reservationId = null;
        try {
            reservationId = id || data?.reservationId || null;
            const {
                amount: clientAmount,
                currency = 'PHP',
                paymentMethodAllowed = ['card', 'gcash', 'grab_pay', 'paymaya', 'dbp',],
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
                if (!requesterUserId || String(reservation.userId) !== String(requesterUserId) && user?.role !== UserRole.SUPERINTENDENT && user?.role !== UserRole.ACCOUNTING) {
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
     * Attaches a payment method to a payment intent.
     * @param {Object} dbHelper The database helper for database operations.
     * @param {Object} data - The data object containing the payment method data.
     * @param {string} data.paymentIntentId - The ID of the payment intent to attach the payment method to.
     * @param {string} data.paymentMethodId - The ID of the payment method to attach.
     * @param {string} [data.returnUrl] - The URL to return to after the payment method attachment is successful.
     * @param {string} [data.paymentMethodType] - The type of payment method being attached.
     * @returns {Object} Response data with status, error, and updated paymentIntent.
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

            try {
                await dbHelper.findOneAndUpdate('payment', { piId: intent.id, }, {
                    $set: {
                        status: intent?.attributes?.status,
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
     * Retrieves a payment intent by its ID.
     * @param {Object} dbHelper The database helper for database operations.
     * @param {string} id The ID of the payment intent to retrieve.
     * @returns {Object} Response data with status, error, and paymentIntent.
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
     * Creates a payment method.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {Object} data - The data object containing the payment method data.
     * @param {string} data.type - The type of payment method to create.
     * @param {Object} [data.details] - The payment method details, required for non-redirect payment methods.
     * @param {Object} [data.billing] - The billing information for the payment method.
     * @returns {Object} Response data with status, error, and paymentMethod.
     */
    createPaymentMethod: async (dbHelper, data) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error creating payment method',
        };
        try {
            const { type, details, billing, } = data || {};
            const redirectTypes = new Set(['gcash', 'grab_pay', 'paymaya', 'dbp',]);

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
     * Handle PayMongo webhook events.
     * @param {import('../db-helper')} dbHelper - DB helper for persisting payment data.
     * @param {Record<string, string>} headers - Request headers.
     * @param {string|Object} body - Request body.
     * @returns {Promise<{ status: number, error: string|null, event: Object, updatedReservation?: { _id: ObjectId, status: ReservationStatus }, note?: string }>} Response data.
     */
    handleWebhook: async (dbHelper, headers, body) => {
    const responseData = { status: Status.INTERNAL_SERVER_ERROR, error: 'Error handling webhook' };
    try {
        const secret = process.env.PAYMONGO_WEBHOOK_SECRET;

        let rawBody;
            if (Buffer.isBuffer(body)) rawBody = body.toString('utf8');
            else if (typeof body === 'string') rawBody = body;
            else rawBody = JSON.stringify(body || {});

            const signatureHeader = headers?.['paymongo-signature']; 
            if (process.env.PAYMONGO_WEBHOOK_SECRET && signatureHeader && rawBody) {
            const computed = crypto.createHmac('sha256', process.env.PAYMONGO_WEBHOOK_SECRET)
                                    .update(rawBody).digest('hex');
            if (!signatureHeader.includes(computed)) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'Invalid webhook signature';
                return responseData;
            }
        }

            const event = JSON.parse(rawBody);
            const eventType = event?.data?.attributes?.type || event?.type || '';
            const resource = event?.data?.attributes?.data;
            const resourceType = resource?.type;
            const resourceStatus = resource?.attributes?.status;
            let metadata = resource?.attributes?.metadata || {};
            let reservationId = metadata?.reservationId;
            let reservationUserId = null;

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
                    try {
                        const existingPI = await dbHelper.findOne('payment', { piId, });
                        if (existingPI?.reservationId) {
                            reservationId = String(existingPI.reservationId);
                            metadata = { ...metadata, userId: existingPI.userId ? String(existingPI.userId) : metadata?.userId, reservationId, };
                        }
                    } catch (_) { /* noop */ }

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
                        reservationUserId = reservation?.userId ? String(reservation.userId) : null;
                        let totalPaid = 0;
                        try {
                            const successfulStatuses = ['paid', 'succeeded',];
                            const paidRows = await dbHelper.findMany('payment', { reservationId, status: { $in: successfulStatuses, }, }, { sort: { createdAt: 1, }, });
                            totalPaid = (paidRows || []).reduce((acc, p) => acc + (Number(p.amountCentavos || 0) / 100), 0);
                        } catch (_) {}

                        const nextStatus = totalPaid > 0 ? ReservationStatus.CONFIRMED : reservation.status;

                        if (nextStatus !== reservation.status && nextStatus === ReservationStatus.CONFIRMED) {
                            // Check if arrival date is at least one month away before confirming
                            if (isAtLeastOneMonthAway(reservation.dateOfArrival)) {
                                updatedReservation = await dbHelper.findOneAndUpdate(
                                    'reservation',
                                    { _id: reservationId, },
                                    { status: nextStatus, }
                                );
                            } else {
                                console.warn(`Cannot confirm reservation ${reservationId}: arrival date is less than one month away`);
                            }
                        } else if (nextStatus !== reservation.status) {
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
            responseData.reservationId = reservationId ? String(reservationId) : null;   
            responseData.isPaid = !!isPaid;                       
            responseData.userId = reservationUserId;
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
     * Reconcile a payment intent by its ID.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {string} id - The ID of the payment intent to reconcile.
     * @param {Object} user - The user object containing the user ID and role.
     * @returns {Object} Response data with status, error, paymentIntent, and updatedReservation on success.
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

            const intentJson = await paymongoRequest('GET', `/payment_intents/${id}`);
            const intent = intentJson?.data;
            const intentStatus = intent?.attributes?.status;
            const meta = intent?.attributes?.metadata || {};
            let reservationId = meta?.reservationId || null;

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

            const requesterUserId = user?.userId;
            if (!requesterUserId || String(reservation.userId) !== String(requesterUserId)) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'Not allowed to reconcile this reservation';
                return responseData;
            }

            const reservationUserId = reservation?.userId ? String(reservation.userId) : null;

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

            let updatedReservation = null;
            const normalizedStatus = String(intentStatus || '').toLowerCase();
            const succeeded = normalizedStatus === 'succeeded';

            if (succeeded) {
                try {
                    const successfulStatuses = ['paid', 'succeeded',];
                    const paidRows = await dbHelper.findMany('payment', { reservationId, status: { $in: successfulStatuses, }, }, { sort: { createdAt: 1, }, });
                    const totalPaid = (paidRows || []).reduce((acc, p) => acc + (Number(p.amountCentavos || 0) / 100), 0);
                    if (totalPaid > 0 && reservation.status !== ReservationStatus.CONFIRMED) {
                        // Check if arrival date is at least one month away before confirming
                        if (isAtLeastOneMonthAway(reservation.dateOfArrival)) {
                            updatedReservation = await dbHelper.findOneAndUpdate('reservation', { _id: reservationId, }, { status: ReservationStatus.CONFIRMED, });
                        } else {
                            console.warn(`Cannot confirm reservation ${reservationId}: arrival date is less than one month away`);
                        }
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
            responseData.reservationId = reservationId ? String(reservationId) : null;
            responseData.userId = reservationUserId;
            responseData.isPaid = succeeded;

            return responseData;
        } catch (error) {
            console.error('Error reconciling payment intent:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error reconciling payment intent';
            return responseData;
        }
    },

    /**
     * Retrieves a list of payments for a given reservation ID.
     * @param {Object} dbHelper The database helper for database operations.
     * @param {string} reservationId The ID of the reservation to fetch payments for.
     * @param {Object} user The user object containing the user ID and role.
     * @returns {Object} Response data with status, error, and data containing the list of payments.
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
            if (String(reservation.userId) !== String(user.userId) && user.role !== UserRole.SUPERINTENDENT && user.role !== UserRole.ACCOUNTING && user.role !== UserRole.FRONTDESK) {
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
     * Computes the payment summary for a given reservation ID.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {string} reservationId - The ID of the reservation to compute the summary for.
     * @param {Object} user - The user object containing the user ID and role.
     * @returns {Object} Response data with status, error, and payment summary on success.
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
            if (String(reservation.userId) !== String(user.userId) && user.role !== UserRole.SUPERINTENDENT && user.role !== UserRole.ACCOUNTING && user.role !== UserRole.FRONTDESK) {
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

            const downpaymentAmount = calculateConfirmationFee(reservation.category, total);
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

    /**
     * Returns a transaction view for a given reservation ID.
     * @param dbHelper The database helper
     * @param reservationId The reservation ID
     * @param user The user object of the request sender
     * @returns A response object containing the transaction view or an error message
     */
    getTransactionDetails: async (dbHelper, reservationId, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error getting transaction view',
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

            if (user.role !== UserRole.SUPERINTENDENT && user.role !== UserRole.ACCOUNTING && user.role !== UserRole.FRONTDESK && String(reservation.userId) !== String(user.userId)) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'You are not authorized to view this transaction.';
                return responseData;
            }

            const [facility, reservationUser, payments, summaryRaw,] = await Promise.all([
                reservation?.facility ? dbHelper.findOne('facility', { _id: reservation.facility, }) : null,
                reservation?.userId ? dbHelper.findOne('user', { _id: reservation.userId, }) : null,
                dbHelper.findMany(
                    'payment',
                    { reservationId, },
                    { sort: { createdAt: -1, }, }
                ),

                (async () => {
                    const total = Number(reservation.totalEstimatedAmount) || 0;
                    const successfulStatuses = ['paid', 'succeeded',];
                    const paidRows = await dbHelper.findMany(
                        'payment',
                        { reservationId, status: { $in: successfulStatuses, }, },
                        { sort: { createdAt: 1, }, }
                    );
                    // Round totalPaid to avoid floating-point precision issues during accumulation
                    const totalPaid = Math.round((paidRows || []).reduce((acc, p) => acc + (Number(p.amountCentavos || 0) / 100), 0) * 100) / 100;

                    const createdAt = reservation.createdAt ? new Date(reservation.createdAt) : new Date();
                    const arrival = reservation.dateOfArrival ? new Date(reservation.dateOfArrival) : null;

                    const due = new Date(createdAt);
                    due.setDate(due.getDate() + DUE_IN_DAYS);
                    if (arrival && !Number.isNaN(arrival.getTime())) {
                        const lastDay = new Date(arrival);
                        lastDay.setDate(arrival.getDate() - 1);
                        if (due > lastDay) due.setTime(lastDay.getTime());
                    }

                    const downpaymentAmount = calculateConfirmationFee(reservation.category, total);

                    return {
                        downpaymentAmount,
                        dueDate: due.toISOString(),
                        totalPaid,
                    };
                })(),
            ]);

            const successful = (payments || []).filter((p) => ['paid', 'succeeded',].includes((p.status || '').toLowerCase()));
            const latest = successful[0] || null;

            // Only show payment method and date for successful payments
            // For transaction date, use paidAt if available, otherwise fall back to first payment's createdAt, or reservation's createdAt
            // Payments are sorted descending (newest first), so the last element is the oldest (first payment attempt)
            const firstPayment = payments && payments.length > 0 ? payments[payments.length - 1] : null;
            const dateIso = latest?.paidAt || firstPayment?.createdAt || reservation?.createdAt || null;
            const paymentMethod = latest?.paymentMethodType || null;
            const referenceNumber = latest?.referenceNumber || null;

            // Calculate report details
            const facilityName = facility?.name || facility?.label || 'N/A';
            
            // Use checkedInAt if available (actual check-in date), otherwise fall back to dateOfArrival (scheduled)
            const checkInDate = reservation.checkedInAt || reservation.dateOfArrival;
            const checkInFormatted = checkInDate ? fmtDate(checkInDate) : 'N/A';
            const checkOutFormatted = reservation.dateOfDeparture ? fmtDate(reservation.dateOfDeparture) : 'N/A';
            
            // Calculate number of nights
            const nights = (reservation.dateOfArrival && reservation.dateOfDeparture)
                ? Math.max(0, Math.ceil((new Date(reservation.dateOfDeparture) - new Date(reservation.dateOfArrival)) / (1000 * 60 * 60 * 24)))
                : 0;
            
            // Calculate number of guests
            const numGuests = reservation?.numberOfGuests?.total ?? (
                (reservation?.numberOfGuests?.adult ?? 0) +
                (reservation?.numberOfGuests?.children ?? 0) +
                (reservation?.numberOfGuests?.pwds ?? 0) +
                (reservation?.numberOfGuests?.seniorCitizen ?? reservation?.numberOfGuests?.seniorCitizens ?? 0)
            );
            
            // Determine category
            const isDepEd = reservation.category === Category.DEPED;
            const isPrivate = reservation.category === Category.PRIVATE;
            const category = isDepEd ? 'DepEd' : (isPrivate ? 'Private' : 'Non-DepEd');
            
            // Get contact number (try multiple fields)
            const contact = reservation.telephone || reservation.contactNo || reservation.contactNumber || 
                           reservation.mobile || reservation.phoneNumber || reservation.phone || 'N/A';
            
            // Get address
            const address = reservation.homeAddress || 'N/A';
            
            // Get check-out employee
            const checkOutEmployee = reservation.checkOutEmployee || reservation.checkedOutBy || reservation.coEmployee || 'N/A';

            // Calculate breakdown, addons, service fee, discount, and total
            const breakdown = [];
            const addons = [];

            // Calculate addonsTotal from reservation add-ons
            let addonsTotal = 0;
            const serviceIds = []
                .concat(reservation?.addOns || [])
                .concat(reservation?.specialService ? [reservation.specialService,] : [])
                .filter(Boolean);

            let services = [];
            if (serviceIds.length) {
                services = await dbHelper.findMany(
                    'addon',
                    { _id: { $in: serviceIds.map(String), }, },
                    { projection: { _id: 1, price: 1, name: 1, unit: 1, }, }
                );
                addonsTotal = services.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
            }

            // Calculate discount and service fee information using shared computeEstimate logic
            let discountInfo = {
                label: 'None',
                amount: '₱0.00',
                percentage: '0%'
            };
            let serviceFeeInfo = {
                label: 'None',
                amount: '₱0.00',
                percentage: '0%'
            };

            let estimateResult = null;
            if (facility && reservation.category) {
                estimateResult = computeEstimate({
                    facilityDoc: facility,
                    adults: reservation?.numberOfGuests?.adult || 0,
                    children: reservation?.numberOfGuests?.children || 0,
                    pwds: reservation?.numberOfGuests?.pwds || 0,
                    seniorCitizens: reservation?.numberOfGuests?.seniorCitizens || 0,
                    serviceType: reservation?.serviceType,
                    addonsTotal: addonsTotal,
                    category: reservation?.category,
                    dateOfArrival: reservation?.dateOfArrival,
                    dateOfDeparture: reservation?.dateOfDeparture,
                    timeOfArrival: reservation?.timeOfArrival,
                });
                
                breakdown.push({
                    label: facility.name,
                    amount: fmtAmountOnly(estimateResult.baseAmount - addonsTotal),
                });

                // Normalize category for comparison
                const normalizedReservationCategory = reservation.category ? String(reservation.category).trim() : '';
                
                // Always show service fee for categories that have it
                if (normalizedReservationCategory === Category.PRIVATE || normalizedReservationCategory === Category.GOVERNMENT || normalizedReservationCategory === Category.DEPED || normalizedReservationCategory === Category.PWDS) {
                    serviceFeeInfo = {
                        label: 'Service Fee',
                        amount: peso(estimateResult.serviceFee),
                        percentage: '10%'
                    };
                }

                if (estimateResult.discount > 0) {
                    discountInfo = {
                        label: `${reservation.category} Discount`,
                        amount: peso(estimateResult.discount),
                        percentage: normalizedReservationCategory === Category.GOVERNMENT || normalizedReservationCategory === Category.DEPED || normalizedReservationCategory === Category.PWDS ? '20%' : '0%'
                    };
                }
            } else if (facility) {
                // If no category, still calculate breakdown but no service fee/discount
                estimateResult = computeEstimate({
                    facilityDoc: facility,
                    adults: reservation?.numberOfGuests?.adult || 0,
                    children: reservation?.numberOfGuests?.children || 0,
                    pwds: reservation?.numberOfGuests?.pwds || 0,
                    seniorCitizens: reservation?.numberOfGuests?.seniorCitizens || 0,
                    serviceType: reservation?.serviceType,
                    addonsTotal: addonsTotal,
                    category: reservation?.category,
                    dateOfArrival: reservation?.dateOfArrival,
                    dateOfDeparture: reservation?.dateOfDeparture,
                    timeOfArrival: reservation?.timeOfArrival,
                });
                
                breakdown.push({
                    label: facility.name,
                    amount: fmtAmountOnly(estimateResult.baseAmount - addonsTotal),
                });
            }

            // Process add-ons for display (separate from breakdown)
            for (const s of services || []) {
                const addonItem = {
                    name: s.name,
                    price: fmtAmountOnly(Number(s.price) || 0),
                    unit: s.unit || 'per item'
                };
                addons.push(addonItem);
            }

            const totalEstimated = Number(reservation.totalEstimatedAmount) || 0;

            const view = {
                id: (reservation._id?.toString() || '').slice(-4) || 'N/A',
                referenceNumber: referenceNumber || (latest ? String(latest._id) : 'N/A'),
                name: reservationUser ? reservationUser.name : reservation.guestName || 'N/A',
                confirmationFee: peso(summaryRaw?.downpaymentAmount ?? 0),
                paymentDue: summaryRaw?.dueDate ? fmtDate(summaryRaw.dueDate) : 'N/A',
                date: dateIso ? fmtDate(dateIso) : 'N/A',
                paymentMethod: paymentMethod ? methodLabel(paymentMethod) : 'N/A',
                status: (() => {
                    // First check if admin has set payment status to "Fully Paid"
                    if (reservation.paymentStatus === 'Fully Paid') {
                        return 'Fully Paid';
                    }
                    
                    const total = Number(reservation.totalEstimatedAmount) || 0;
                    const totalPaid = Number(summaryRaw?.totalPaid || 0);
                    if (totalPaid <= 0) return 'Not Paid';
                    // Use remaining balance calculation to account for floating-point precision issues
                    const remainingBalance = Math.max(0, Math.round((total - totalPaid) * 100) / 100);
                    if (remainingBalance <= 0) return 'Fully Paid';
                    return 'Partially Paid';
                })(),
                // Report details
                reservationCode: reservation.reservationCode || 'N/A',
                facilityUsed: facilityName,
                checkInDate: checkInFormatted,
                checkOutDate: checkOutFormatted,
                numberOfNights: nights,
                numberOfGuests: numGuests,
                category: category,
                checkOutEmployee: checkOutEmployee,
                contactNumber: contact,
                address: address,
                // Payment breakdown details
                breakdown,
                addons,
                serviceFee: serviceFeeInfo.label,
                serviceFeeAmount: serviceFeeInfo.amount,
                serviceFeePercentage: serviceFeeInfo.percentage,
                discount: discountInfo.label,
                discountAmount: discountInfo.amount,
                discountPercentage: discountInfo.percentage,
                total: peso(totalEstimated, true),
            };

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.data = view;
            return responseData;

        } catch (err) {
            console.error('Error getting transaction view:', err);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error getting transaction view';
            return responseData;
        }
    },

    /**
     * Retrieves a payment details view for a given reservation ID.
     * @param {Object} dbHelper The database helper for database operations.
     * @param {string} reservationId The ID of the reservation to fetch payments for.
     * @param {Object} user The user object containing the user ID and role.
     * @returns {Object} Response data with status, error, and data containing the payment details view.
     */
    getPaymentDetails: async (dbHelper, reservationId, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error getting payment details view',
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

            if (user.role !== UserRole.SUPERINTENDENT && user.role !== UserRole.ACCOUNTING && user.role !== UserRole.FRONTDESK && String(reservation.userId) !== String(user.userId)) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'You are not authorized to view this payment.';
                return responseData;
            }

            const [facility, reservationUser, payments,] = await Promise.all([
                reservation?.facility ? dbHelper.findOne('facility', { _id: reservation.facility, }) : null,
                reservation?.userId ? dbHelper.findOne('user', { _id: reservation.userId, }) : null,
                dbHelper.findMany('payment', { reservationId, }, { sort: { createdAt: -1, }, }),
            ]);

            const breakdown = [];
            const addons = [];

            // Calculate addonsTotal from reservation add-ons
            let addonsTotal = 0;
            const serviceIds = []
                .concat(reservation?.addOns || [])
                .concat(reservation?.specialService ? [reservation.specialService,] : [])
                .filter(Boolean);

            let services = [];
            if (serviceIds.length) {
                services = await dbHelper.findMany(
                    'addon',
                    { _id: { $in: serviceIds.map(String), }, },
                    { projection: { _id: 1, price: 1, name: 1, unit: 1, }, }
                );
                addonsTotal = services.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
            }

            if (facility) {
                const estimateResult = computeEstimate({
                    facilityDoc: facility,
                    adults: reservation?.numberOfGuests?.adult || 0,
                    children: reservation?.numberOfGuests?.children || 0,
                    pwds: reservation?.numberOfGuests?.pwds || 0,
                    seniorCitizens: reservation?.numberOfGuests?.seniorCitizens || 0,
                    serviceType: reservation?.serviceType,
                    addonsTotal: addonsTotal,
                    category: reservation?.category,
                    dateOfArrival: reservation?.dateOfArrival,
                    dateOfDeparture: reservation?.dateOfDeparture,
                    timeOfArrival: reservation?.timeOfArrival,
                });
                
                breakdown.push({
                    label: facility.name,
                    amount: fmtAmountOnly(estimateResult.baseAmount - addonsTotal),
                });
            }

            // Process add-ons for display (separate from breakdown)
            for (const s of services || []) {
                const addonItem = {
                    name: s.name,
                    price: fmtAmountOnly(Number(s.price) || 0),
                    unit: s.unit || 'per item'
                };
                addons.push(addonItem);
                // Note: Add-ons are NOT added to breakdown to avoid redundancy
            }

            const totalEstimated = Number(reservation.totalEstimatedAmount) || 0;
            const successfulStatuses = ['paid', 'succeeded',];
            const successful = (payments || []).filter((p) =>
                successfulStatuses.includes(String(p.status || '').toLowerCase())
            );
            // Round totalPaid to avoid floating-point precision issues during accumulation
            const totalPaid = Math.round(successful.reduce((acc, p) => acc + (Number(p.amountCentavos || 0) / 100), 0) * 100) / 100;

            const confirmationFee = calculateConfirmationFee(reservation.category, totalEstimated);

            // Use remaining balance calculation to account for floating-point precision issues
            const remainingBalance = Math.max(0, Math.round((totalEstimated - totalPaid) * 100) / 100);
            // If total is 0 or less, consider it fully paid (no payment needed)
            // Otherwise, check payment status based on remaining balance
            const status =
            totalEstimated <= 0 ? 'Fully Paid' :
            remainingBalance <= 0 ? 'Fully Paid' :
            totalPaid <= 0 ? 'Not Paid' : 'Partially Paid';

            const latestSuccessful = successful[0] || null;
            const latestAny = (payments && payments[0]) || null;
            const referenceNumber =
                latestSuccessful?._id?.toString() ||
                latestAny?._id?.toString() ||
                reservation.referenceNumber ||
                reservation.reservationCode ||
                'N/A';

            // Fetch client's payment proof (reference number and proof of payment file)
            let clientReferenceNumber = null;
            let clientProofOfPaymentUrl = null;
            
            // Find the latest payment with proof of payment (prefer successful payments)
            const paymentWithProof = 
                (successful || []).find(p => p.proofOfPaymentFileId) || 
                (payments || []).find(p => p.proofOfPaymentFileId) || 
                null;
            
            if (paymentWithProof) {
                // Get reference number from the payment
                clientReferenceNumber = paymentWithProof.referenceNumber || null;
                
                // Fetch the proof of payment file and generate signed URL
                try {
                    const proofFile = await dbHelper.findOne('file', { 
                        _id: paymentWithProof.proofOfPaymentFileId 
                    });
                    
                    if (proofFile?.path) {
                        try {
                            const [signedUrl] = await bucket.file(proofFile.path).getSignedUrl({
                                version: 'v4',
                                expires: Date.now() + 1000 * 60 * 60, // 1 hour expiry
                                action: 'read',
                            });
                            clientProofOfPaymentUrl = signedUrl;
                        } catch (urlError) {
                            console.warn('Error generating signed URL for proof of payment:', urlError);
                        }
                    }
                } catch (fileError) {
                    console.warn('Error fetching proof of payment file:', fileError);
                }
            }

            // Fetch invoice file and generate signed URL
            let invoiceImageUrl = null;
            if (reservation.invoiceFileId) {
                try {
                    const invoiceFile = await dbHelper.findOne('file', { 
                        _id: reservation.invoiceFileId 
                    });
                    
                    if (invoiceFile?.path) {
                        try {
                            const [signedUrl] = await bucket.file(invoiceFile.path).getSignedUrl({
                                version: 'v4',
                                expires: Date.now() + 1000 * 60 * 60, // 1 hour expiry
                                action: 'read',
                            });
                            invoiceImageUrl = signedUrl;
                        } catch (urlError) {
                            console.warn('Error generating signed URL for invoice:', urlError);
                        }
                    }
                } catch (fileError) {
                    console.warn('Error fetching invoice file:', fileError);
                }
            }

            // Calculate discount and service fee information using shared computeEstimate logic
            let discountInfo = {
                label: 'None',
                amount: '₱0.00',
                percentage: '0%'
            };
            let serviceFeeInfo = {
                label: 'None',
                amount: '₱0.00',
                percentage: '0%'
            };

            if (facility && reservation.category) {
                const estimateResult = computeEstimate({
                    facilityDoc: facility,
                    adults: reservation?.numberOfGuests?.adult || 0,
                    children: reservation?.numberOfGuests?.children || 0,
                    pwds: reservation?.numberOfGuests?.pwds || 0,
                    seniorCitizens: reservation?.numberOfGuests?.seniorCitizens || 0,
                    serviceType: reservation?.serviceType,
                    addonsTotal: addonsTotal,
                    category: reservation?.category,
                    dateOfArrival: reservation?.dateOfArrival,
                    dateOfDeparture: reservation?.dateOfDeparture,
                    timeOfArrival: reservation?.timeOfArrival,
                });

                // Normalize category for comparison
                const normalizedReservationCategory = reservation.category ? String(reservation.category).trim() : '';
                
                // Always show service fee for categories that have it
                if (normalizedReservationCategory === Category.PRIVATE || normalizedReservationCategory === Category.GOVERNMENT || normalizedReservationCategory === Category.DEPED || normalizedReservationCategory === Category.PWDS) {
                    serviceFeeInfo = {
                        label: 'Service Fee',
                        amount: peso(estimateResult.serviceFee),
                        percentage: '10%'
                    };
                }

                if (estimateResult.discount > 0) {
                    discountInfo = {
                        label: `${reservation.category} Discount`,
                        amount: peso(estimateResult.discount),
                        percentage: normalizedReservationCategory === Category.GOVERNMENT || normalizedReservationCategory === Category.DEPED || normalizedReservationCategory === Category.PWDS ? '20%' : '0%'
                    };
                }
            }

            // Get excess data from reservation or facility
            const isEventReservation = reservation.serviceType === ServiceType.EVENT || reservation.serviceType === ServiceType.EVENT_AND_LODGING;
            const isCottage = facility?.facilityType === FacilityType.COTTAGE;
            let excessCapacity = null;
            let excessWithBeddings = null;
            let excessWithoutBeddings = null;

            if (isEventReservation) {
                // Event/Conference - use excessCapacity
                const count = reservation.excessCapacity?.count || 0;
                const rate = reservation.excessCapacity?.rate || (facility?.ratePerExcessCapacity || 0);
                excessCapacity = { count, rate };
            } else if (isCottage) {
                // Cottage - use excessWithBeddings and excessWithoutBeddings
                const withBeddingsCount = reservation.excessWithBeddings?.count || 0;
                const withBeddingsRate = reservation.excessWithBeddings?.rate || (facility?.ratePerExcessWithBeddings || 0);
                excessWithBeddings = { count: withBeddingsCount, rate: withBeddingsRate };

                const withoutBeddingsCount = reservation.excessWithoutBeddings?.count || 0;
                const withoutBeddingsRate = reservation.excessWithoutBeddings?.rate || (facility?.ratePerExcessWithoutBeddings || 0);
                excessWithoutBeddings = { count: withoutBeddingsCount, rate: withoutBeddingsRate };
            } else {
                // Other facilities (Conference with Lodging, Dormitory) - use excessCapacity
                const count = reservation.excessCapacity?.count || 0;
                const rate = reservation.excessCapacity?.rate || (facility?.ratePerExcessCapacity || 0);
                excessCapacity = { count, rate };
            }

            const view = {
                id: (reservation._id?.toString()),
                referenceNumber,
                name: reservationUser?.name || reservation.guestName || 'N/A',
                confirmationFee: peso(confirmationFee),             
                breakdown,                                          
                addons,
                serviceFee: serviceFeeInfo.label,                                   
                serviceFeeAmount: serviceFeeInfo.amount,
                serviceFeePercentage: serviceFeeInfo.percentage,
                discount: discountInfo.label,                                   
                discountAmount: discountInfo.amount,
                discountPercentage: discountInfo.percentage,
                total: peso(totalEstimated, true),                  
                status,
                clientReferenceNumber: clientReferenceNumber || null,
                clientProofOfPaymentUrl: clientProofOfPaymentUrl || null,
                invoiceNumber: reservation.invoiceNumber || null,
                invoiceImageUrl: invoiceImageUrl || null,
                paymentStatus: reservation.paymentStatus || status,
                excessCapacity,
                excessWithBeddings,
                excessWithoutBeddings,
                serviceType: reservation.serviceType,
                facilityType: facility?.facilityType || null,
            };

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.data = view;

            return responseData;
        } catch (err) {
            console.error('Error getting payment details view:', err);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error getting payment details view';
            return responseData;
        }
    },

    /**
     * Submits a manual payment with reference number and proof of payment file.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {string} reservationId - The ID of the reservation.
     * @param {Object} data - The payment data.
     * @param {number} data.amount - The payment amount.
     * @param {string} data.referenceNumber - The transaction reference number.
     * @param {string} data.paymentMethodType - The payment method type (e.g., 'gcash', 'grab_pay', 'dbp').
     * @param {Object} proofOfPaymentFile - The proof of payment file (multer file object).
     * @param {Object} user - The user object containing the user ID and role.
     * @returns {Object} Response data with status, error, and payment on success.
     */
    submitManualPayment: async (dbHelper, reservationId, data, proofOfPaymentFile, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error submitting manual payment',
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

            const { amount, referenceNumber, paymentMethodType, ocrExtractedReferenceNumber } = data || {};

            if (!amount || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Valid positive amount is required';
                return responseData;
            }

            if (!referenceNumber || !String(referenceNumber).trim()) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Reference number is required';
                return responseData;
            }

            if (!proofOfPaymentFile) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Proof of payment file is required';
                return responseData;
            }

            // Validate reservation
            const reservation = await dbHelper.findOne('reservation', { _id: reservationId });
            if (!reservation) {
                responseData.status = Status.NOT_FOUND;
                responseData.error = 'Reservation not found';
                return responseData;
            }

            // Allow payment submission for any reservation status
            // Only check that user owns the reservation or is admin
            const requesterUserId = user.userId;
            if (String(reservation.userId) !== String(requesterUserId) && 
                user.role !== UserRole.SUPERINTENDENT && 
                user.role !== UserRole.ACCOUNTING) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'Not allowed to submit payment for this reservation';
                return responseData;
            }

            // Validate amount doesn't exceed total
            const maxAmount = Number(reservation.totalEstimatedAmount) || 0;
            const paymentAmount = Number(amount);
            if (paymentAmount > maxAmount) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Amount exceeds reservation total';
                return responseData;
            }

            // Upload proof of payment file
            let proofOfPaymentFileDoc = null;
            try {
                const filename = `proof_of_payment/${Date.now()}_${proofOfPaymentFile.originalname.replace(/\s/g, '_')}`;
                const blob = bucket.file(filename);
                await new Promise((resolve, reject) => {
                    const stream = blob.createWriteStream({
                        resumable: false,
                        contentType: proofOfPaymentFile.mimetype,
                    });
                    stream.on('error', reject);
                    stream.on('finish', resolve);
                    stream.end(proofOfPaymentFile.buffer);
                });

                proofOfPaymentFileDoc = await dbHelper.create('file', {
                    path: filename,
                    mimetype: proofOfPaymentFile.mimetype,
                    size: proofOfPaymentFile.size,
                    kind: FileKind.PROOF_OF_PAYMENT,
                    userId: user.userId,
                    reservationId: reservationId,
                    createdAt: new Date(),
                });
            } catch (err) {
                console.error('Error uploading proof of payment file:', err);
                responseData.status = Status.INTERNAL_SERVER_ERROR;
                responseData.error = 'Proof of payment upload failed: ' + err.message;
                return responseData;
            }

            // Check for reference number mismatch if OCR extracted reference number is provided
            let referenceNumberMismatch = false;
            if (ocrExtractedReferenceNumber && referenceNumber) {
                const normalize = (str) => String(str || '').trim().toUpperCase().replace(/[\s-]/g, '');
                const normalizedEntered = normalize(referenceNumber);
                const normalizedExtracted = normalize(ocrExtractedReferenceNumber);
                referenceNumberMismatch = normalizedEntered !== normalizedExtracted;
            }

            // Create payment record with status 'paid' (manual payment submitted)
            const amountCentavos = toCentavos(paymentAmount);
            const now = new Date();
            const paymentDoc = await dbHelper.create('payment', {
                reservationId: reservationId,
                userId: user.userId,
                amountCentavos: amountCentavos,
                currency: 'PHP',
                description: `Manual payment for reservation ${reservationId}`,
                status: 'paid', // Manual payment submitted
                paymentMethodType: paymentMethodType || 'manual',
                referenceNumber: String(referenceNumber).trim(),
                ocrExtractedReferenceNumber: ocrExtractedReferenceNumber ? String(ocrExtractedReferenceNumber).trim() : undefined,
                referenceNumberMismatch: referenceNumberMismatch,
                proofOfPaymentFileId: proofOfPaymentFileDoc._id,
                createdAt: now,
                updatedAt: now,
                paidAt: now,
            });

            // Calculate total paid and confirm reservation if payment > 0
            // No status check - confirm immediately when payment is submitted
            let updatedReservation = null;
            try {
                const successfulStatuses = ['paid', 'succeeded',];
                const paidRows = await dbHelper.findMany('payment', { reservationId, status: { $in: successfulStatuses, }, }, { sort: { createdAt: 1, }, });
                const totalPaid = (paidRows || []).reduce((acc, p) => acc + (Number(p.amountCentavos || 0) / 100), 0);
                
                // Confirm reservation immediately when payment is submitted (no status or date restrictions)
                if (totalPaid > 0 && reservation.status !== ReservationStatus.CONFIRMED) {
                    updatedReservation = await dbHelper.findOneAndUpdate('reservation', { _id: reservationId, }, { status: ReservationStatus.CONFIRMED, });
                }
            } catch (confirmErr) {
                console.error('Failed to confirm reservation after payment submission:', confirmErr);
                // Don't fail the payment submission if confirmation fails
            }

            responseData.status = Status.CREATED;
            responseData.error = null;
            responseData.payment = {
                _id: paymentDoc._id,
                reservationId: String(paymentDoc.reservationId),
                amountCentavos: paymentDoc.amountCentavos,
                currency: paymentDoc.currency,
                status: paymentDoc.status,
                paymentMethodType: paymentDoc.paymentMethodType,
                referenceNumber: paymentDoc.referenceNumber,
                createdAt: paymentDoc.createdAt,
            };
            
            if (updatedReservation) {
                responseData.updatedReservation = {
                    _id: updatedReservation._id,
                    status: updatedReservation.status,
                };
            }

            return responseData;
        } catch (error) {
            console.error('Error submitting manual payment:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error submitting manual payment';
            return responseData;
        }
    },

    /**
     * Updates payment status and invoice information for a reservation.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {string} reservationId - The ID of the reservation.
     * @param {Object} data - The payment data.
     * @param {string} data.invoiceNumber - The invoice number.
     * @param {string} data.paymentStatus - The payment status (Unpaid, Partially Paid, Fully Paid).
     * @param {string} [data.invoiceFileId] - The invoice file ID (optional).
     * @param {Object} user - The user object containing the user ID and role.
     * @returns {Object} Response data with status, error, and updated reservation on success.
     */
    updatePaymentStatus: async (dbHelper, reservationId, data, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error updating payment status',
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

            // Only allow ACCOUNTING role to update payment status
            if (user.role !== UserRole.ACCOUNTING) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'Not authorized to update payment status';
                return responseData;
            }

            const { 
                invoiceNumber, 
                paymentStatus, 
                invoiceFileId,
                excessCapacityCount,
                excessWithBeddingsCount,
                excessWithoutBeddingsCount,
            } = data || {};

            if (!invoiceNumber || !String(invoiceNumber).trim()) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invoice number is required';
                return responseData;
            }

            if (!paymentStatus || !String(paymentStatus).trim()) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Payment status is required';
                return responseData;
            }

            // Validate payment status
            const validStatuses = ['Unpaid', 'Partially Paid', 'Fully Paid'];
            if (!validStatuses.includes(paymentStatus)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid payment status. Must be one of: Unpaid, Partially Paid, Fully Paid';
                return responseData;
            }

            // Validate reservation exists
            const reservation = await dbHelper.findOne('reservation', { _id: reservationId });
            if (!reservation) {
                responseData.status = Status.NOT_FOUND;
                responseData.error = 'Reservation not found';
                return responseData;
            }

            // Get facility for excess rate defaults and recalculation
            const facility = reservation.facility 
                ? await dbHelper.findOne('facility', { _id: reservation.facility })
                : null;

            // Update reservation with invoice information and excess data
            const updateData = {
                invoiceNumber: String(invoiceNumber).trim(),
                paymentStatus: String(paymentStatus).trim(),
            };

            if (invoiceFileId) {
                updateData.invoiceFileId = invoiceFileId;
            }

            // Handle excess data based on facility type and service type
            const isEventReservation = reservation.serviceType === ServiceType.EVENT || reservation.serviceType === ServiceType.EVENT_AND_LODGING;
            const isCottage = facility?.facilityType === FacilityType.COTTAGE;
            
            if (isEventReservation || !isCottage) {
                // Event/Conference or non-Cottage facilities - handle excessCapacity (only count, rate comes from facility)
                if (excessCapacityCount !== undefined) {
                    updateData['excessCapacity.count'] = Math.max(0, parseInt(excessCapacityCount) || 0);
                }
            } else if (isCottage) {
                // Cottage - handle excessWithBeddings and excessWithoutBeddings (only counts, rates come from facility)
                if (excessWithBeddingsCount !== undefined) {
                    updateData['excessWithBeddings.count'] = Math.max(0, parseInt(excessWithBeddingsCount) || 0);
                }

                if (excessWithoutBeddingsCount !== undefined) {
                    updateData['excessWithoutBeddings.count'] = Math.max(0, parseInt(excessWithoutBeddingsCount) || 0);
                }
            }

            // Recalculate totalEstimatedAmount if excess data changed
            let newTotalEstimatedAmount = reservation.totalEstimatedAmount;
            if (facility && (
                excessCapacityCount !== undefined ||
                excessWithBeddingsCount !== undefined ||
                excessWithoutBeddingsCount !== undefined
            )) {
                // Get current excess values (after update) - rates always come from facility
                const isCottage = facility.facilityType === FacilityType.COTTAGE;
                
                let finalExcessCapacityCount = 0;
                let finalExcessCapacityRate = 0;
                let finalExcessWithBeddingsCount = 0;
                let finalExcessWithBeddingsRate = 0;
                let finalExcessWithoutBeddingsCount = 0;
                let finalExcessWithoutBeddingsRate = 0;

                if (isEventReservation || !isCottage) {
                    // Event/Conference or non-Cottage facilities
                    finalExcessCapacityCount = excessCapacityCount !== undefined 
                        ? Math.max(0, parseInt(excessCapacityCount) || 0)
                        : (reservation.excessCapacity?.count || 0);
                    finalExcessCapacityRate = facility.ratePerExcessCapacity || 0;
                } else if (isCottage) {
                    // Cottage facilities
                    finalExcessWithBeddingsCount = excessWithBeddingsCount !== undefined
                        ? Math.max(0, parseInt(excessWithBeddingsCount) || 0)
                        : (reservation.excessWithBeddings?.count || 0);
                    finalExcessWithBeddingsRate = facility.ratePerExcessWithBeddings || 0;

                    finalExcessWithoutBeddingsCount = excessWithoutBeddingsCount !== undefined
                        ? Math.max(0, parseInt(excessWithoutBeddingsCount) || 0)
                        : (reservation.excessWithoutBeddings?.count || 0);
                    finalExcessWithoutBeddingsRate = facility.ratePerExcessWithoutBeddings || 0;
                }

                // Calculate base estimate (without excess)
                const estimateResult = computeEstimate({
                    facilityDoc: facility,
                    adults: reservation.numberOfGuests?.adult || 0,
                    children: reservation.numberOfGuests?.children || 0,
                    pwds: reservation.numberOfGuests?.pwds || 0,
                    seniorCitizens: reservation.numberOfGuests?.seniorCitizens || 0,
                    serviceType: reservation.serviceType,
                    addonsTotal: 0, // Will add addons separately
                    category: reservation.category,
                    dateOfArrival: reservation.dateOfArrival,
                    dateOfDeparture: reservation.dateOfDeparture,
                    timeOfArrival: reservation.timeOfArrival,
                });

                // Calculate addons total
                let addonsTotal = 0;
                const serviceIds = (reservation.addOns || []).filter(Boolean);
                if (serviceIds.length) {
                    const services = await dbHelper.findMany(
                        'addon',
                        { _id: { $in: serviceIds.map(String) } },
                        { projection: { price: 1 } }
                    );
                    addonsTotal = services.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
                }

                // Calculate excess charges
                let excessCharges = 0;
                if (isEventReservation || !isCottage) {
                    excessCharges = finalExcessCapacityCount * finalExcessCapacityRate;
                } else if (isCottage) {
                    excessCharges = (finalExcessWithBeddingsCount * finalExcessWithBeddingsRate) +
                                   (finalExcessWithoutBeddingsCount * finalExcessWithoutBeddingsRate);
                }

                // Recalculate total: base amount + addons + excess charges
                const baseAmount = estimateResult.baseAmount;
                const totalWithAddons = baseAmount + addonsTotal;
                
                // Apply service fee and discount to base + addons (excess charges are added after)
                const normalizedCategory = reservation.category ? String(reservation.category).trim() : '';
                const hasServiceFee = normalizedCategory === Category.PRIVATE || 
                                    normalizedCategory === Category.GOVERNMENT || 
                                    normalizedCategory === Category.DEPED || 
                                    normalizedCategory === Category.PWDS;
                
                let amountAfterServiceFee = totalWithAddons;
                if (hasServiceFee) {
                    amountAfterServiceFee = totalWithAddons * 1.10;
                }

                // Apply discount
                let finalAmount = amountAfterServiceFee;
                if (estimateResult.discount > 0) {
                    finalAmount = amountAfterServiceFee * 0.80;
                }

                // Add excess charges (excess is not subject to service fee or discount)
                newTotalEstimatedAmount = finalAmount + excessCharges;
            }

            if (newTotalEstimatedAmount !== reservation.totalEstimatedAmount) {
                updateData.totalEstimatedAmount = newTotalEstimatedAmount;
            }

            const updatedReservation = await dbHelper.findOneAndUpdate(
                'reservation',
                { _id: reservationId },
                { $set: updateData }
            );

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.data = {
                reservationId: String(updatedReservation._id),
                invoiceNumber: updatedReservation.invoiceNumber,
                paymentStatus: updatedReservation.paymentStatus,
                invoiceFileId: updatedReservation.invoiceFileId,
            };

            return responseData;
        } catch (error) {
            console.error('Error updating payment status:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error updating payment status';
            return responseData;
        }
    },

    /**
     * Uploads an invoice image for a reservation.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {string} reservationId - The ID of the reservation.
     * @param {Object} invoiceFile - The invoice file (multer file object).
     * @param {Object} user - The user object containing the user ID and role.
     * @returns {Object} Response data with status, error, and invoiceImageUrl on success.
     */
    uploadInvoice: async (dbHelper, reservationId, invoiceFile, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error uploading invoice',
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

            // Only allow ACCOUNTING role to upload invoices
            if (user.role !== UserRole.ACCOUNTING) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'Not authorized to upload invoices';
                return responseData;
            }

            if (!invoiceFile) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invoice file is required';
                return responseData;
            }

            // Validate file type (should be an image)
            if (!invoiceFile.mimetype || !invoiceFile.mimetype.startsWith('image/')) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'File must be an image';
                return responseData;
            }

            // Validate reservation exists
            const reservation = await dbHelper.findOne('reservation', { _id: reservationId });
            if (!reservation) {
                responseData.status = Status.NOT_FOUND;
                responseData.error = 'Reservation not found';
                return responseData;
            }

            // Upload invoice image to Google Cloud Storage
            const filename = `invoices/${Date.now()}_${invoiceFile.originalname.replace(/\s/g, '_')}`;
            const blob = bucket.file(filename);
            
            await new Promise((resolve, reject) => {
                const stream = blob.createWriteStream({
                    resumable: false,
                    contentType: invoiceFile.mimetype,
                });
                stream.on('error', reject);
                stream.on('finish', resolve);
                stream.end(invoiceFile.buffer);
            });

            // Create file record in database
            const invoiceFileDoc = await dbHelper.create('file', {
                path: filename,
                mimetype: invoiceFile.mimetype,
                size: invoiceFile.size,
                kind: FileKind.INVOICE,
                userId: user.userId,
                reservationId: reservationId,
                createdAt: new Date(),
            });

            // Update reservation with invoice file ID
            const updatedReservation = await dbHelper.findOneAndUpdate(
                'reservation',
                { _id: reservationId },
                { $set: { invoiceFileId: invoiceFileDoc._id } }
            );

            // Generate signed URL for the uploaded file
            // Note: Google Cloud Storage has a maximum expiration of 7 days (604800 seconds)
            const [signedUrl] = await blob.getSignedUrl({
                version: 'v4',
                expires: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days expiry (maximum allowed)
                action: 'read',
            });

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.data = {
                invoiceFileId: String(invoiceFileDoc._id),
                invoiceImageUrl: signedUrl, // Return URL for immediate use
            };

            return responseData;
        } catch (error) {
            console.error('Error uploading invoice:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error uploading invoice';
            return responseData;
        }
    },
};

function computeEstimate({ facilityDoc, adults = 0, children = 0, pwds = 0, seniorCitizens = 0, serviceType, addonsTotal = 0, category, dateOfArrival, dateOfDeparture, timeOfArrival, }) {
    const isAccommodationFacility = 
        facilityDoc?.facilityType === FacilityType.DORMITORY ||
        facilityDoc?.facilityType === FacilityType.COTTAGE;
    
    const perPersonRate = Number(facilityDoc?.ratePerPerson);
    const hasPerPersonRate = Number.isFinite(perPersonRate) && perPersonRate >= 0;
    
    const usePerPersonPricing = 
        isAccommodationFacility && 
        (serviceType === ServiceType.LODGING || serviceType === ServiceType.EVENT_AND_LODGING) &&
        hasPerPersonRate;

    // Calculate number of nights for accommodation facilities
    let numberOfNights = 1; // Default to 1 night if dates not provided
    let adjustedArrivalDate = dateOfArrival; // Will be adjusted if early arrival
    if (isAccommodationFacility && dateOfArrival && dateOfDeparture) {
        const arrival = dateOfArrival instanceof Date ? dateOfArrival : new Date(dateOfArrival);
        const departure = dateOfDeparture instanceof Date ? dateOfDeparture : new Date(dateOfDeparture);
        if (!isNaN(arrival.getTime()) && !isNaN(departure.getTime()) && departure > arrival) {
            numberOfNights = Math.max(1, Math.ceil((departure - arrival) / (1000 * 60 * 60 * 24)));
        }
    }

    const flatBookingPrice = Number(facilityDoc?.price ?? facilityDoc?.conferencePrice ?? facilityDoc?.flatPrice);

    // Normalize category for comparison (handle case and whitespace)
    const normalizedCategory = category ? String(category).trim() : '';
    
    // Check if category has a discount (GOVERNMENT, DEPED, PWDS)
    // If category has discount, PWD/senior citizen one-time discount should not apply
    const hasCategoryDiscount = normalizedCategory === Category.GOVERNMENT || normalizedCategory === Category.DEPED || normalizedCategory === Category.PWDS;
    
    // PWDs and senior citizens always pay full rate (1.0) - no per-person discount
    const pwdSeniorRate = 1.0;
    
    // Check if there are PWD or senior citizen guests for one-time discount eligibility
    const hasPwdOrSeniorGuests = (pwds > 0) || (seniorCitizens > 0);
    
    // Children are free (0 rate) for dormitory facilities with per-person pricing
    // For other facilities, children pay full rate (1.0) - no discount
    const isDormitory = facilityDoc?.facilityType === FacilityType.DORMITORY;
    const childrenRate = (isDormitory && usePerPersonPricing) ? 0 : 1.0;

    // Check if arrival time is earlier than 2pm (14:00) - add 1 night's price and adjust arrival date
    // Note: 2pm (14:00) is the standard check-in time, so it should NOT trigger early arrival fee
    let earlyArrivalFee = 0;
    let isEarlyArrival = false;
    if (isAccommodationFacility && timeOfArrival) {
        const timeStr = String(timeOfArrival).trim();
        // Parse time in format "HH:MM" or "HH:00"
        const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})$/);
        if (timeMatch) {
            const hours = parseInt(timeMatch[1], 10);
            // Only charge early arrival fee if time is strictly before 2pm (14:00)
            // 2pm (14:00) and later should NOT trigger the early arrival fee
            if (!isNaN(hours) && hours < 14) {
                isEarlyArrival = true;
                // Arrival is before 2pm, calculate 1 night's price
                if (usePerPersonPricing && Number.isFinite(perPersonRate) && perPersonRate >= 0) {
                    const perNightFee = adults * perPersonRate + children * perPersonRate * childrenRate + (pwds + seniorCitizens) * perPersonRate * pwdSeniorRate;
                    earlyArrivalFee = perNightFee;
                } else if (Number.isFinite(flatBookingPrice) && flatBookingPrice >= 0) {
                    earlyArrivalFee = flatBookingPrice;
                }
                
                // Adjust arrival date to previous day for early check-in
                if (dateOfArrival) {
                    const arrival = dateOfArrival instanceof Date ? new Date(dateOfArrival) : new Date(dateOfArrival);
                    if (!isNaN(arrival.getTime())) {
                        arrival.setDate(arrival.getDate() - 1);
                        adjustedArrivalDate = arrival.toISOString().split('T')[0];
                    }
                }
            }
        }
    }

    let baseAmount = 0;

    if (usePerPersonPricing) {
        if (!Number.isFinite(perPersonRate) || perPersonRate < 0) {
            baseAmount = addonsTotal + earlyArrivalFee;
        } else {
            const perNightFee = adults * perPersonRate + children * perPersonRate * childrenRate + (pwds + seniorCitizens) * perPersonRate * pwdSeniorRate;
            baseAmount = (perNightFee * numberOfNights) + addonsTotal + earlyArrivalFee;
        }
    } else {
        if (!Number.isFinite(flatBookingPrice) || flatBookingPrice < 0) {
            baseAmount = addonsTotal + earlyArrivalFee;
        } else {
            // For accommodation facilities, multiply by nights; for events, use flat price
            baseAmount = (isAccommodationFacility ? flatBookingPrice * numberOfNights : flatBookingPrice) + addonsTotal + earlyArrivalFee;
        }
    }

    let finalAmount = baseAmount;
    
    // Check if service fee applies (PRIVATE, GOVERNMENT, DEPED, PWDS categories)
    const hasServiceFee = normalizedCategory === Category.PRIVATE || normalizedCategory === Category.GOVERNMENT || normalizedCategory === Category.DEPED || normalizedCategory === Category.PWDS;
    
    if (normalizedCategory === Category.PRIVATE) {
        finalAmount = baseAmount * 1.10;
    } else if (hasCategoryDiscount) {
        // Category discount: 20% off total (after service fee)
        const withServiceFee = hasServiceFee ? baseAmount * 1.10 : baseAmount;
        finalAmount = withServiceFee * 0.80;
    } else if (hasPwdOrSeniorGuests) {
        // One-time 20% discount for PWD/senior citizen guests when no category discount
        const withServiceFee = hasServiceFee ? baseAmount * 1.10 : baseAmount;
        finalAmount = withServiceFee * 0.80;
    } else if (hasServiceFee) {
        // No discount, but service fee applies
        finalAmount = baseAmount * 1.10;
    }

    let facilityFee = 0;
    if (usePerPersonPricing) {
        if (Number.isFinite(perPersonRate) && perPersonRate >= 0) {
            const perNightFee = adults * perPersonRate + children * perPersonRate * childrenRate + (pwds + seniorCitizens) * perPersonRate * pwdSeniorRate;
            facilityFee = (perNightFee * numberOfNights) + earlyArrivalFee;
        } else {
            facilityFee = earlyArrivalFee;
        }
    } else {
        if (Number.isFinite(flatBookingPrice) && flatBookingPrice >= 0) {
            // For accommodation facilities, multiply by nights; for events, use flat price
            facilityFee = (isAccommodationFacility ? flatBookingPrice * numberOfNights : flatBookingPrice) + earlyArrivalFee;
        } else {
            facilityFee = earlyArrivalFee;
        }
    }

    // Discount applies if: category has discount OR (no category discount AND has PWD/senior guests)
    const hasDiscount = hasCategoryDiscount || (!hasCategoryDiscount && hasPwdOrSeniorGuests);
    
    // Calculate discount amount (20% of amount after service fee if applicable)
    let discountAmount = 0;
    if (hasDiscount) {
        const amountBeforeDiscount = hasServiceFee ? baseAmount * 1.10 : baseAmount;
        discountAmount = amountBeforeDiscount * 0.20;
    }
    
    return { 
        amount: finalAmount,
        model: usePerPersonPricing ? 'perPerson' : 'flat',
        baseAmount: baseAmount,
        facilityFee: facilityFee,
        serviceFee: hasServiceFee ? baseAmount * 0.10 : 0,
        discount: discountAmount,
        adjustedArrivalDate: isEarlyArrival ? adjustedArrivalDate : undefined,
        earlyArrivalFee: earlyArrivalFee
    };
}

export { computeEstimate };
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

function fmtDate(iso) {
    if (!iso) return 'N/A';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: '2-digit', });
}

function methodLabel(t) {
    if (!t) return 'N/A';
    const m = String(t).toLowerCase();
    if (m === 'gcash') return 'GCash';
    if (m === 'card') return 'Card';
    if (m === 'grab_pay') return 'GrabPay';
    if (m === 'paymaya') return 'Maya';
    if (m === 'dbp') return 'DBP';
    if (m === 'bank_transfer' || m === 'bank') return 'Bank Transfer';
    return t;
}

function peso(num, withLeadingSpace = false) {
    const n = Number(num);
    const value = Number.isFinite(n) ? n.toFixed(2) : '0.00';
    return withLeadingSpace ? `₱ ${value}` : `₱${value}`;
}

function fmtAmountOnly(num) {
    const n = Number(num);
    return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

function calculateConfirmationFee(category, totalAmount) {
    const normalizedCategory = category ? String(category).trim() : '';
    const needsConfirmationFee = normalizedCategory === Category.PRIVATE;
    return needsConfirmationFee 
        ? Math.max(0, Math.round(totalAmount * DOWNPAYMENT_PERCENT * 100) / 100)
        : 0;
}

/**
 * Checks if the arrival date is at least one month (30 days) away from today
 * @param {Date|string} arrivalDate - The arrival date to check
 * @returns {boolean} True if the arrival date is at least one month away, false otherwise
 */
function isAtLeastOneMonthAway(arrivalDate) {
    if (!arrivalDate) return false;
    
    // Normalize the arrival date to UTC midnight to match how dates are stored in the database
    let normalizedArrival;
    if (arrivalDate instanceof Date) {
        normalizedArrival = new Date(arrivalDate);
        normalizedArrival.setUTCHours(0, 0, 0, 0);
    } else if (typeof arrivalDate === 'string') {
        const ymd = arrivalDate.split('T')[0].split(' ')[0];
        normalizedArrival = new Date(`${ymd}T00:00:00Z`);
    } else {
        return false;
    }
    
    if (isNaN(normalizedArrival.getTime())) return false;
    
    // Get today's date at midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Calculate one month from today (30 days)
    const oneMonthFromToday = new Date(today);
    oneMonthFromToday.setDate(oneMonthFromToday.getDate() + 30);
    
    // Compare dates (arrival must be >= one month from today)
    return normalizedArrival.getTime() >= oneMonthFromToday.getTime();
}
