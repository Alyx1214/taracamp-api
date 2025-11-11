import { Router } from 'express';
import multer from 'multer';
import asyncHandler from '../middleware/asyncHandler.js';
import { authenticateJWT } from '../middleware/auth.js';
import { uploadLetter, uploadNonavailabilityCert, uploadSeniorCitizenId } from '../middleware/uploads.js';
import { ReservationStatus, UserRole } from '../constants.js';
import dbHelper from '../modules/dbHelper.js';
import reservationModule from '../modules/reservation.js';
import notificationModule from '../modules/notification.js';
import jwtHelper from '../modules/jwtHelper.js';

export default function buildReservationRouter(userSocketMap) {
  const r = Router();
  const runUpload = (req, res) =>
    new Promise((resolve, reject) => {
      const uploadFields = [
        { name: 'letterOfIntentFile', maxCount: 1 },
        { name: 'seniorCitizenIdFile', maxCount: 1 },
        { name: 'seniorCitizenIdFiles', maxCount: 10 },
        { name: 'pwdIdFiles', maxCount: 10 }
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
    // Try to authenticate if token is provided, but don't require it
    let user = null;
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      user = jwtHelper.verifyAccessToken(token);
    }
    const response = await reservationModule.checkAvailability(dbHelper, req.query, user);
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

    const raw = req.body || {};
    const data = { ...raw };
    // Normalize facility to string
    if (data.facility !== undefined && data.facility !== null) {
      data.facility = String(data.facility);
    }
    // Parse addOns if sent as JSON/string
    if (typeof data.addOns === 'string') {
      try {
        const parsed = JSON.parse(data.addOns);
        data.addOns = Array.isArray(parsed) ? parsed : String(data.addOns).split(',');
      } catch {
        data.addOns = String(data.addOns)
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);
      }
    }
    // Drop any client-sent file id hints
    delete data.letterOfIntentFileId;
    delete data.seniorCitizenIdFileId;
    delete data.pwdIdFileId;
    
    // Handle file uploads - support both singular and plural field names
    const letterOfIntentFile = req.files?.letterOfIntentFile?.[0] || null;
    
    // Support both seniorCitizenIdFile (singular) and seniorCitizenIdFiles (plural)
    // Take the first file if multiple are provided (schema only supports one)
    const seniorCitizenIdFile = req.files?.seniorCitizenIdFile?.[0] 
      || req.files?.seniorCitizenIdFiles?.[0] 
      || null;
    
    // Handle PWD ID files (multiple files allowed)
    const pwdIdFiles = req.files?.pwdIdFiles || [];
    const pwdIdFilesArray = Array.isArray(pwdIdFiles) ? pwdIdFiles : [];
    
    const response = await reservationModule.addReservation(dbHelper, data, letterOfIntentFile, seniorCitizenIdFile, pwdIdFilesArray, req.user);

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

    if (response.status === 200) {
      try {
        const reservation = await dbHelper.findOne('reservation', { _id: req.params.id });
        if (reservation) {
          await notificationModule.notifyCancellation(dbHelper, reservation, userSocketMap);
        } else {
          console.warn('Reservation not found for cancellation notification:', req.params.id);
        }
      } catch (error) {
        console.error('Failed to create cancellation notification:', error);
      }
    }
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

    if (response.status === 200 && status === ReservationStatus.APPROVED && response.reservation) {
      try {
        const reservation = await dbHelper.findOne('reservation', { _id: req.params.id });
        if (reservation) {
          const reservationIdStr = reservation._id?.toString?.() || String(reservation._id || '');
          
          // Notify guest if reservation has userId
          if (reservation.userId) {
            // Ensure userId and reservationId are strings (not ObjectId objects)
            const userIdStr = reservation.userId?.toString?.() || String(reservation.userId || '');
            
            await notificationModule.createAndNotifyUser(
              dbHelper,
              {
                title: 'Congratulations, Camper! Your reservation has been approved!',
                message: "Your reservation has been approved. Please proceed with payment or upload required documents to confirm your booking.",
                kind: 'reservation_approved',
                userId: userIdStr,
                reservationId: reservationIdStr,
              },
              userSocketMap
            ).catch(e => console.warn('Notify approval failed:', e?.message));
          }

          // Notify all admin users about the approved reservation
          try {
            const adminUsers = await dbHelper.findMany('user', {
              role: { $ne: UserRole.GUEST }
            }, {
              projection: { _id: 1 }
            });

            if (Array.isArray(adminUsers) && adminUsers.length > 0) {
              // Send notification to each admin user
              const adminNotificationPromises = adminUsers.map(adminUser => {
                const adminUserIdStr = adminUser._id?.toString?.() || String(adminUser._id || '');
                return notificationModule.createAndNotifyUser(
                  dbHelper,
                  {
                    title: 'Congratulations, Camper! Your reservation has been approved!',
                    message: "Your reservation has been approved. Please proceed with payment or upload required documents to confirm your booking.",
                    kind: 'reservation_approved_admin',
                    userId: adminUserIdStr,
                    reservationId: reservationIdStr,
                  },
                  userSocketMap
                ).catch(e => console.warn(`Failed to notify admin ${adminUserIdStr}:`, e?.message));
              });

              await Promise.all(adminNotificationPromises);
            }
          } catch (adminError) {
            console.warn('Failed to notify admin users:', adminError?.message);
          }
        }
      } catch (error) {
        console.warn('Failed to create approval notification:', error?.message);
      }
    }
  }));

  r.post('/checkin-or-checkout-reservation/:id', asyncHandler(async (req, res) => {
    const { status, employeeName } = req.body;
    const response = await reservationModule.checkInOrCheckOutReservation(dbHelper, req.params.id, status, req.user, { employeeName });
    res.status(response.status).json(response);

    // Send notification to guest after successful checkout
    if (response.status === 200 && status === ReservationStatus.CHECKED_OUT) {
      try {
        const reservation = await dbHelper.findOne('reservation', { _id: req.params.id });
        if (reservation && reservation.userId) {
          const reservationIdStr = reservation._id?.toString?.() || String(reservation._id || '');
          const userIdStr = reservation.userId?.toString?.() || String(reservation.userId || '');
          
          await notificationModule.createAndNotifyUser(
            dbHelper,
            {
              title: 'Share your stay',
              message: "Tell others about your experience by leaving a review.",
              kind: 'checkout_review_request',
              userId: userIdStr,
              reservationId: reservationIdStr,
            },
            userSocketMap
          ).catch(e => console.warn('Notify checkout review request failed:', e?.message));
        }
      } catch (error) {
        console.warn('Failed to create checkout review notification:', error?.message);
      }
    }
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

  r.post('/update-meal-preference/:id', asyncHandler(async (req, res) => {
    const { willAvailMeals } = req.body;
    const response = await reservationModule.updateMealPreference(dbHelper, req.params.id, willAvailMeals, req.user);
    res.status(response.status).json(response);
  }));

  r.post('/update-reservation/:id', asyncHandler(async (req, res) => {
    await runUpload(req, res);

    const raw = req.body || {};
    const data = { ...raw };
    // Normalize facility to string
    if (data.facility !== undefined && data.facility !== null) {
      data.facility = String(data.facility);
    }
    // Parse addOns if sent as JSON/string
    if (typeof data.addOns === 'string') {
      try {
        const parsed = JSON.parse(data.addOns);
        data.addOns = Array.isArray(parsed) ? parsed : String(data.addOns).split(',');
      } catch {
        data.addOns = String(data.addOns)
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);
      }
    }
    // Drop any client-sent file id hints
    delete data.letterOfIntentFileId;
    delete data.seniorCitizenIdFileId;
    delete data.pwdIdFileId;
    
    // Handle file uploads - support both singular and plural field names
    const letterOfIntentFile = req.files?.letterOfIntentFile?.[0] || null;
    
    // Support both seniorCitizenIdFile (singular) and seniorCitizenIdFiles (plural)
    const seniorCitizenIdFiles = req.files?.seniorCitizenIdFiles || req.files?.seniorCitizenIdFile || [];
    const seniorCitizenIdFilesArray = Array.isArray(seniorCitizenIdFiles) 
      ? seniorCitizenIdFiles 
      : seniorCitizenIdFiles.length > 0 
        ? [seniorCitizenIdFiles[0]] 
        : [];
    
    // Handle PWD ID files
    const pwdIdFiles = req.files?.pwdIdFiles || [];
    const pwdIdFilesArray = Array.isArray(pwdIdFiles) ? pwdIdFiles : [];
    
    const response = await reservationModule.updateReservation(
      dbHelper, 
      req.params.id, 
      data, 
      letterOfIntentFile, 
      seniorCitizenIdFilesArray, 
      pwdIdFilesArray, 
      req.user
    );
    res.status(response.status).json(response);
  }));

  return r;
}
