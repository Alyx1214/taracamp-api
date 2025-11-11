import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { authenticateJWT } from '../middleware/auth.js';
import jwtHelper from '../modules/jwtHelper.js';
import dbHelper from '../modules/dbHelper.js';
import reviewModule from '../modules/review.js';

const r = Router();

r.get('/get-reviews-by-facility-id/:id', asyncHandler(async (req, res) => {
  // Optionally check authentication - don't require it
  let user = null;
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    user = jwtHelper.verifyAccessToken(token);
  }
  
  const response = await reviewModule.getReviewsByFacility(
    dbHelper,
    req.params.id,
    req.query,
    user
  );
  res.status(response.status).json(response);
}));

r.get('/get-reviews-by-user/:userId', asyncHandler(async (req, res) => {
  const response = await reviewModule.getReviewsByUser(
    dbHelper,
    req.params.userId,
    req.query
  );
  res.status(response.status).json(response);
}));

r.use(authenticateJWT);

r.post('/add-review', asyncHandler(async (req, res) => {
  const response = await reviewModule.addReview(
    dbHelper,
    req.body,
    req.user
  );
  res.status(response.status).json(response);
}));

r.post('/update-review/:id', asyncHandler(async (req, res) => {
  const response = await reviewModule.updateReview(
    dbHelper,
    req.params.id,
    req.body,
    req.user
  );
  res.status(response.status).json(response);
}));

r.post('/delete-review/:id', asyncHandler(async (req, res) => {
  const response = await reviewModule.deleteReview(
    dbHelper,
    req.params.id,
    req.user
  );
  res.status(response.status).json(response);
}));

r.post('/admin-reply/:id', asyncHandler(async (req, res) => {
  const response = await reviewModule.addAdminReply(
    dbHelper,
    req.params.id,
    req.body.replyText,
    req.user
  );
  res.status(response.status).json(response);
}));

r.post('/toggle-visibility/:id', asyncHandler(async (req, res) => {
  const response = await reviewModule.toggleReviewVisibility(
    dbHelper,
    req.params.id,
    req.body.hidden,
    req.user
  );
  res.status(response.status).json(response);
}));

export default r;