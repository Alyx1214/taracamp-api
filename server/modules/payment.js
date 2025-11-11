import fetch from 'node-fetch';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { Status, ReservationStatus, UserRole, ServiceType, Category, FacilityType, GuestType, } from '../constants.js';
import { safeRedisOperations } from './redisCircuitBreaker.js';

dotenv.config();

const PAYMONGO_BASE_URL = process.env.PAYMONGO_BASE_URL || 'https://api.paymongo.com/v1';
const DOWNPAYMENT_PERCENT = 0.10;
const DUE_IN_DAYS = 3;

const paymentModule = {
    /**
     * Creates a payment intent and returns the intent data.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {string} id - The ID of the reservation to create the payment intent for.
     * @param {Object} data - The data object containing the payment intent data.
     * @param {string} [data.reservationId] - The ID of the reservation to create the payment intent for.
     * @param {number} [data.amount] - The amount of the payment intent. Defaults to the total estimated amount of the reservation.
     * @param {string} [data.currency=PHP] - The currency of the payment intent.
     * @param {string[]} [data.paymentMethodAllowed=['card', 'gcash', 'grab_pay', 'paymaya']] - The allowed payment methods for the payment intent.
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

        // Invalidate payment details cache for this reservation
        if (reservationId) {
            try {
                const cachePattern = `payment_details:${reservationId}:*`;
                const keys = await safeRedisOperations.keys(cachePattern);
                if (keys && keys.length > 0) {
                    await safeRedisOperations.del(...keys);
                }
            } catch (cacheError) {
                console.warn('Failed to invalidate payment details cache:', cacheError);
            }
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

        // Invalidate payment details cache for this reservation
        if (reservationId) {
            try {
                const cachePattern = `payment_details:${reservationId}:*`;
                const keys = await safeRedisOperations.keys(cachePattern);
                if (keys && keys.length > 0) {
                    await safeRedisOperations.del(...keys);
                }
            } catch (cacheError) {
                console.warn('Failed to invalidate payment details cache:', cacheError);
            }
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
            responseData.reservationId = reservationId ? String(reservationId) : null;
            responseData.userId = reservationUserId;
            responseData.isPaid = succeeded;

            // Invalidate payment details cache for this reservation
            if (reservationId) {
                try {
                    const cachePattern = `payment_details:${reservationId}:*`;
                    const keys = await safeRedisOperations.keys(cachePattern);
                    if (keys && keys.length > 0) {
                        await safeRedisOperations.del(...keys);
                    }
                } catch (cacheError) {
                    console.warn('Failed to invalidate payment details cache:', cacheError);
                }
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

            const view = {
                id: (reservation._id?.toString() || '').slice(-4) || '—',
                referenceNumber: latest ? String(latest._id) : 'N/A',
                name: reservationUser ? reservationUser.name : reservation.guestName || '—',
                confirmationFee: peso(summaryRaw?.downpaymentAmount ?? 0),
                paymentDue: summaryRaw?.dueDate ? fmtDate(summaryRaw.dueDate) : '—',
                date: dateIso ? fmtDate(dateIso) : '—',
                paymentMethod: methodLabel(paymentMethod),
                status: (() => {
                    const total = Number(reservation.totalEstimatedAmount) || 0;
                    const totalPaid = Number(summaryRaw?.totalPaid || 0);
                    if (totalPaid <= 0) return 'Not Paid';
                    // Use remaining balance calculation to account for floating-point precision issues
                    const remainingBalance = Math.max(0, Math.round((total - totalPaid) * 100) / 100);
                    if (remainingBalance <= 0) return 'Fully Paid';
                    return 'Partially Paid';
                })(),
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
            const status =
            totalPaid <= 0 ? 'Not Paid' :
            remainingBalance <= 0 ? 'Fully Paid' : 'Partially Paid';

            const latestSuccessful = successful[0] || null;
            const latestAny = (payments && payments[0]) || null;
            const referenceNumber =
                latestSuccessful?._id?.toString() ||
                latestAny?._id?.toString() ||
                reservation.referenceNumber ||
                reservation.reservationCode ||
                'N/A';

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
                });

                // Always show service fee for categories that have it
                if (reservation.category === Category.PRIVATE || reservation.category === Category.GOVERNMENT || reservation.category === Category.DEPED) {
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
                        percentage: reservation.category === Category.GOVERNMENT || reservation.category === Category.DEPED ? '20%' : '0%'
                    };
                }
            }

            const view = {
                id: (reservation._id?.toString()),
                referenceNumber,
                name: reservationUser?.name || reservation.guestName || '—',
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
};

function computeEstimate({ facilityDoc, adults = 0, children = 0, pwds = 0, seniorCitizens = 0, serviceType, addonsTotal = 0, category, dateOfArrival, dateOfDeparture, }) {
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
    if (isAccommodationFacility && dateOfArrival && dateOfDeparture) {
        const arrival = dateOfArrival instanceof Date ? dateOfArrival : new Date(dateOfArrival);
        const departure = dateOfDeparture instanceof Date ? dateOfDeparture : new Date(dateOfDeparture);
        if (!isNaN(arrival.getTime()) && !isNaN(departure.getTime()) && departure > arrival) {
            numberOfNights = Math.max(1, Math.ceil((departure - arrival) / (1000 * 60 * 60 * 24)));
        }
    }

    const flatBookingPrice = Number(facilityDoc?.price ?? facilityDoc?.conferencePrice ?? facilityDoc?.flatPrice);

    let baseAmount = 0;

    if (usePerPersonPricing) {
        if (!Number.isFinite(perPersonRate) || perPersonRate < 0) {
            baseAmount = addonsTotal;
        } else {
            const perNightFee = adults * perPersonRate + (children + pwds + seniorCitizens) * perPersonRate * 0.80;
            baseAmount = (perNightFee * numberOfNights) + addonsTotal;
        }
    } else {
        if (!Number.isFinite(flatBookingPrice) || flatBookingPrice < 0) {
            baseAmount = addonsTotal;
        } else {
            // For accommodation facilities, multiply by nights; for events, use flat price
            baseAmount = (isAccommodationFacility ? flatBookingPrice * numberOfNights : flatBookingPrice) + addonsTotal;
        }
    }

    let finalAmount = baseAmount;
    
    if (category === Category.PRIVATE) {
        finalAmount = baseAmount * 1.10;
    } else if (category === Category.GOVERNMENT || category === Category.DEPED) {
        const withServiceFee = baseAmount * 1.10;
        finalAmount = withServiceFee * 0.80;
    }

    let facilityFee = 0;
    if (usePerPersonPricing) {
        if (Number.isFinite(perPersonRate) && perPersonRate >= 0) {
            const perNightFee = adults * perPersonRate + (children + pwds + seniorCitizens) * perPersonRate * 0.80;
            facilityFee = perNightFee * numberOfNights;
        }
    } else {
        if (Number.isFinite(flatBookingPrice) && flatBookingPrice >= 0) {
            // For accommodation facilities, multiply by nights; for events, use flat price
            facilityFee = isAccommodationFacility ? flatBookingPrice * numberOfNights : flatBookingPrice;
        }
    }

    return { 
        amount: finalAmount,
        model: usePerPersonPricing ? 'perPerson' : 'flat',
        baseAmount: baseAmount,
        facilityFee: facilityFee,
        serviceFee: category === Category.PRIVATE || category === Category.GOVERNMENT || category === Category.DEPED ? baseAmount * 0.10 : 0,
        discount: category === Category.GOVERNMENT || category === Category.DEPED ? (baseAmount * 1.10) * 0.20 : 0
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
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: '2-digit', });
}

function methodLabel(t) {
    if (!t) return '—';
    const m = String(t).toLowerCase();
    if (m === 'gcash') return 'GCash';
    if (m === 'card') return 'Card';
    if (m === 'grab_pay') return 'GrabPay';
    if (m === 'paymaya') return 'Maya';
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
    const needsConfirmationFee = category === Category.PRIVATE;
    return needsConfirmationFee 
        ? Math.max(0, Math.round(totalAmount * DOWNPAYMENT_PERCENT * 100) / 100)
        : 0;
}
