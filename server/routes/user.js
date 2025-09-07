import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { authenticateJWT } from '../middleware/auth.js';
import dbHelper from '../modules/dbHelper.js';
import userModule from '../modules/user.js';
import profileModule from '../modules/profile.js';
import emailModule from '../modules/email.js';

const r = Router();

r.post('/register', asyncHandler(async (req, res) => {
  const data = { ...req.body, ...req.query };
  const response = await userModule.register(dbHelper, data);
  if (response.status === 201 && response.userId) {
    await profileModule.createProfile(dbHelper, response.userId);
  }
  res.status(response.status).json(response);
}));

r.post('/login', asyncHandler(async (req, res) => {
  const response = await userModule.login(dbHelper, req.body);
  res.status(response.status).json(response);
}));

r.post('/google-login', asyncHandler(async (req, res) => {
  const response = await userModule.googleLogin(dbHelper, req.body);
  res.status(response.status).json(response);
}));

r.post('/facebook-login', asyncHandler(async (req, res) => {
  const response = await userModule.facebookLogin(dbHelper, req.body);
  res.status(response.status).json(response);
}));


r.post('/send-password-reset-verification-code', asyncHandler(async (req, res) => {
  const response = await userModule.sendPasswordResetVerificationCode(dbHelper, emailModule, req.body);
  res.status(response.status).json(response);
}));

r.post('/reset-password', asyncHandler(async (req, res) => {
  const response = await userModule.resetPassword(dbHelper, req.body);
  res.status(response.status).json(response);
}));

r.post('/refresh-token', asyncHandler(async (req, res) => {
  const response = await userModule.refreshToken(dbHelper, req.body.refreshToken);
  res.status(response.status).json(response);
}));

r.use(authenticateJWT);

r.get('/profile', asyncHandler(async (req, res) => {
  const userResp = await userModule.getUser?.(dbHelper, req.user);
  const profileResp = await profileModule.getProfile(dbHelper, req.user);
  const merged = { ...profileResp, data: { ...userResp?.data, ...profileResp.data } };
  res.status(profileResp.status).json(merged);
}));

r.get('/get-all-users-by-role/:role', asyncHandler(async (req, res) => {
  const response = await userModule.getAllUsersByRole(dbHelper, req.params.role, req.user);
  res.status(response.status).json(response);
}));

r.get('/search-users', asyncHandler(async (req, res) => {
  const response = await userModule.searchUsers(dbHelper, req.query, req.user);
  res.status(response.status).json(response);
}));

r.post('/add-user', asyncHandler(async (req, res) => {
  const response = await userModule.addUser(dbHelper, req.body, req.user);
  res.status(response.status).json(response);
}));

r.post('/logout', asyncHandler(async (req, res) => {
  const { userId, jti } = req.user || {};
  const response = await userModule.logout(userId, jti);
  res.status(response.status).json(response);
}));

r.post('/profile', asyncHandler(async (req, res) => {
  const response = await profileModule.updateProfile(dbHelper, req.session, req.body);
  res.status(response.status).json(response);
}));

r.post('/profile-picture', asyncHandler(async (req, res) => {
  const response = await profileModule.updateProfilePic(dbHelper, req.session, req.body);
  res.status(response.status).json(response);
}));

r.post('/change-password', asyncHandler(async (req, res) => {
  const response = await userModule.changePassword(dbHelper, req.session, req.body);
  res.status(response.status).json(response);
}));

export default r;
