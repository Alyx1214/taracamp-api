import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { authenticateJWT } from '../middleware/auth.js';
import reportModule from '../modules/report.js';

const reportRoutes = Router();

reportRoutes.use(authenticateJWT);

reportRoutes.post('/generate-pdf', asyncHandler(async (req, res) => {
  const { month, year } = req.body || {};
  await reportModule.generateAccommodationReportPDF({ month, year }, res);
}));

export default reportRoutes;


