import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { authenticateJWT } from '../middleware/auth.js';
import dbHelper from '../modules/dbHelper.js';
import paymentModule from '../modules/payment.js';

const r = Router();

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

export default r;
