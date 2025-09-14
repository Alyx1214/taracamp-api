import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { authenticateJWT } from '../middleware/auth.js';
import dbHelper from '../modules/dbHelper.js';
import reviewModule from '../modules/review.js';

const r = Router();

r.get('/get-reviews-by-facility-id/:id', asyncHandler(async (req, res) => {
  const response = await reviewModule.getReviewsByFacility(
    dbHelper,
    req.params.id,
    req.query
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

export default r;