import express from 'express';
import http from 'http';
import path from 'path';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import { WebSocketServer, } from 'ws';
import { fileURLToPath, } from 'url';
import multer from 'multer';
import 'dotenv/config';
import dbHelper from './modules/dbHelper.js';
import redisClient from './modules/redisClient.js';
import emailModule from './modules/email.js';
import jwtHelper from './modules/jwtHelper.js';
import userModule from './modules/user.js';
import profileModule from './modules/profile.js';
import reservationModule from './modules/reservation.js';
import facilityModule from './modules/facility.js';
import specialServiceModule from './modules/specialService.js';
import dashboardModule from './modules/dashboard.js';
import notificationModule from './modules/notification.js';
import paymentModule from './modules/payment.js';
import { Status, } from './constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env'), });

const port = process.env.PORT;
const dbConnectionString = process.env.DB_CONN;
//const upload = multer({ storage: multer.memoryStorage(), });
//const __clientPath = path.join(__dirname, '../client');

dbHelper.connect(dbConnectionString);

const app = express();
app.set('trust proxy', 1);
await redisClient.connect();

app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5174',],
    credentials: true,
}));

// Define limiter before first use
const basicLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 40,
    message: {
        error: 'Too many requests, please try again after a minute.',
    },
});

app.post('/api/payment/webhook', basicLimiter, express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const raw = req.body instanceof Buffer ? req.body.toString('utf8') : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}));
        const responseData = await paymentModule.handleWebhook(dbHelper, req.headers, raw);
        return res.status(responseData.status).json(responseData);
    } catch (e) {
        return res.status(500).json({ status: 500, error: e?.message || 'Webhook handler error', });
    }
});

app.use(express.json());

const uploadImage = multer({ storage: multer.memoryStorage(), }).single('image');
const uploadLetter = multer({ storage: multer.memoryStorage(), }).single('letterOfIntentFile');

// const verificationLimiter = rateLimit({
//     windowMs: 60 * 60 * 1000, // 1 hour
//     max: 3, // limit each IP to 3 request per windowMs
//     message: {
//         error: 'Too many requests, please try again after a minute.'
//     }
// });

const processGetAPI = async (req, res) => {
    const { module, action, id, } = req.params;
    switch (module) {
        case 'user':
            switch (action) {
                // case 'verify-verification-code': {
                //     let responseData = await userModule.verifyVerificationCode(dbHelper, data);
                //     if (responseData.status === Status.OK) {
                //         return res.redirect('../../email-verification-success.html');
                //     }
                //     return res.status(responseData.status).json(responseData);
                // }
                case 'profile': {
                    let responseData = await userModule.getUser(dbHelper, req.user);
                    let profileResponseData = await profileModule.getProfile(dbHelper, req.user);
                    profileResponseData.data = { ...responseData.data, ...profileResponseData.data, };
                    return res.status(profileResponseData.status).json(profileResponseData);
                }
                default:
                    return res.status(404).json({ error: 'Unknown action', });
            }
        case 'facility':
            switch (action) {
                case 'get-all-facilities': {
                    const params = { ...req.query };
                    let responseData = await facilityModule.getAllFacilities(dbHelper, params);
                    return res.status(responseData.status).json(responseData);
                }
                case 'get-facility-by-id': {
                    let responseData = await facilityModule.getFacilityById(dbHelper, id);
                    return res.status(responseData.status).json(responseData);
                }
                case 'get-facilities-by-type': {
                    let responseData = await facilityModule.getFacilitiesByType(dbHelper, id);
                    return res.status(responseData.status).json(responseData);
                }
                case 'get-available-dates-by-facility': {
                    let responseData = await facilityModule.getAvailableDatesByFacility(dbHelper, id);
                    return res.status(responseData.status).json(responseData);
                }
                case 'search-facilities': {
                    const params = { ...req.query, };
                    let responseData = await facilityModule.searchFacilities(dbHelper, params);
                    return res.status(responseData.status).json(responseData);
                }
                default:
                    return res.status(404).json({ error: 'Unknown action', });
            }
        case 'special-service':
            switch (action) {
                case 'get-all-special-services': {
                    const params = { ...req.query };
                    let responseData = await specialServiceModule.getAllSpecialServices(dbHelper, params);
                    return res.status(responseData.status).json(responseData);
                }
                case 'get-special-service-by-id': {
                    let responseData = await specialServiceModule.getSpecialServiceById(dbHelper, id);
                    return res.status(responseData.status).json(responseData);
                }
                case 'search-special-services': {
                    const params = { ...req.query, };
                    let responseData = await specialServiceModule.searchSpecialServices(dbHelper, params);
                    return res.status(responseData.status).json(responseData);
                }
                default:
                    return res.status(404).json({ error: 'Unknown action', });
            }
        case 'reservation':
            switch (action) {
                case 'get-reservation-by-user-id': {
                    let responseData = await reservationModule.getReservationByUserId(dbHelper, req.user);
                    return res.status(responseData.status).json(responseData);
                }
                case 'get-reservation-by-id': {
                    let responseData = await reservationModule.getReservationById(dbHelper, id);
                    return res.status(responseData.status).json(responseData);
                }
                case 'get-all-reservations-by-status': {
                    const params = { ...req.query };
                    let responseData = await reservationModule.getAllReservationsByStatus(dbHelper, id, req.user, params);
                    return res.status(responseData.status).json(responseData);
                }
                case 'estimate-amount': {
                    const params = { ...req.query, };
                    let responseData = await reservationModule.estimate(dbHelper, params);
                    return res.status(responseData.status).json(responseData);
                }
                case 'check-availability': {
                    const params = { ...req.query, };
                    const responseData = await reservationModule.checkAvailability(dbHelper, params);
                    return res.status(responseData.status).json(responseData);
                }
                case 'get-payment-summary': {
                    const responseData = await reservationModule.getPaymentSummary(dbHelper, id, req.user);
                    return res.status(responseData.status).json(responseData);
                }
                default:
                    return res.status(404).json({ error: 'Unknown action', });
            }
        case 'payment':
            switch (action) {
                case 'get-payment-intent': {
                    const responseData = await paymentModule.getPaymentIntent(dbHelper, id);
                    return res.status(responseData.status).json(responseData);
                }
                case 'list-by-reservation': {
                    const responseData = await paymentModule.listPaymentsForReservation(dbHelper, id, req.user);
                    return res.status(responseData.status).json(responseData);
                }
                case 'reconcile': {
                    const responseData = await paymentModule.reconcilePaymentIntent(dbHelper, id, req.user);
                    return res.status(responseData.status).json(responseData);
                }
                default:
                    return res.status(404).json({ error: 'Unknown action', });
            }
        case 'notification':
            switch (action) {
                case 'list': {
                    const { limit, before, } = req.query;
                    const data = await notificationModule.listForUser(dbHelper, req.user.userId, { limit, before, });
                    return res.status(200).json({ status: 200, data, });
                }
                case 'count-unread': {
                    const count = await notificationModule.countUnread(dbHelper, req.user.userId);
                    return res.status(200).json({ status: 200, data: { count, }, });
                }
                default:
                    return res.status(404).json({ error: 'Unknown action', });
            }
        case 'dashboard':
            switch (action) {
                case 'get-todays-reservations-count': {
                    let responseData = await dashboardModule.getTodaysReservationCount(dbHelper, req.user);
                    return res.status(responseData.status).json(responseData);
                }
                case 'get-monthly-check-ins-count': {
                    let responseData = await dashboardModule.getMonthlyCheckInsCount(dbHelper, req.user);
                    return res.status(responseData.status).json(responseData);
                }
                case 'get-confirmed-reservations-count': {
                    let responseData = await dashboardModule.getConfirmedReservationsCount(dbHelper, req.user);
                    return res.status(responseData.status).json(responseData);
                }
                case 'get-pending-reservations-count': {
                    let responseData = await dashboardModule.getPendingReservationsCount(dbHelper, req.user);
                    return res.status(responseData.status).json(responseData);
                }
                case 'get-cancelled-reservations-count': {
                    let responseData = await dashboardModule.getCancelledReservationsCount(dbHelper, req.user);
                    return res.status(responseData.status).json(responseData);
                }
                case 'get-monthly-check-outs-count': {
                    let responseData = await dashboardModule.getMonthlyCheckOutsCount(dbHelper, req.user);
                    return res.status(responseData.status).json(responseData);
                }
                case 'get-total-guest-users': {
                    let responseData = await dashboardModule.getTotalGuestUsers(dbHelper, req.user);
                    return res.status(responseData.status).json(responseData);
                }
                default:
                    return res.status(404).json({ error: 'Unknown action', });
            }
        default:
            return res.status(404).json({ error: 'Unknown module', });
    }
};

const processPostAPI = async (req, res) => {
    const { module, action, id, } = req.params;
    const data = { ...req.body, ...req.query, };
    switch (module) {
        case 'user':
            switch (action) {
                case 'register': {
                    // let responseData = captchaHelper.verifyCaptcha(data.captcha, req.session);
                    // let verificationCode = Math.floor(100000 + Math.random() * 900000);
                    // if (responseData.status === Status.OK) {
                    //     responseData = await userModule.register(dbHelper, req.session, data, verificationCode);
                    // }
                    // if (responseData.status === Status.OK) {
                    //     await profileModule.create(dbHelper, responseData.userId);
                    //     await emailModule.sendVerificationCode(data.email, verificationCode);
                    // }
                    // captchaHelper.resetCaptcha(req.session);
                    // return res.status(responseData.status).json(responseData);
                    let responseData = await userModule.register(dbHelper, data);
                    if (responseData.status === Status.CREATED) {
                        await profileModule.createProfile(dbHelper, responseData.userId);
                    }
                    return res.status(responseData.status).json(responseData);
                }
                // case 'resend-verification-code': {
                //     let responseData = captchaHelper.verifyCaptcha(data.captcha, req.session);
                //     if (responseData.status === Status.OK) {
                //         responseData = await userModule.getVerificationCode(dbHelper, data.email);
                //     }
                //     if (responseData.status === Status.OK) {
                //         responseData = await emailModule.sendVerificationCode(data.email, responseData.verificationCode);
                //     }
                //     captchaHelper.resetCaptcha(req.session);
                //     return res.status(responseData.status).json(responseData);
                // }
                case 'login': {
                    // let responseData = captchaHelper.verifyCaptcha(data.captcha, req.session);
                    // // if (responseData.status === Status.OK) {
                    // //     responseData = await userModule.login(dbHelper, req.session, data);
                    // // }
                    // // captchaHelper.resetCaptcha(req.session);
                    // return res.status(responseData.status).json(responseData);
                    let responseData = await userModule.login(dbHelper, data);
                    return res.status(responseData.status).json(responseData);
                }
                case 'google-login': {
                    let responseData = await userModule.googleLogin(dbHelper, data);
                    return res.status(responseData.status).json(responseData);
                }
                case 'facebook-login': {
                    let responseData = await userModule.facebookLogin(dbHelper, data);
                    return res.status(responseData.status).json(responseData);
                }
                case 'logout': {
                    const { userId, jti, } = req.user || {};
                    const responseData = await userModule.logout(userId, jti);
                    return res.status(responseData.status).json(responseData);
                }
                case 'profile': {
                    let profileResponseData = await profileModule.updateProfile(dbHelper, req.session, data);
                    return res.status(profileResponseData.status).json(profileResponseData);
                }
                case 'profile-picture': {
                    let profileResponseData = await profileModule.updateProfilePic(dbHelper, req.session, data);
                    return res.status(profileResponseData.status).json(profileResponseData);
                }
                case 'change-password': {
                    let responseData = await userModule.changePassword(dbHelper, req.session, data);
                    return res.status(responseData.status).json(responseData);
                }
                case 'send-password-reset-verification-code': {
                    const responseData = await userModule.sendPasswordResetVerificationCode(dbHelper, emailModule, data);
                    return res.status(responseData.status).json(responseData);
                }
                case 'reset-password': {
                    const responseData = await userModule.resetPassword(dbHelper, data);
                    return res.status(responseData.status).json(responseData);
                }
                case 'refresh-token': {
                    let responseData = await userModule.refreshToken(dbHelper, data.refreshToken);
                    return res.status(responseData.status).json(responseData);
                }
                default:
                    return res.status(404).json({ error: 'Unknown action', });
            }
        case 'reservation':
            switch (action) {
                case 'create-reservation': {
                    let responseData = await reservationModule.addReservation(dbHelper, data, req.file, req.user, userSocketMap);
                    return res.status(responseData.status).json(responseData);
                }
                case 'cancel-booking': {
                    let responseData = await reservationModule.cancelBooking(dbHelper, id, req.user);
                    return res.status(responseData.status).json(responseData);
                }
                case 'accept-or-decline-reservation': {
                    let responseData = await reservationModule.approveOrDeclineReservation(dbHelper, id, data, req.user);
                    return res.status(responseData.status).json(responseData);
                }
                case 'get-payment-summary': {
                    const responseData = await reservationModule.getPaymentSummary(dbHelper, id, req.user);
                    return res.status(responseData.status).json(responseData);
                }
                default:
                    return res.status(404).json({ error: 'Unknown action', });
            }
        case 'facility':
            switch (action) {
                case 'create-facility': {
                    let responseData = await facilityModule.addFacility(dbHelper, data, req.file, req.user);
                    return res.status(responseData.status).json(responseData);
                }
                case 'update-facility': {
                    let responseData = await facilityModule.updateFacility(dbHelper, id, data, req.file, req.user);
                    return res.status(responseData.status).json(responseData);
                }
                case 'delete-facility': {
                    let responseData = await facilityModule.deleteFacility(dbHelper, id, req.user);
                    return res.status(responseData.status).json(responseData);
                }
                default:
                    return res.status(404).json({ error: 'Unknown action', });
            }
        case 'special-service':
            switch (action) {
                case 'create-special-service': {
                    let responseData = await specialServiceModule.addSpecialService(dbHelper, data, req.user);
                    return res.status(responseData.status).json(responseData);
                }
                case 'update-special-service': {
                    let responseData = await specialServiceModule.updateSpecialService(dbHelper, id, data, req.user);
                    return res.status(responseData.status).json(responseData);
                }
                case 'delete-special-service': {
                    let responseData = await specialServiceModule.deleteSpecialService(dbHelper, id, req.user);
                    return res.status(responseData.status).json(responseData);
                }
                default:
                    return res.status(404).json({ error: 'Unknown action', });
            }
        case 'payment':
            switch (action) {
                case 'create-payment-intent': {
                    const responseData = await paymentModule.createPaymentIntent(dbHelper, id, data, req.user);
                    return res.status(responseData.status).json(responseData);
                }
                case 'attach-payment-method': {
                    const responseData = await paymentModule.attachPaymentMethod(dbHelper, data);
                    return res.status(responseData.status).json(responseData);
                }
                case 'create-payment-method': {
                    const responseData = await paymentModule.createPaymentMethod(dbHelper, data);
                    return res.status(responseData.status).json(responseData);
                }
                // webhook handled by dedicated raw-body route at /api/payment/webhook
                default:
                    return res.status(404).json({ error: 'Unknown action', });
            }
        case 'notification':
            switch (action) {
                case 'mark-read': {
                    const { id, } = req.params;
                    await notificationModule.markRead(dbHelper, id, req.user.userId);
                    return res.status(200).json({ status: 200, });
                }
                case 'mark-all-read': {
                    await notificationModule.markAllRead(dbHelper, req.user.userId);
                    return res.status(200).json({ status: 200, });
                }
                default:
                    return res.status(404).json({ error: 'Unknown action', });
            }
        default:
            return res.status(404).json({ error: 'Unknown module', });
    }
};

function authenticateJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const user = jwtHelper.verifyAccessToken(token);
        if (!user) {
            return res.status(401).json({ error: 'Invalid or expired token', });
        }
        req.user = user;
        next();
    } else {
        res.status(401).json({ error: 'Authorization header missing or malformed', });
    }
}

function isProtected(module, action) {
    const protectedEndpoints = {
        user: ['profile', 'logout', 'change-password',],
        profile: ['update', 'uploadPicture',],
        reservation: ['create-reservation', 'get-reservation-by-user-id', 'cancel-booking',
            'get-all-reservations-by-status', 'accept-or-decline-reservation', 'get-payment-summary',],
        facility: ['create-facility', 'update-facility', 'delete-facility',],
        'special-service': ['create-special-service', 'update-special-service', 'delete-special-service',],
        payment: ['create-payment-intent', 'attach-payment-method', 'create-payment-method', 'list-by-reservation', 'reconcile',],
        notification: ['list', 'mark-read', 'mark-all-read', 'count-unread',],
        dashboard: ['get-todays-reservations-count', 'get-monthly-check-ins-count', 'get-monthly-check-outs-count',
            'get-confirmed-reservations-count', 'get-pending-reservations-count', 'get-cancelled-reservations-count', 'get-total-guest-users',],
    };
    return protectedEndpoints[module] && protectedEndpoints[module].includes(action);
}

// const sessionParser = session({
//   store: new RedisStore({ client: redisClient, prefix: 'sess:' }),
//   secret: process.env.SESSION_KEY,
//   resave: false,
//   saveUninitialized: false,
//   cookie: {
//     maxAge: 30 * 60 * 1000 * 24,
//     secure: process.env.NODE_ENV === 'production',
//     httpOnly: true
//   }
// });

// app.use(sessionParser);

// app.use(express.static(__clientPath));

// app.get('/', (req, res) => {
//     res.sendFile(path.join(__clientPath, 'index.html'));
// });

// app.get('/api/auth/captcha', basicLimiter, async (req, res) => {
//     res.json(await captchaHelper.handleCaptcha(req.session));
// });

// app.get('/api/user/verify-verification-code', verificationLimiter, async (req, res) => {
//     req.params.module = 'user';
//     req.params.action = 'verify-verification-code';
//     await processGetAPI(req, res);
// });

// (route moved above express.json())

app.get('/api/:module/:action', basicLimiter, (req, res) => {
    if (isProtected(req.params.module, req.params.action)) {
        authenticateJWT(req, res, () => processGetAPI(req, res));
    } else {
        processGetAPI(req, res);
    }
});

app.post('/api/:module/:action', basicLimiter, (req, res) => {
    const { module, action, } = req.params;
    if (module === 'reservation' && action === 'create-reservation') {
        uploadLetter(req, res, (err) => {
            if (err) return res.status(400).json({ error: 'File upload error', details: err.message, });
            if (isProtected(module, action)) {
                authenticateJWT(req, res, () => processPostAPI(req, res));
            } else {
                processPostAPI(req, res);
            }
        });
    } else if (module === 'facility' && (action === 'create-facility' || action === 'update-facility')) {
        uploadImage(req, res, (err) => {
            if (err) return res.status(400).json({ error: 'File upload error', details: err.message, });
            if (isProtected(module, action)) {
                authenticateJWT(req, res, () => processPostAPI(req, res));
            } else {
                processPostAPI(req, res);
            }
        });
    } else {
        if (isProtected(module, action)) {
            authenticateJWT(req, res, () => processPostAPI(req, res));
        } else {
            processPostAPI(req, res);
        }
    }
});

app.get('/api/:module/:action/:id', basicLimiter, (req, res) => {
    if (isProtected(req.params.module, req.params.action)) {
        authenticateJWT(req, res, () => processGetAPI(req, res));
    } else {
        processGetAPI(req, res);
    }
});

app.post('/api/:module/:action/:id', basicLimiter, (req, res) => {
    const { module, action, } = req.params;

    if (module === 'reservation' && action === 'update-reservation') {
        uploadLetter(req, res, (err) => {
            if (err) return res.status(400).json({ error: 'File upload error', details: err.message, });
            if (isProtected(module, action)) {
                authenticateJWT(req, res, () => processPostAPI(req, res));
            } else {
                processPostAPI(req, res);
            }
        });
    } else if (module === 'facility' && (action === 'update-facility' || action === 'create-facility')) {
        uploadImage(req, res, (err) => {
            if (err) return res.status(400).json({ error: 'File upload error', details: err.message, });
            if (isProtected(module, action)) {
                authenticateJWT(req, res, () => processPostAPI(req, res));
            } else {
                processPostAPI(req, res);
            }
        });
    } else {
        if (isProtected(module, action)) {
            authenticateJWT(req, res, () => processPostAPI(req, res));
        } else {
            processPostAPI(req, res);
        }
    }
});

app.use((req, res) => {
    res.redirect('../error-404.html');
});

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true, });
const userSocketMap = new Map();

server.on('upgrade', (req, socket, head) => {
    const { pathname, searchParams, } = new URL(req.url, `http://${req.headers.host}`);
    if (pathname !== '/socket') {
        socket.destroy();
        return;
    }

    let token = searchParams.get('token');
    if (!token) {
        const protoHeader = req.headers['sec-websocket-protocol'];
        if (protoHeader) {
            const parts = protoHeader.split(',').map((s) => s.trim());
            token = parts.find((p) => p && p.toLowerCase() !== 'bearer') || null;
        }
    }

    const user = token ? jwtHelper.verifyAccessToken(token) : null;
    if (!user) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
    }

    req.user = user;
    wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
    });
});

wss.on('connection', (ws, req) => {
    const userId = req.user.userId;
    userSocketMap.set(userId, ws);
    ws.isAlive = true;

    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('close', () => {
        userSocketMap.delete(userId);
    });

    ws.on('error', () => {
        userSocketMap.delete(userId);
    });

    ws.on('message', (msg) => {
        console.log(`WS from ${userId}:`, msg.toString());
    });
});

const interval = setInterval(() => {
    for (const [uid, ws,] of userSocketMap.entries()) {
        if (ws.isAlive === false) {
            userSocketMap.delete(uid);
            ws.terminate();
            continue;
        }
        ws.isAlive = false;
        ws.ping();
    }
}, 30000);

wss.on('close', () => clearInterval(interval));

server.listen(port, () => {
    console.log(`API listening at http://localhost:${port}`);
});
