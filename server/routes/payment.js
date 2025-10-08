import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { authenticateJWT } from '../middleware/auth.js';
import dbHelper from '../modules/dbHelper.js';
import paymentModule from '../modules/payment.js';
import notificationModule from '../modules/notification.js';
import { Status } from '../constants.js';

export default function buildPaymentRouter(userSocketMap) {
  const r = Router();

  const PAYMENT_SUCCESS_TEMPLATE = Object.freeze({
    title: "Congratulations, Camper! Payment Successful — your reservation is now confirmed. We can't wait to welcome you!",
    message: null,
    kind: 'payment_success',
  });

  async function maybeCreatePaymentSuccessNotification(reservationId, userId) {
    const rid = reservationId ? String(reservationId) : '';
    if (!rid) return;

    let uid = userId ? String(userId) : null;
    if (!uid) {
      const reservation = await dbHelper.findOne('reservation', { _id: rid });
      uid = reservation?.userId ? String(reservation.userId) : null;
    }
    if (!uid) return;

    const already = await dbHelper.findOne('notification', {
      userId: uid,
      reservationId: rid,
      kind: PAYMENT_SUCCESS_TEMPLATE.kind,
    });
    if (already) return;

    await notificationModule.createAndNotifyUser(
      dbHelper,
      {
        ...PAYMENT_SUCCESS_TEMPLATE,
        isRead: false,
        userId: uid,
        reservationId: rid,
      },
      userSocketMap
    );
  }

  r.post('/webhook', asyncHandler(async (req, res) => {
    const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8')
                                          : typeof req.body === 'string' ? req.body
                                          : JSON.stringify(req.body || {});
    const response = await paymentModule.handleWebhook(dbHelper, req.headers, raw);
    res.status(response.status).json(response);

    try {
      if (!response || response.status !== Status.OK || !response.isPaid) return;
      await maybeCreatePaymentSuccessNotification(response.reservationId, response.userId);
    } catch (e) {
      console.warn('Webhook post-processing failed:', e?.message);
    }
  }));


  r.get('/get-payment-intent/:id', asyncHandler(async (req, res) => {
    const response = await paymentModule.getPaymentIntent(dbHelper, req.params.id);
    res.status(response.status).json(response);
  }));

  r.use(authenticateJWT);

  r.get('/list-by-reservation/:id', asyncHandler(async (req, res) => {
    const response = await paymentModule.listPaymentsForReservation(dbHelper, req.params.id, req.user);
    res.status(response.status).json(response);
  }));

  r.get('/reconcile/:id', asyncHandler(async (req, res) => {
    const response = await paymentModule.reconcilePaymentIntent(dbHelper, req.params.id, req.user);
    res.status(response.status).json(response);

    try {
      if (!response || response.status !== Status.OK || !response.isPaid) return;
      await maybeCreatePaymentSuccessNotification(response.reservationId, response.userId);
    } catch (e) {
      console.warn('Reconcile post-processing failed:', e?.message);
    }
  }));

  r.get('/get-payment-summary/:id', asyncHandler(async (req, res) => {
    const response = await paymentModule.getPaymentSummary(dbHelper, req.params.id, req.user);
    res.status(response.status).json(response);
  }));

  r.get('/get-payment-details/:id', asyncHandler(async (req, res) => {
    const response = await paymentModule.getPaymentDetails(dbHelper, req.params.id, req.user);
    res.status(response.status).json(response);
  }));

  r.get('/get-transaction-details/:reservationId', asyncHandler(async (req, res) => {
    const response = await paymentModule.getTransactionDetails(dbHelper, req.params.reservationId, req.user);
    res.status(response.status).json(response);
  }));

  r.post('/create-payment-intent/:id', asyncHandler(async (req, res) => {
    const response = await paymentModule.createPaymentIntent(dbHelper, req.params.id, req.body, req.user);
    res.status(response.status).json(response);
  }));

  r.post('/attach-payment-method', asyncHandler(async (req, res) => {
    const response = await paymentModule.attachPaymentMethod(dbHelper, req.body);
    res.status(response.status).json(response);
  }));

  r.post('/create-payment-method', asyncHandler(async (req, res) => {
    const response = await paymentModule.createPaymentMethod(dbHelper, req.body);
    res.status(response.status).json(response);
  }));

  return r;
}
