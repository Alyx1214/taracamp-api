import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { authenticateJWT } from '../middleware/auth.js';
import { uploadLetter, uploadNonavailabilityCert } from '../middleware/uploads.js';
import dbHelper from '../modules/dbHelper.js';
import reservationModule from '../modules/reservation.js';

export default function buildReservationRouter(userSocketMap) {
  const r = Router();

  r.get('/get-reservation-by-id/:id', asyncHandler(async (req, res) => {
    const response = await reservationModule.getReservationById(dbHelper, req.params.id);
    res.status(response.status).json(response);
  }));

  r.get('/estimate-amount', asyncHandler(async (req, res) => {
    const response = await reservationModule.estimate(dbHelper, req.query);
    res.status(response.status).json(response);
  }));

  r.get('/check-availability', asyncHandler(async (req, res) => {
    const response = await reservationModule.checkAvailability(dbHelper, req.query);
    res.status(response.status).json(response);
  }));

  r.use(authenticateJWT);

  r.get('/get-reservation-by-user-id', asyncHandler(async (req, res) => {
    const response = await reservationModule.getReservationByUserId(dbHelper, req.user);
    res.status(response.status).json(response);
  }));

  r.get('/get-all-reservations-by-status/:id', asyncHandler(async (req, res) => {
    const response = await reservationModule.getAllReservationsByStatus(
      dbHelper,
      req.params.id,
      req.user,
      req.query
    );
    res.status(response.status).json(response);
  }));

  r.get('/search-reservations', asyncHandler(async (req, res) => {
    const response = await reservationModule.searchReservations(dbHelper, req.query, req.user);
    res.status(response.status).json(response);
  }));

  r.get('/get-payment-summary/:id', asyncHandler(async (req, res) => {
    const response = await reservationModule.getPaymentSummary(dbHelper, req.params.id, req.user);
    res.status(response.status).json(response);
  }));

  r.post('/create-reservation', uploadLetter, asyncHandler(async (req, res) => {
    const response = await reservationModule.addReservation(
      dbHelper,
      { ...req.body, ...req.query },
      req.file,
      req.user,
      userSocketMap
    );
    res.status(response.status).json(response);
  }));

  r.post('/cancel-booking/:id', asyncHandler(async (req, res) => {
    const response = await reservationModule.cancelBooking(dbHelper, req.params.id, req.user);
    res.status(response.status).json(response);
  }));

  r.post('/accept-or-decline-reservation/:id', asyncHandler(async (req, res) => {
    const { status } = req.body;
    const response = await reservationModule.approveOrDeclineReservation(
      dbHelper,
      req.params.id,
      status,
      req.user
    );
    res.status(response.status).json(response);
  }));

  r.post('/checkin-or-checkout-reservation/:id', asyncHandler(async (req, res) => {
    const { status } = req.body;
    const response = await reservationModule.checkInOrCheckOutReservation(dbHelper, req.params.id, status, req.user);
    res.status(response.status).json(response);
  }));

  r.post('/delete-reservation/:id', asyncHandler(async (req, res) => {
    const response = await reservationModule.deleteReservation(dbHelper, req.params.id, req.user);
    res.status(response.status).json(response);
  }));

  r.post('/upload-nonavailability-certificate/:id', uploadNonavailabilityCert, asyncHandler(async (req, res) => {
    const response = await reservationModule.uploadNonAvailabilityCertificate(
      dbHelper,
      req.params.id,
      req.file,
      req.user
    );
    res.status(response.status).json(response);
  }));

  return r;
}
