import { Router } from 'express';
import multer from 'multer';
import asyncHandler from '../middleware/asyncHandler.js';
import { authenticateJWT } from '../middleware/auth.js';
import { uploadLetter, uploadNonavailabilityCert, uploadSeniorCitizenId } from '../middleware/uploads.js';
import { ReservationStatus, UserRole, Status } from '../constants.js';
import dbHelper from '../modules/dbHelper.js';
import reservationModule from '../modules/reservation.js';
import notificationModule from '../modules/notification.js';
import emailModule from '../modules/email.js';
import jwtHelper from '../modules/jwtHelper.js';

export default function buildReservationRouter(userSocketMap) {
  const r = Router();
  const runUpload = (req, res) =>
    new Promise((resolve, reject) => {
      const uploadFields = [
        { name: 'letterOfIntentFile', maxCount: 1 },
        { name: 'seniorCitizenIdFile', maxCount: 1 },
        { name: 'seniorCitizenIdFiles', maxCount: 10 },
        { name: 'pwdIdFiles', maxCount: 10 },
        { name: 'governmentIdFiles', maxCount: 10 },
        { name: 'serviceContractFile', maxCount: 1 },
        { name: 'moaFile', maxCount: 1 },
        { name: 'fundsFile', maxCount: 1 }
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
    delete data.letterOfIntentFileId;
    delete data.seniorCitizenIdFileId;
    delete data.pwdIdFileId;
    delete data.governmentIdFileId;
    
    const letterOfIntentFile = req.files?.letterOfIntentFile?.[0] || null;
    
    const seniorCitizenIdFile = req.files?.seniorCitizenIdFile?.[0] 
      || req.files?.seniorCitizenIdFiles?.[0] 
      || null;
    
    const pwdIdFiles = req.files?.pwdIdFiles || [];
    const pwdIdFilesArray = Array.isArray(pwdIdFiles) ? pwdIdFiles : [];
    
    const governmentIdFiles = req.files?.governmentIdFiles || [];
    const governmentIdFilesArray = Array.isArray(governmentIdFiles) ? governmentIdFiles : [];
    
    const response = await reservationModule.addReservation(dbHelper, data, letterOfIntentFile, seniorCitizenIdFile, pwdIdFilesArray, governmentIdFilesArray, req.user);

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

      // Send reservation confirmation email
      // COMMENTED OUT: Email functionality disabled
      /*
      try {
        // Determine recipient email - use guestEmail if it's a guest reservation, otherwise get user's email
        let recipientEmail = null;
        const creatingForGuest = typeof data.guestEmail === 'string' && data.guestEmail.trim().length > 0;
        
        if (creatingForGuest) {
          recipientEmail = data.guestEmail.trim();
        } else if (req.user && req.user.userId) {
          // Fetch user's email from database
          const user = await dbHelper.findOne('user', { _id: req.user.userId }, { 
            projection: { email: 1 } 
          });
          recipientEmail = user?.email;
        }

        if (recipientEmail) {
          // Fetch facility name
          const facilityId = data.facility;
          let facilityName = 'N/A';
          if (facilityId) {
            const facility = await dbHelper.findOne('facility', { _id: facilityId }, { 
              projection: { name: 1 } 
            });
            facilityName = facility?.name || 'N/A';
          }

          // Prepare reservation details for email
          // Note: response.reservation.numberOfGuests has individual counts deleted, so we use data directly
          const numberOfAdults = parseInt(data.numberOfAdults) || 0;
          const numberOfChildren = parseInt(data.numberOfChildren) || 0;
          const numberOfPwds = parseInt(data.numberOfPwds) || 0;
          const numberOfSeniorCitizens = parseInt(data.numberOfSeniorCitizens) || 0;
          const totalGuests = numberOfAdults + numberOfChildren + numberOfPwds + numberOfSeniorCitizens;
          
          const reservationDetails = {
            reservationCode: response.reservation?.reservationCode || 'N/A',
            guestName: data.guestName || 'Guest',
            facilityName: facilityName,
            dateOfArrival: data.dateOfArrival,
            dateOfDeparture: data.dateOfDeparture,
            timeOfArrival: data.timeOfArrival,
            numberOfGuests: {
              total: totalGuests,
              adult: numberOfAdults,
              children: numberOfChildren,
              pwds: numberOfPwds,
              seniorCitizen: numberOfSeniorCitizens,
            },
            totalEstimatedAmount: response.reservation?.totalEstimatedAmount || 0,
            serviceType: data.serviceType || 'N/A',
            category: data.category || 'N/A',
            status: response.reservation?.status || 'Pending',
          };

          // Send email (don't block the response if email fails)
          emailModule.sendReservationConfirmationEmail(recipientEmail, reservationDetails)
            .catch(() => {
              // Silently handle email errors - don't fail reservation creation
            });
        }
      } catch (error) {
        // Silently handle email preparation errors - don't fail reservation creation
      }
      */
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

    // Send notifications to users whose reservations were auto-declined
    if (response.status === 200 && status === ReservationStatus.APPROVED && response.autoDeclinedReservations && response.autoDeclinedReservations.length > 0) {
      try {
        for (const declinedReservation of response.autoDeclinedReservations) {
          const reservationIdStr = declinedReservation._id?.toString?.() || String(declinedReservation._id || '');
          
          // Notify user if reservation has userId
          if (declinedReservation.userId) {
            const userIdStr = declinedReservation.userId?.toString?.() || String(declinedReservation.userId || '');
            
            await notificationModule.createAndNotifyUser(
              dbHelper,
              {
                title: 'Reservation Declined',
                message: "We're sorry to inform you that your reservation request has been declined. If you have any questions or would like to discuss this decision, please contact us.",
                kind: 'reservation_declined',
                userId: userIdStr,
                reservationId: reservationIdStr,
              },
              userSocketMap
            ).catch(e => console.warn(`Failed to notify user ${userIdStr} about auto-declined reservation:`, e?.message));
          }
        }
      } catch (error) {
        console.warn('Failed to send notifications for auto-declined reservations:', error?.message);
      }
    }

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
              const guestName = reservation.guestName || 'Guest';
              
              // Send notification to each admin user
              const adminNotificationPromises = adminUsers.map(adminUser => {
                const adminUserIdStr = adminUser._id?.toString?.() || String(adminUser._id || '');
                return notificationModule.createAndNotifyUser(
                  dbHelper,
                  {
                    title: 'Reservation Approved',
                    message: `A reservation by ${guestName} has been approved.`,
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

    // Send notification to guest when reservation is declined
    if (response.status === 200 && status === ReservationStatus.DECLINED && response.reservation) {
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
                title: 'Reservation Declined',
                message: "We're sorry to inform you that your reservation request has been declined. If you have any questions or would like to discuss this decision, please contact us.",
                kind: 'reservation_declined',
                userId: userIdStr,
                reservationId: reservationIdStr,
              },
              userSocketMap
            ).catch(e => console.warn('Notify decline failed:', e?.message));
          }
        }
      } catch (error) {
        console.warn('Failed to create decline notification:', error?.message);
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
    const serviceContractFile = req.files?.serviceContractFile?.[0] || null;
    const moaFile = req.files?.moaFile?.[0] || null;
    const fundsFile = req.files?.fundsFile?.[0] || null;
    
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
      req.user,
      serviceContractFile,
      moaFile,
      fundsFile
    );
    res.status(response.status).json(response);
  }));

  return r;
}
