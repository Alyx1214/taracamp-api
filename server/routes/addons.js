import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { authenticateJWT } from '../middleware/auth.js';
import dbHelper from '../modules/dbHelper.js';
import addonsModule from '../modules/addons.js';

const r = Router();

r.get('/get-all-addons', asyncHandler(async (req, res) => {
  const response = await addonsModule.getAllAddons(dbHelper, req.query);
  res.status(response.status).json(response);
}));

r.get('/get-addon-by-id/:id', asyncHandler(async (req, res) => {
  const response = await addonsModule.getAddonById(dbHelper, req.params.id);
  res.status(response.status).json(response);
}));

r.get('/search-addons', asyncHandler(async (req, res) => {
  const response = await addonsModule.searchAddons(dbHelper, req.query);
  res.status(response.status).json(response);
}));

r.use(authenticateJWT);

r.post('/create-addon', asyncHandler(async (req, res) => {
  const response = await addonsModule.addAddon(
    dbHelper,
    { ...req.body, ...req.query },
    req.user
  );
  res.status(response.status).json(response);
}));

r.post('/update-addon/:id', asyncHandler(async (req, res) => {
  const response = await addonsModule.updateAddon(
    dbHelper,
    req.params.id,
    req.body,
    req.user
  );
  res.status(response.status).json(response);
}));

r.post('/delete-addon/:id', asyncHandler(async (req, res) => {
  const response = await addonsModule.deleteAddon(
    dbHelper,
    req.params.id,
    req.user
  );
  res.status(response.status).json(response);
}));

export default r;