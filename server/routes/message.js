import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { authenticateJWT } from '../middleware/auth.js';
import dbHelper from '../modules/dbHelper.js';
import messageModule from '../modules/message.js';

const buildMessageRouter = (userSocketMap) => {
  const r = Router();

r.use(authenticateJWT);

r.get('/list', asyncHandler(async (req, res) => {
  const response = await messageModule.listForUser(
    dbHelper,
    req.user?.userId,
    { limit: req.query.limit, before: req.query.before }
  );
  res.status(response.status).json(response);
}));

r.get('/count-unread', asyncHandler(async (req, res) => {
  const response = await messageModule.countUnread(dbHelper, req.user?.userId);
  res.status(response.status).json(response);
}));

r.post('/send', asyncHandler(async (req, res) => {
  const response = await messageModule.sendMessage(dbHelper, req.user, req.body, {}, userSocketMap);
  res.status(response.status).json(response);
}));

r.post('/mark-read/:id', asyncHandler(async (req, res) => {
  const response = await messageModule.markRead(
    dbHelper,
    req.params.id,
    req.user?.userId
  );
  res.status(response.status).json(response);
}));

r.post('/mark-all-read', asyncHandler(async (req, res) => {
  const response = await messageModule.markAllRead(dbHelper, req.user?.userId);
  res.status(response.status).json(response);
}));

// Automated response management routes (admin only)
r.get('/auto-response/config', asyncHandler(async (req, res) => {
  const response = await messageModule.getAutoResponseConfig(dbHelper, req.user?.userId);
  res.status(response.status).json(response);
}));

r.post('/auto-response/config', asyncHandler(async (req, res) => {
  const response = await messageModule.updateAutoResponseConfig(dbHelper, req.user?.userId, req.body);
  res.status(response.status).json(response);
}));

r.post('/auto-response/test', asyncHandler(async (req, res) => {
  const response = await messageModule.testAutoResponse(dbHelper, req.user?.userId, req.body.message);
  res.status(response.status).json(response);
}));

// Admin-only routes for managing user messages
r.get('/admin/users', asyncHandler(async (req, res) => {
  const response = await messageModule.listUsersWithMessages(dbHelper, req.user);
  res.status(response.status).json(response);
}));

r.get('/admin/user/:userId/messages', asyncHandler(async (req, res) => {
  const response = await messageModule.getMessagesForUser(
    dbHelper,
    req.user,
    req.params.userId,
    { limit: req.query.limit, before: req.query.before }
  );
  res.status(response.status).json(response);
}));

r.post('/admin/reply/:userId', asyncHandler(async (req, res) => {
  const response = await messageModule.sendAdminReply(
    dbHelper,
    req.user,
    req.params.userId,
    req.body,
    userSocketMap
  );
  res.status(response.status).json(response);
}));

  return r;
};

export default buildMessageRouter;
