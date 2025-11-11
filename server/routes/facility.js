import { Router } from 'express';
import compression from 'compression';
import asyncHandler from '../middleware/asyncHandler.js';
import { authenticateJWT } from '../middleware/auth.js';
import { uploadImages } from '../middleware/uploads.js';
import dbHelper from '../modules/dbHelper.js';
import facilityModule from '../modules/facility.js';

const r = Router();

r.use(compression());

r.get('/get-all-facilities', asyncHandler(async (req, res) => {
  const response = await facilityModule.getAllFacilities(dbHelper, req.query);
  res.status(response.status).json(response);
}));

r.get('/get-facility-by-id/:id', asyncHandler(async (req, res) => {
  const response = await facilityModule.getFacilityById(dbHelper, req.params.id);
  res.status(response.status).json(response);
}));

r.get('/get-facilities-by-type/:id', asyncHandler(async (req, res) => {
  const response = await facilityModule.getFacilitiesByType(dbHelper, req.params.id, req.query);
  res.status(response.status).json(response);
}));

r.get('/get-available-dates-by-facility/:id', asyncHandler(async (req, res) => {
  const response = await facilityModule.getAvailableDatesByFacility(dbHelper, req.params.id);
  res.status(response.status).json(response);
}));

r.get('/search-facilities', asyncHandler(async (req, res) => {
  const response = await facilityModule.searchFacilities(dbHelper, req.query);
  res.status(response.status).json(response);
}));

r.use(authenticateJWT);

r.post('/create-facility', uploadImages, asyncHandler(async (req, res) => {
  const response = await facilityModule.addFacility(
    dbHelper,
    { ...req.body, ...req.query },
    req.files,
    req.user
  );
  res.status(response.status).json(response);
}));

r.post('/update-facility/:id', uploadImages, asyncHandler(async (req, res) => {
  const response = await facilityModule.updateFacility(
    dbHelper,
    req.params.id,
    { ...req.body, ...req.query },
    req.files,
    req.user
  );
  res.status(response.status).json(response);
}));

r.post('/delete-facility/:id', asyncHandler(async (req, res) => {
  const response = await facilityModule.deleteFacility(dbHelper, req.params.id, req.user);
  res.status(response.status).json(response);
}));

r.post('/update-rooms/:id', asyncHandler(async (req, res) => {
  const response = await facilityModule.updateRooms(
    dbHelper,
    req.params.id,
    req.body,
    req.user
  );
  res.status(response.status).json(response);
}));

export default r;
