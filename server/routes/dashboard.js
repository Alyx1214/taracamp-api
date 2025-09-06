import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { authenticateJWT } from '../middleware/auth.js';
import dbHelper from '../modules/dbHelper.js';
import dashboardModule from '../modules/dashboard.js';

const r = Router();

r.use(authenticateJWT);

r.get('/get-monthly-reservations', asyncHandler(async (req, res) => {
  const response = await dashboardModule.getMonthlyReservations(dbHelper, req.user, req.query.year);
  res.status(response.status).json(response);
}));

r.get('/get-dashboard-stats', asyncHandler(async (req, res) => {
  const response = await dashboardModule.getDashboardStats(dbHelper, req.user);
  res.status(response.status).json(response);
}));

r.get('/get-reservations-for-calendar', asyncHandler(async (req, res) => {
  const { year, month } = req.query;
  const response = await dashboardModule.getReservationsForCalendar(dbHelper, req.user, year, month);
  res.status(response.status).json(response);
}));

export default r;
