import express from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';

import dbHelper from './modules/dbHelper.js';
import redisClient from './modules/redisClient.js';
import jwtHelper from './modules/jwtHelper.js';
import paymentModule from './modules/payment.js';

import userRoutes from './routes/user.js';
import facilityRoutes from './routes/facility.js';
import addonRoutes from './routes/addons.js';
import buildReservationRouter from './routes/reservation.js';
import paymentRoutes from './routes/payment.js';
import notificationRoutes from './routes/notification.js';
import dashboardRoutes from './routes/dashboard.js';
import reviewRoutes from './routes/reviews.js';

import { basicLimiter } from './middleware/limiter.js';
import asyncHandler from './middleware/asyncHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const port = process.env.PORT || 8080;
const dbConnectionString = process.env.DB_CONN;

dbHelper.connect(dbConnectionString);

const app = express();
app.set('trust proxy', 1);
await redisClient.connect();

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5174', 'https://taracamp-api.vercel.app'],
  credentials: true
}));

app.post(
  '/api/payment/webhook',
  basicLimiter,
  express.raw({ type: 'application/json' }),
  asyncHandler(async (req, res) => {
    const raw = Buffer.isBuffer(req.body)
      ? req.body.toString('utf8')
      : typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body || {});
    const response = await paymentModule.handleWebhook(dbHelper, req.headers, raw);
    res.status(response.status).json(response);
  })
);

app.use(express.json());
const userSocketMap = new Map();
app.use('/api/v1', basicLimiter, (req, res, next) => {
  const r = express.Router();
  r.use('/user', userRoutes);
  r.use('/facility', facilityRoutes);
  r.use('/addons', addonRoutes);
  r.use('/reservation', buildReservationRouter(userSocketMap));
  r.use('/payment', paymentRoutes);
  r.use('/notification', notificationRoutes);
  r.use('/dashboard', dashboardRoutes);
  r.use('/reviews', reviewRoutes);
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
  const userId = req.user.userId;
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
