import fetch from 'node-fetch';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { Status, ReservationStatus } from '../constants.js';

dotenv.config();

const PAYMONGO_BASE_URL = process.env.PAYMONGO_BASE_URL || 'https://api.paymongo.com/v1';

const paymentModule = {
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
        paymentMethodAllowed = ['card', 'gcash', 'grab_pay', 'paymaya'],
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
        const reservation = await dbHelper.findOne('reservation', { _id: reservationId });
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
    
        if (reservation.status !== ReservationStatus.APPROVED) {
          responseData.status = Status.FORBIDDEN;
          responseData.error = 'Reservation must be APPROVED before payment';
          return responseData;
        }
        // If client provided an amount, validate it; otherwise default to total
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
      responseData.error = error.message;
    }
    return responseData;
  },

  attachPaymentMethod: async (dbHelper, data) => {
    const responseData = {
      status: Status.INTERNAL_SERVER_ERROR,
      error: 'Error attaching payment method',
    };
    try {
      const { paymentIntentId, paymentMethodId, returnUrl, } = data || {};
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
          const reservation = await dbHelper.findOne('reservation', { _id: resvId });
          if (!reservation) {
            responseData.status = Status.NOT_FOUND;
            responseData.error = 'Reservation not found for this payment intent';
            return responseData;
          }
          if (reservation.status !== ReservationStatus.APPROVED) {
            responseData.status = Status.FORBIDDEN;
            responseData.error = 'Reservation must be APPROVED before payment';
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
        await dbHelper.findOneAndUpdate('payment', { piId: intent.id }, {
          $set: {
            status: intent?.attributes?.status,
            updatedAt: new Date(),
          },
        });
      } catch (e) {
        console.error('Failed updating payment record after attach:', e);
      }
    } catch (error) {
      console.error('Error attaching payment method:', error);
      responseData.error = error.message;
    }
    return responseData;
  },

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
      responseData.error = error.message;
    }
    return responseData;
  },

  createPaymentMethod: async (dbHelper, data) => {
    const responseData = {
      status: Status.INTERNAL_SERVER_ERROR,
      error: 'Error creating payment method',
    };
    try {
      const { type, details, billing, } = data || {};
      const redirectTypes = new Set(['gcash', 'grab_pay', 'paymaya']);

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

      const attributes = { type, billing };
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
      responseData.error = error.message;
    }
    return responseData;
  },

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

      let updatedReservation = null;
      let skippedReason = null;
      if (isPaid && reservationId && dbHelper) {
        try {
          const reservation = await dbHelper.findOne('reservation', { _id: reservationId });
          if (!reservation) {
            skippedReason = 'Reservation not found';
          } else {
            // Compute totalPaid from payments collection
            let totalPaid = 0;
            try {
              const paidRows = await dbHelper.findMany('payment', { reservationId, status: 'paid' }, { sort: { createdAt: 1 } });
              totalPaid = (paidRows || []).reduce((acc, p) => acc + (Number(p.amountCentavos || 0) / 100), 0);
            } catch (_) {}

            const total = Number(reservation.totalEstimatedAmount) || 0;
            const nextStatus = totalPaid >= total && total > 0
              ? ReservationStatus.PAID
              : (totalPaid > 0 ? ReservationStatus.CONFIRMED : reservation.status);

            if (nextStatus !== reservation.status) {
              updatedReservation = await dbHelper.findOneAndUpdate(
                'reservation',
                { _id: reservationId },
                { status: nextStatus }
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
          await dbHelper.findOneAndUpdate('payment', { piId: pi.id }, {
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

          const existing = piId ? await dbHelper.findOne('payment', { piId }) : null;
          if (existing) {
            await dbHelper.findOneAndUpdate('payment', { _id: existing._id }, {
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
      console.error('Error handling webhook:', error);
      responseData.error = error.message;
    }
    return responseData;
  },
};

// List payments for a reservation (for current user)
paymentModule.listPaymentsForReservation = async (dbHelper, reservationId, user) => {
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

    const reservation = await dbHelper.findOne('reservation', { _id: reservationId });
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

    const rows = await dbHelper.findMany('payment', { reservationId }, { sort: { createdAt: -1 } });
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
  } catch (err) {
    responseData.error = err.message;
    return responseData;
  }
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
    body: attributesPayload ? JSON.stringify({ data: { attributes: attributesPayload } }) : undefined,
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
