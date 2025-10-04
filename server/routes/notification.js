import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { authenticateJWT } from '../middleware/auth.js';
import dbHelper from '../modules/dbHelper.js';
import notificationModule from '../modules/notification.js';

const r = Router();

r.use(authenticateJWT);

r.get('/list', asyncHandler(async (req, res) => {
  const { limit, before } = req.query;
  const result = await notificationModule.listForUser(dbHelper, req.user.userId, { limit, before });
  res.status(result?.status ?? 200).json(result);
}));

r.get('/count-unread', asyncHandler(async (req, res) => {
  const result = await notificationModule.countUnread(dbHelper, req.user.userId);
  res.status(result?.status ?? 200).json(result);
}));

r.post('/mark-read/:id', asyncHandler(async (req, res) => {
  const result = await notificationModule.markRead(dbHelper, req.params.id, req.user.userId);
  res.status(result?.status ?? 200).json(result);
}));

r.post('/mark-all-read', asyncHandler(async (req, res) => {
  const result = await notificationModule.markAllRead(dbHelper, req.user.userId);
  res.status(result?.status ?? 200).json(result);
}));

export default r;
