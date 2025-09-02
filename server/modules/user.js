import bcrypt from 'bcryptjs';
import { Status, UserRole, } from '../constants.js';
import { OAuth2Client, } from 'google-auth-library';
import fetch from 'node-fetch';
import jwtHelper from './jwtHelper.js';
import redisClient from './redisClient.js';
import { v4 as uuidv4, } from 'uuid';
import crypto from 'crypto';

const userModule = {
    /**
     * Registers a new user.
     * @param {object} dbHelper - The database helper for database operations.
     * @param {object} data - The data object containing the email, firstName, lastName, and password fields.
     * @returns {object} Response data with status, error, message, and userId on success.
     */
    register: async (dbHelper, data) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error on registering user',
        };

        try {
            let { email, firstName, lastName, password, } = data;

            if (!isPresent(email) || !isPresent(firstName) || !isPresent(lastName) || !isPresent(password)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Missing required fields';
                return responseData;
            }

            const name = `${firstName} ${lastName}`.replace(/\s+/g, ' ');

            if (!isValidEmail(email.toLowerCase())) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid email address';
                return responseData;
            }

            if (!isValidPassword(password)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid password';
                return responseData;
            }

            if (!isValidName(firstName) || !isValidName(lastName)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid name';
                return responseData;
            }

            const emailExists = await dbHelper.findOne('user', { email, });
            if (emailExists) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Email already exists';
                return responseData;
            }

            const userCreated = await dbHelper.create('user', {
                email,
                name,
                password: await hashPassword(password),
                role: UserRole.GUEST,
                createdAt: Date.now(),
                lastLoggedIn: null,
            });

            // Uncomment if you want automatic login after registration
            // Generate tokens with JTI (consistent with login)
            // const jti = uuidv4();
            // const safeUser = {
            //     _id: userCreated._id.toString(),
            //     email: userCreated.email,
            //     role: userCreated.role,
            //     jti
            // };

            // const accessToken = jwtHelper.generateAccessToken(safeUser);
            // const refreshToken = jwtHelper.generateRefreshToken(safeUser);
            // const userId = userCreated._id.toString();

            // await redisClient.set(`rt:${userId}:${jti}`, refreshToken, { EX: 7 * 24 * 60 * 60 });

            responseData.status = Status.CREATED;
            responseData.error = null;
            responseData.message = 'User registered successfully';
            // responseData.accessToken = accessToken;
            // responseData.refreshToken = refreshToken;
            responseData.userId = userCreated._id.toString();
            responseData.role = userCreated.role;

        } catch (error) {
            console.error('Error registering user:', error);

            if (error && (error.code === 11000 || error.code === 'ER_DUP_ENTRY')) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Email already exists';
            } else {
                responseData.status = Status.INTERNAL_SERVER_ERROR;
                responseData.error = 'Error on registering user';
            }
        }
        return responseData;
    },

    /**
     * Logs in a user to the system
     * @param {object} dbHelper - The database helper object
     * @param {object} data - The data object containing the email and password fields
     * @returns {object} The response data object containing the status, tokens, and user info
     */
    login: async (dbHelper, data) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error on logging in user',
        };

        try {
            let { email, password, } = data;

            if (!isPresent(email) || !isPresent(password)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Missing required fields';
                return responseData;
            }

            if (!isValidEmail(email)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid email address';
                return responseData;
            }

            const userObject = await dbHelper.findOne('user', { email, });
            if (!userObject) {
                await new Promise((r) => setTimeout(r, 100));
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'Invalid credentials';
                return responseData;
            }

            if (!userObject || !userObject.password) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'Invalid credentials.';
                return responseData;
            }

            const match = await bcrypt.compare(password, userObject.password);
            if (!match) {
                await new Promise((r) => setTimeout(r, 100));
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'Invalid credentials';
                return responseData;
            }

            const jti = uuidv4();
            const userId = userObject._id.toString();
            const safeUser = {
                _id: userId,
                email: userObject.email,
                role: userObject.role,
                jti,
            };

            const accessToken = jwtHelper.generateAccessToken(safeUser);
            const refreshToken = jwtHelper.generateRefreshToken(safeUser);

            const REFRESH_TTL = 7 * 24 * 60 * 60;
            await redisClient.set(`rt:${userId}:${jti}`, refreshToken, { EX: REFRESH_TTL, });

            await dbHelper.updateOne('user', { _id: userObject._id, }, { lastLoggedIn: Date.now(), });

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = 'User logged in successfully';
            responseData.accessToken = accessToken;
            responseData.refreshToken = refreshToken;
            responseData.jti = jti;
            responseData.userId = userId;
            responseData.role = userObject.role;

        } catch (error) {
            console.error('Error logging in user:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error on logging in user';
        }

        return responseData;
    },

    /**
     * Logs in or registers a user via Google OAuth.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {Object} data - The data object containing the Google ID token.
     * @returns {Object} Response data with status, error, message, and userId on success.
     */
    googleLogin: async (dbHelper, data) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error on logging in with Google',
        };

        try {
            const code = data?.code || data?.token;
            if (!code) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Missing Google authorization code';
                return responseData;
            }

            if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
                responseData.status = Status.INTERNAL_SERVER_ERROR;
                responseData.error = 'Server misconfigured: missing Google credentials';
                return responseData;
            }

            const client = new OAuth2Client(
                process.env.GOOGLE_CLIENT_ID,
                process.env.GOOGLE_CLIENT_SECRET,
                'postmessage'
            );

            let tokens;
            try {
                const r = await client.getToken({
                    code,
                    redirect_uri: 'postmessage',
                    grant_type: 'authorization_code',
                });
                tokens = r.tokens;
            } catch (e) {
                const detail = e?.response?.data || e?.message || e;
                console.error('Google token exchange failed:', detail);
                responseData.status = Status.BAD_GATEWAY;
                responseData.error = 'google_exchange_failed';
                responseData.detail = detail;
                return responseData;
            }

            const idToken = tokens?.id_token;
            if (!idToken) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'No id_token from Google';
                responseData.detail = tokens;
                return responseData;
            }

            const ticket = await client.verifyIdToken({
                idToken,
                audience: process.env.GOOGLE_CLIENT_ID,
            });
            const payload = ticket.getPayload();

            const googleId = payload?.sub;
            const name = payload?.name || '';
            const email = (payload?.email || '').trim().toLowerCase();

            if (!googleId || payload?.email_verified !== true) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'Google email not verified';
                return responseData;
            }

            let user = await dbHelper.findOne('user', { googleId, });
            if (!user) {
                if (email) {
                    const emailOwner = await dbHelper.findOne('user', { email, });
                    if (emailOwner) {
                        responseData.status = Status.BAD_REQUEST;
                        responseData.error = 'Email already exists';
                        return responseData;
                    }
                }

                user = await dbHelper.create('user', {
                    email: email || null,
                    name,
                    googleId,
                    role: UserRole.GUEST,
                    createdAt: Date.now(),
                    lastLoggedIn: Date.now(),
                });
            } else {
                await dbHelper.updateOne('user', { _id: user._id, }, { lastLoggedIn: Date.now(), });
            }

            const jti = uuidv4();
            const userId = user._id.toString();
            const safeUser = { _id: userId, email: user.email || '', role: user.role, jti, };

            const accessToken = jwtHelper.generateAccessToken(safeUser);
            const refreshToken = jwtHelper.generateRefreshToken(safeUser);

            await redisClient.set(`rt:${userId}:${jti}`, refreshToken, { EX: 7 * 24 * 60 * 60, });

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = 'User logged in with Google successfully';
            responseData.userId = userId;
            responseData.role = user.role;
            responseData.accessToken = accessToken;
            responseData.refreshToken = refreshToken;
            responseData.jti = jti;
            return responseData;

        } catch (error) {
            console.error('Error logging in with Google:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error on logging in with Google';
            return responseData;
        }
    },

    /**
     * Logs in or registers a user via Facebook OAuth.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {Object} data - The data object containing the Facebook token.
     * @returns {Object} Response data with status, error, message, and userId on success.
     */
    facebookLogin: async (dbHelper, data) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error on logging in with Facebook',
        };

        try {
            const userToken = data?.token;
            if (!userToken) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Missing Facebook token';
                return responseData;
            }

            const appId = process.env.FACEBOOK_APP_ID;
            const appSecret = process.env.FACEBOOK_APP_SECRET;
            const appAccessToken = `${appId}|${appSecret}`;

            const debugRes = await fetch(
                `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(userToken)}&access_token=${encodeURIComponent(appAccessToken)}`
            );
            const debug = await debugRes.json();
            const isValid = debug?.data?.is_valid && debug?.data?.app_id === appId;
            if (!isValid) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'Invalid Facebook token';
                return responseData;
            }

            const meRes = await fetch(
                `https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(userToken)}`
            );
            const me = await meRes.json();
            if (!me?.id) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid Facebook user data';
                return responseData;
            }

            const facebookId = me.id;
            const name = me.name || '';
            const email = (me.email || '').trim().toLowerCase();

            let user = await dbHelper.findOne('user', { facebookId, });
            if (!user) {
                if (email) {
                    const emailOwner = await dbHelper.findOne('user', { email, });
                    if (emailOwner) {
                        responseData.status = Status.BAD_REQUEST;
                        responseData.error = 'Email already exists';
                        return responseData;
                    }
                }

                const baseDoc = {
                    facebookId,
                    email: email || null,
                    name,
                    role: UserRole.GUEST,
                    createdAt: Date.now(),
                    lastLoggedIn: Date.now(),
                };

                user = await dbHelper.create('user', baseDoc);
            } else {
                await dbHelper.updateOne('user', { _id: user._id, }, { lastLoggedIn: Date.now(), });
            }

            const jti = uuidv4();
            const userId = user._id.toString();
            const safeUser = { _id: userId, email: user.email || '', role: user.role, jti, };

            const accessToken = jwtHelper.generateAccessToken(safeUser);
            const refreshToken = jwtHelper.generateRefreshToken(safeUser);

            const REFRESH_TTL = 7 * 24 * 60 * 60;
            await redisClient.set(`rt:${userId}:${jti}`, refreshToken, { EX: REFRESH_TTL, });

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = 'User logged in with Facebook successfully';
            responseData.userId = userId;
            responseData.role = user.role;
            responseData.accessToken = accessToken;
            responseData.refreshToken = refreshToken;
            responseData.jti = jti;
            return responseData;

        } catch (error) {
            console.error('Error logging in with Facebook:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error on logging in with Facebook';
            return responseData;
        }
    },

    /**
     * Logs out a user and revokes their refresh token.
     * @param {string} userId - The ID of the user to log out.
     * @returns {Object} Response data with status, error, message.
     */
    logout: async (userId, jti) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error on logging out user',
        };
        try {
            await redisClient.del(`rt:${userId}:${jti}`);
            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = 'User logged out successfully';
        } catch (error) {
            console.error('Error logging out user:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error on logging out user';
        }
        return responseData;
    },

    /**
     * Resets a user's password.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {string} email - The email address of the user to reset the password for.
     * @param {string} newGeneratedPassword - The new password to set for the user.
     * @returns {Object} Response data with status, error, and message.
     */
    resetPassword: async (dbHelper, data) => {
        let { email, newPassword, resetToken, } = data;
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error on resetting password',
        };
        try {
            if (!isPresent(email) || typeof newPassword !== 'string' || !isPresent(resetToken)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Missing required fields';
                return responseData;
            }

            if (!isValidEmail(email.toLowerCase())) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid email address';
                return responseData;
            }

            if (!isValidPassword(newPassword)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid password';
                return responseData;
            }

            const user = await dbHelper.findOne('user', { email, });
            if (!user) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'User not found';
                return responseData;
            }

            if (!user.resetTokenHash || Date.now() > user.resetTokenExpiry) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Reset token has expired';
                return responseData;
            }

            if (user.resetTokenHash !== hashString(resetToken)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid reset token';
                return responseData;
            }

            const hashedPassword = await hashPassword(newPassword);
            await dbHelper.updateOne('user', { email, }, {
                password: hashedPassword,
                resetTokenHash: null,
                resetTokenExpiry: null,
                updatedAt: Date.now(),
            });

            await revokeAllRefreshTokens(user._id.toString());

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = 'Password reset successfully';

        } catch (error) {
            console.error('Error on resetting password:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error on resetting password';
        }
        return responseData;
    },

    /**
     * Sends a password reset link to the user's email if it exists in the system.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {Object} data - The data object containing the email field.
     * @returns {Object} Response data with status, error, and message. If the user exists, a reset token is also included.
     */
    sendPasswordResetVerificationCode: async (dbHelper, emailModule, data) => {
        let { email, } = data;
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error on sending password reset verification code',
        };
        try {
            if (!isPresent(email)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Missing required fields';
                return responseData;
            }

            if (!isValidEmail(email.toLowerCase())) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid email address';
                return responseData;
            }

            const user = await dbHelper.findOne('user', { email, });

            const code = generate6DigitCode();
            const verificationCodeHash = hashString(code);
            const verificationCodeExpiry = Date.now() + 10 * 60 * 1000;

            if (user) {
                await dbHelper.updateOne('user', { email, }, { verificationCodeHash, verificationCodeExpiry, });
                const emailResponse = await emailModule.sendVerificationCode(email, code);
                if (emailResponse.status !== Status.OK)
                    return emailResponse;
            }

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = 'If your email is in our system, a verification code has been sent.';
        } catch (error) {
            console.error('Error on sending password reset verification code:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error on sending password reset verification code';
        }
        return responseData;
    },

    /**
     * Verifies a password reset code for a user.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {Object} data - The data object containing the email and verification code fields.
     * @returns {Object} Response data with status, error, message, and reset token on success.
     */
    verifyPasswordResetCode: async (dbHelper, data) => {
        let { email, verificationCode, } = data;
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error on verifying password reset code',
        };
        try {
            if (!isPresent(email) || !isPresent(verificationCode)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Missing required fields';
                return responseData;
            }

            if (!isValidEmail(email.toLowerCase())) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid email address';
                return responseData;
            }

            const user = await dbHelper.findOne('user', { email, });
            if (!user) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'User not found';
                return responseData;
            }

            if (!user.verificationCodeHash || Date.now() > user.verificationCodeExpiry) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Verification code has expired';
                return responseData;
            }

            if (user.verificationCodeHash !== hashString(verificationCode)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid verification code';
                return responseData;
            }

            const resetToken = crypto.randomBytes(32).toString('hex');
            const resetTokenHash = hashString(resetToken);
            const resetTokenExpiry = Date.now() + 15 * 60 * 1000;

            await dbHelper.updateOne('user', { email, }, {
                resetTokenHash,
                resetTokenExpiry,
                verificationCodeHash: null,
                verificationCodeExpiry: null,
            });

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = 'Verification code verified successfully';
            responseData.resetToken = resetToken;
        } catch (error) {
            console.error('Error on verifying password reset code:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error on verifying password reset code';
        }
        return responseData;
    },

    /**
     * Refreshes access and refresh tokens for a user
     * @param {string} refreshToken - The current refresh token
     * @returns {Object} Response data with new tokens or error
     */
    refreshToken: async (dbHelper, refreshToken) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error on refreshing token',
        };

        try {
            if (!refreshToken?.trim()) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'No refresh token provided';
                return responseData;
            }

            const payload = jwtHelper.verifyRefreshToken(refreshToken.trim());
            if (!payload?.userId || !payload?.jti) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'Invalid or expired refresh token';
                return responseData;
            }

            const userId = payload.userId;
            const oldJti = payload.jti;
            const oldKey = `rt:${userId}:${oldJti}`;

            const stored = await redisClient.get(oldKey);
            if (!stored) {
                await revokeAllRefreshTokens(userId);
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'Refresh token reuse detected. All sessions revoked.';
                return responseData;
            }

            if (stored !== refreshToken.trim()) {
                await revokeAllRefreshTokens(userId);
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'Refresh token mismatch. All sessions revoked.';
                return responseData;
            }

            const user = await dbHelper.findOne('user', { _id: userId, });
            if (!user) {
                await revokeAllRefreshTokens(userId);
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'User not found';
                return responseData;
            }

            const newJti = uuidv4();
            const safeUser = {
                _id: userId,
                email: user.email || '',
                role: user.role,
                jti: newJti,
            };

            const newAccessToken = jwtHelper.generateAccessToken(safeUser);
            const newRefreshToken = jwtHelper.generateRefreshToken(safeUser);

            const newKey = `rt:${userId}:${newJti}`;
            const REFRESH_TTL = 7 * 24 * 60 * 60;

            const multi = redisClient.multi();
            multi.del(oldKey);
            multi.set(newKey, newRefreshToken, { EX: REFRESH_TTL, });
            await multi.exec();

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = 'Tokens refreshed successfully';
            responseData.accessToken = newAccessToken;
            responseData.refreshToken = newRefreshToken;
            responseData.jti = newJti;
            responseData.userId = userId;
            responseData.role = user.role;

        } catch (error) {
            console.error('Error refreshing token:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error on refreshing token';
        }

        return responseData;
    },
};

export default userModule;

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function isValidName(name) {
    if (typeof name !== 'string') return false;
    const nameRegex = /^[\p{L}]+([ '.-][\p{L}]+)*$/u;
    return nameRegex.test(name.trim()) && name.trim().length > 0;
}

function isValidPassword(pwd) {
    if (typeof pwd !== 'string') return false;
    const len = Buffer.byteLength(pwd, 'utf8');
    return len >= 8 && len <= 128;
}

function isValidRole(role) {
    return Object.values(UserRole).includes(role);
}

function isPresent(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

async function hashPassword(password) {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    return hashedPassword;
}

async function revokeAllRefreshTokensScan(userId) {
    const pattern = `rt:${userId}:*`;
    let cursor = '0';
    do {
        const { cursor: nextCursor, keys, } = await redisClient.scan(cursor, {
            MATCH: pattern,
            COUNT: 200,
        });
        cursor = nextCursor;
        if (keys && keys.length) {
            await redisClient.del(...keys);
        }
    } while (cursor !== '0');
}

async function revokeAllRefreshTokens(userId) {
    const pattern = `rt:${userId}:*`;
    if (typeof redisClient.scanIterator === 'function') {
        for await (const key of redisClient.scanIterator({ MATCH: pattern, COUNT: 200, })) {
            await redisClient.del(key);
        }
        return;
    }
    await revokeAllRefreshTokensScan(userId);
}

function hashString(s) {
    return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

function generate6DigitCode() {
    return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

