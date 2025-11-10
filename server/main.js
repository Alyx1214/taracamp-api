import express from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';

import dbHelper from './modules/dbHelper.js';
import redisClient from './modules/redisClient.js';
import jwtHelper from './modules/jwtHelper.js';
import paymentModule from './modules/payment.js';
import notificationModule from './modules/notification.js';

import buildUserRouter from './routes/user.js';
import facilityRoutes from './routes/facility.js';
import addonRoutes from './routes/addons.js';
import buildReservationRouter from './routes/reservation.js';
import buildPaymentRouter from './routes/payment.js';
import notificationRoutes from './routes/notification.js';
import dashboardRoutes from './routes/dashboard.js';
import reviewRoutes from './routes/reviews.js';
import buildMessageRouter from './routes/message.js';
import reportRoutes from './routes/report.js';

import { basicLimiter } from './middleware/limiter.js';
import asyncHandler from './middleware/asyncHandler.js';
import requestIdMiddleware from './middleware/requestId.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const port = process.env.PORT || 3000;
const dbConnectionString = process.env.DB_CONN;

dbHelper.connect(dbConnectionString);

const app = express();
app.set('trust proxy', 1);
await redisClient.connect();

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      console.log('CORS: Request with no origin, allowing');
      return callback(null, true);
    }
    
    // Normalize origin (remove trailing slash if present)
    const normalizedOrigin = origin.endsWith('/') ? origin.slice(0, -1) : origin;
    
    console.log(`CORS: Checking origin: ${normalizedOrigin}`);
    
    if (allowedOrigins.includes(normalizedOrigin)) {
      console.log(`CORS: Origin ${normalizedOrigin} is allowed`);
      callback(null, normalizedOrigin);
    } else {
      console.log(`CORS: Origin ${normalizedOrigin} is NOT allowed`);
      console.log(`CORS: Allowed origins:`, allowedOrigins);
      callback(new Error(`Not allowed by CORS: ${normalizedOrigin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID']
}));

app.use('/api/v1/payment/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(requestIdMiddleware);

const userSocketMap = new Map();
app.use('/api/v1', basicLimiter, (req, res, next) => {
  const r = express.Router();
  r.use('/user', buildUserRouter(userSocketMap));
  r.use('/facility', facilityRoutes);
  r.use('/addons', addonRoutes);
  r.use('/reservation', buildReservationRouter(userSocketMap));
  r.use('/payment', buildPaymentRouter(userSocketMap));
  r.use('/notification', notificationRoutes);
  r.use('/dashboard', dashboardRoutes);
  r.use('/reviews', reviewRoutes);
  r.use('/message', buildMessageRouter(userSocketMap));
  r.use('/report', reportRoutes);
  return r(req, res, next);
});

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.use((err, req, res, _next) => {
  const status = err.status || 500;
  res.status(status).json({ status, error: err.message || 'Server error' });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  try {
    const { pathname, searchParams } = new URL(req.url, `http://${req.headers.host}`);
    if (pathname !== '/socket') {
      socket.destroy();
      return;
    }

    let token = searchParams.get('token');
    if (!token) {
      const protoHeader = req.headers['sec-websocket-protocol'];
      if (protoHeader) {
        const parts = protoHeader.split(',').map(s => s.trim());
        token = parts.find(p => p && p.toLowerCase() !== 'bearer') || null;
      }
    }

    const user = token ? jwtHelper.verifyAccessToken(token) : null;
    if (!user) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    req.user = user;
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
  } catch {
    socket.destroy();
  }
});

wss.on('connection', (ws, req) => {
  // Ensure userId is a string for consistent Map key matching
  const userId = req.user.userId?.toString?.() || String(req.user.userId || '');
  userSocketMap.set(userId, ws);
  ws.isAlive = true;

  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('close', () => userSocketMap.delete(userId));
  ws.on('error', () => userSocketMap.delete(userId));
  ws.on('message', msg => {
    console.log(`WS from ${userId}:`, msg.toString());
  });
});

const interval = setInterval(() => {
  for (const [uid, ws] of userSocketMap.entries()) {
    if (!ws.isAlive) {
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
