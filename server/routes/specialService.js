import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { authenticateJWT } from '../middleware/auth.js';
import dbHelper from '../modules/dbHelper.js';
import specialServiceModule from '../modules/specialService.js';

const r = Router();

r.get('/get-all-special-services', asyncHandler(async (req, res) => {
  const response = await specialServiceModule.getAllSpecialServices(dbHelper, req.query);
  res.status(response.status).json(response);
}));

r.get('/get-special-service-by-id/:id', asyncHandler(async (req, res) => {
  const response = await specialServiceModule.getSpecialServiceById(dbHelper, req.params.id);
  res.status(response.status).json(response);
}));

r.get('/search-special-services', asyncHandler(async (req, res) => {
  const response = await specialServiceModule.searchSpecialServices(dbHelper, req.query);
  res.status(response.status).json(response);
}));

r.use(authenticateJWT);

r.post('/create-special-service', asyncHandler(async (req, res) => {
  const response = await specialServiceModule.addSpecialService(
    dbHelper,
    { ...req.body, ...req.query },
    req.user
  );
  res.status(response.status).json(response);
}));

r.post('/update-special-service/:id', asyncHandler(async (req, res) => {
  const response = await specialServiceModule.updateSpecialService(
    dbHelper,
    req.params.id,
    req.body,
    req.user
  );
  res.status(response.status).json(response);
}));

r.post('/delete-special-service/:id', asyncHandler(async (req, res) => {
  const response = await specialServiceModule.deleteSpecialService(
    dbHelper,
    req.params.id,
    req.user
  );
  res.status(response.status).json(response);
}));

export default r;
