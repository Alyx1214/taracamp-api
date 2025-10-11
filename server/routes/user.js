import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { authenticateJWT } from '../middleware/auth.js';
import dbHelper from '../modules/dbHelper.js';
import userModule from '../modules/user.js';
import profileModule from '../modules/profile.js';
import notificationModule from '../modules/notification.js';
import emailModule from '../modules/email.js';
import { Status } from '../constants.js';

export default function buildUserRouter(userSocketMap) {
  const r = Router();

  r.post('/register', asyncHandler(async (req, res) => {
    const result = await userModule.register(dbHelper, req.body);
    if (result.status === Status.CREATED) {
      await notificationModule.createAndNotifyUser(dbHelper, {
        userId: result.userId,
        title: 'Welcome to Teachers Camp!',
        message: 'Thank you for joining Teachers Camp. We\'re thrilled to have you aboard - let\'s make some memories!',
        kind: 'welcome',
      }, userSocketMap);
    }
    res.status(result.status).json(result);
  }));

  r.post('/login', asyncHandler(async (req, res) => {
    const response = await userModule.login(dbHelper, req.body);
    res.status(response.status).json(response);
  }));

  r.post('/google-login', asyncHandler(async (req, res) => {
    const result = await userModule.googleLogin(dbHelper, req.body);
    if (result.status === Status.OK && result.isNewUser) {
      await notificationModule.createAndNotifyUser(dbHelper, {
        userId: result.userId,
        title: 'Welcome to Teachers Camp!',
        message: 'Thank you for joining Teachers Camp. We\'re thrilled to have you aboard - let\'s make some memories!',
        kind: 'welcome',
      }, userSocketMap);
    }

    return res.status(result.status).json(result);
  }));

  r.post('/facebook-login', asyncHandler(async (req, res) => {
    const result = await userModule.facebookLogin(dbHelper, req.body);

    if (result.status === Status.OK && result.isNewUser) {
      await notificationModule.createAndNotifyUser(dbHelper, {
        userId: result.userId,
        title: 'Welcome to Teachers Camp!',
        message: 'Thank you for joining Teachers Camp. We\'re thrilled to have you aboard - let\'s make some memories!',
        kind: 'welcome',
      }, userSocketMap);
    }

    return res.status(result.status).json(result);
  }));

  r.post('/send-password-reset-verification-code', asyncHandler(async (req, res) => {
    const response = await userModule.sendPasswordResetVerificationCode(dbHelper, emailModule, req.body);
    res.status(response.status).json(response);
  }));

  r.post('/verify-password-reset-code', asyncHandler(async (req, res) => {
    const response = await userModule.verifyPasswordResetCode(dbHelper, req.body);
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

  r.post('/delete-user/:id', asyncHandler(async (req, res) => {
    const response = await userModule.deleteUser(dbHelper, req.params.id, req.user);
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

  return r;
}
