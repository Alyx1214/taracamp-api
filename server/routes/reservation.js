import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { authenticateJWT } from '../middleware/auth.js';
import { uploadLetter, uploadNonavailabilityCert, uploadSeniorCitizenId } from '../middleware/uploads.js';
import dbHelper from '../modules/dbHelper.js';
import reservationModule from '../modules/reservation.js';
import notificationModule from '../modules/notification.js';

export default function buildReservationRouter(userSocketMap) {
  const r = Router();
  const runUpload = (req, res) =>
    new Promise((resolve, reject) => {
      const uploadFields = [
        { name: 'letterOfIntentFile', maxCount: 1 },
        { name: 'seniorCitizenIdFile', maxCount: 1 }
      ];
      
      const upload = multer({ storage: multer.memoryStorage() }).fields(uploadFields);
      upload(req, res, err => (err ? reject(err) : resolve()));
    });

  r.get('/get-reservation-by-id/:id', asyncHandler(async (req, res) => {
    const response = await reservationModule.getReservationById(dbHelper, req.params.id);
    res.status(response.status).json(response);
  }));

  r.get('/estimate-amount', asyncHandler(async (req, res) => {
    const response = await reservationModule.estimate(dbHelper, req.query);
    res.status(response.status).json(response);
  }));

  r.get('/check-availability', asyncHandler(async (req, res) => {
    const response = await reservationModule.checkAvailability(dbHelper, req.query, req.user || null);
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

  r.post('/create-reservation', asyncHandler(async (req, res) => {
    await runUpload(req, res);

    const data = req.body;
    const letterOfIntentFile = req.files?.letterOfIntentFile?.[0] || null;
    const seniorCitizenIdFile = req.files?.seniorCitizenIdFile?.[0] || null;
    const response = await reservationModule.addReservation(dbHelper, data, letterOfIntentFile, seniorCitizenIdFile, req.user);

    res.status(response.status).json(response);

    if (response.status === 201 && response.reservationId) {
      await notificationModule.createAndNotifyUser(
        dbHelper,
        {
          title: 'Congratulations, Camper! You have successfully booked a reservation!',
          message: null,                         
          kind: 'booking_success',               
          isRead: false,
          userId: req.user.userId,
          reservationId: response.reservationId,
        },
        userSocketMap
      ).catch(e => console.warn('Notify failed:', e?.message));
    }
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
