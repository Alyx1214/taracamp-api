import bcrypt from 'bcryptjs';
import { Status, UserRole, } from '../constants.js';
import { OAuth2Client, } from 'google-auth-library';
import fetch from 'node-fetch';
import jwtHelper from './jwtHelper.js';
import redisClient from './redisClient.js';
import { safeRedisOperations, redisCircuitBreaker } from './redisCircuitBreaker.js';
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
            const { email, firstName, lastName, password } = data;
            
            const validationErrors = [];
            if (!isPresent(email)) validationErrors.push('Email is required');
            if (!isPresent(firstName)) validationErrors.push('First name is required');
            if (!isPresent(lastName)) validationErrors.push('Last name is required');
            if (!isPresent(password)) validationErrors.push('Password is required');

            if (validationErrors.length > 0) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = validationErrors.join(', ');
                return responseData;
            }

            const normalizedEmail = email.toLowerCase().trim();
            
            if (!isValidEmail(normalizedEmail)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid email address';
                return responseData;
            }

            if (!isValidPassword(password)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Password must be 8-128 characters long';
                return responseData;
            }

            if (!isValidName(firstName) || !isValidName(lastName)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid name format';
                return responseData;
            }

            const name = `${firstName.trim()} ${lastName.trim()}`.replace(/\s+/g, ' ');
            const hashedPassword = await hashPassword(password);

            let userCreated;
            await dbHelper.withTransaction(async (session) => {
                const emailExists = await dbHelper.findOneWithTransaction('user', 
                    { email: normalizedEmail }, 
                    { projection: { _id: 1, email: 1 } },
                    session
                );
                
                if (emailExists) {
                    throw new Error('EMAIL_EXISTS');
                }

                const userData = {
                    email: normalizedEmail,
                    name,
                    password: hashedPassword,
                    role: UserRole.GUEST,
                    createdAt: new Date(),
                    lastLoggedIn: null,
                };

                const result = await dbHelper.createWithTransaction('user', userData, session);
                userCreated = result;
                
                if (!userCreated || !userCreated._id) {
                    throw new Error('Failed to create user - no ID returned');
                }
            });

            responseData.status = Status.CREATED;
            responseData.error = null;
            responseData.message = 'User registered successfully';
            responseData.userId = userCreated._id.toString();
            responseData.role = userCreated.role;

        } catch (error) {
            console.error('Error registering user:', error);

            if (error?.message === 'EMAIL_EXISTS') {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Email already exists';
            } else if (error?.code === 11000 || error?.code === 'ER_DUP_ENTRY') {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Email already exists';
            } else if (error?.name === 'ValidationError') {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid data provided: ' + (error.message || 'Validation failed');
            } else if (error?.name === 'CastError') {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid data format provided';
            } else if (error?.name === 'MongoError' || error?.name === 'MongoServerError') {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Database constraint violation';
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

            const normalizedEmail = email.toLowerCase().trim();
            
            if (!isValidEmail(normalizedEmail)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid email address';
                return responseData;
            }

            const userObject = await dbHelper.findOne('user', { email: normalizedEmail }, { 
                projection: { password: 1, email: 1, role: 1, _id: 1, name: 1 } 
            });
            
            if (!userObject || !userObject.password) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'Invalid credentials';
                return responseData;
            }

            const match = await bcrypt.compare(password, userObject.password);
            if (!match) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'Invalid credentials';
                return responseData;
            }

            const jti = uuidv4();
            const userId = userObject._id.toString();
            
            // Revoke all previous sessions for high-privilege roles to prevent concurrent logins
            // This prevents security issues if credentials are compromised
            // const highPrivilegeRoles = [UserRole.SUPERINTENDENT, UserRole.CRMSTEAM, UserRole.ACCOUNTING];
            // if (highPrivilegeRoles.includes(userObject.role)) {
            //     await revokeAllRefreshTokens(userId);
            // }
            
            const safeUser = {
                _id: userId,
                email: userObject.email,
                role: userObject.role,
                jti,
            };

            const [accessToken, refreshToken] = await Promise.all([
                Promise.resolve(jwtHelper.generateAccessToken(safeUser)),
                Promise.resolve(jwtHelper.generateRefreshToken(safeUser))
            ]);

            const REFRESH_TTL = 7 * 24 * 60 * 60;
            
            await dbHelper.withTransaction(async (session) => {
                await dbHelper.updateOneWithTransaction('user', 
                    { _id: userObject._id }, 
                    { lastLoggedIn: Date.now() },
                    session
                );
            });
            
            // Handle Redis operation outside transaction with circuit breaker protection
            const redisResult = await safeRedisOperations.set(`rt:${userId}:${jti}`, refreshToken, { EX: REFRESH_TTL });
            if (redisResult === null) {
                console.warn('Redis operation failed after successful login - refresh token not stored');
                // Log for monitoring but don't fail the login since DB operation succeeded
            }

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = 'User logged in successfully';
            responseData.accessToken = accessToken;
            responseData.refreshToken = refreshToken;
            responseData.jti = jti;
            responseData.userId = userId;
            responseData.role = userObject.role;
            responseData.name = userObject.name || null;

        } catch (error) {
            console.error('Error logging in user:', error);
            
            if (error?.name === 'ValidationError') {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid data provided: ' + (error.message || 'Validation failed');
            } else if (error?.name === 'CastError') {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid data format provided';
            } else if (error?.name === 'MongoError' || error?.name === 'MongoServerError') {
                responseData.status = Status.INTERNAL_SERVER_ERROR;
                responseData.error = 'Database error during login';
            } else {
                responseData.status = Status.INTERNAL_SERVER_ERROR;
                responseData.error = 'Error on logging in user';
            }
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
            let isNewUser = false;
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

            let user;
            await dbHelper.withTransaction(async (session) => {
                user = await dbHelper.findOneWithTransaction('user', { googleId }, {}, session);
                
                if (!user) {
                    if (email) {
                        const emailOwner = await dbHelper.findOneWithTransaction('user', { email }, {}, session);
                        if (emailOwner) {
                            throw new Error('EMAIL_EXISTS');
                        }
                    }

                    const result = await dbHelper.createWithTransaction('user', {
                        email: email || null,
                        name,
                        googleId,
                        role: UserRole.GUEST,
                        createdAt: Date.now(),
                        lastLoggedIn: Date.now(),
                    }, session);
                    user = result[0];
                    isNewUser = true;
                } else {
                    await dbHelper.updateOneWithTransaction('user', 
                        { _id: user._id }, 
                        { lastLoggedIn: Date.now() },
                        session
                    );
                }
            });

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
            responseData.isNewUser = isNewUser;
            return responseData;

        } catch (error) {
            console.error('Error logging in with Google:', error);
            
            if (error?.message === 'EMAIL_EXISTS') {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Email already exists';
            } else if (error?.name === 'ValidationError') {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid data provided: ' + (error.message || 'Validation failed');
            } else if (error?.name === 'CastError') {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid data format provided';
            } else if (error?.name === 'MongoError' || error?.name === 'MongoServerError') {
                responseData.status = Status.INTERNAL_SERVER_ERROR;
                responseData.error = 'Database error during Google login';
            } else {
                responseData.status = Status.INTERNAL_SERVER_ERROR;
                responseData.error = 'Error on logging in with Google';
            }
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
            let isNewUser = false;
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

            let user;
            await dbHelper.withTransaction(async (session) => {
                user = await dbHelper.findOneWithTransaction('user', { facebookId }, {}, session);
                
                if (!user) {
                    if (email) {
                        const emailOwner = await dbHelper.findOneWithTransaction('user', { email }, {}, session);
                        if (emailOwner) {
                            throw new Error('EMAIL_EXISTS');
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

                    const result = await dbHelper.createWithTransaction('user', baseDoc, session);
                    user = result[0];
                    isNewUser = true;
                } else {
                    await dbHelper.updateOneWithTransaction('user', 
                        { _id: user._id }, 
                        { lastLoggedIn: Date.now() },
                        session
                    );
                }
            });

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
            responseData.isNewUser = isNewUser;
            return responseData;

        } catch (error) {
            console.error('Error logging in with Facebook:', error);
            
            if (error?.message === 'EMAIL_EXISTS') {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Email already exists';
            } else if (error?.name === 'ValidationError') {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid data provided: ' + (error.message || 'Validation failed');
            } else if (error?.name === 'CastError') {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid data format provided';
            } else if (error?.name === 'MongoError' || error?.name === 'MongoServerError') {
                responseData.status = Status.INTERNAL_SERVER_ERROR;
                responseData.error = 'Database error during Facebook login';
            } else {
                responseData.status = Status.INTERNAL_SERVER_ERROR;
                responseData.error = 'Error on logging in with Facebook';
            }
            return responseData;
        }
    },

    /**
     * Adds a new user
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {Object} data - The data object containing the user details.
     * @param {Object} user - The user object containing the user ID and role.
     * @returns {Object} Response data with status, error, and a message on success.
     */
    addUser: async (dbHelper, data, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error adding user',
        };

        try {
            if (!user || user.role !== UserRole.SUPERINTENDENT) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'Only superintendent can add a user';
                return responseData;
            }

            const { name, email, role, password } = data;
            
            const validationErrors = [];
            if (!isPresent(name)) validationErrors.push('Name is required');
            if (!isPresent(email)) validationErrors.push('Email is required');
            if (!isPresent(role)) validationErrors.push('Role is required');
            if (!isPresent(password)) validationErrors.push('Password is required');

            if (validationErrors.length > 0) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = validationErrors.join(', ');
                return responseData;
            }

            const normalizedEmail = email.toLowerCase().trim();
            
            if (!isValidName(name)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid name format. Name must contain only letters, spaces, hyphens, periods, and apostrophes';
                return responseData;
            }

            if (!isValidEmail(normalizedEmail)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid email address format';
                return responseData;
            }

            if (!isValidRole(role)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = `Invalid role. Must be one of: ${Object.values(UserRole).join(', ')}`;
                return responseData;
            }

            if (!isValidPassword(password)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Password must be 8-128 characters long';
                return responseData;
            }

            let createdUser;
            let emailExists = false;
            
            await dbHelper.withTransaction(async (session) => {
                const existingUser = await dbHelper.findOneWithTransaction('user', 
                    { email: normalizedEmail }, 
                    { projection: { _id: 1, email: 1 } },
                    session
                );
                
                if (existingUser) {
                    emailExists = true;
                    return;
                }

                const sanitizedName = name.trim().replace(/\s+/g, ' ');
                const userData = {
                    name: sanitizedName,
                    email: normalizedEmail,
                    role,
                    password: null,
                    createdAt: new Date(),
                    lastLoggedIn: null,
                };

                const saltRounds = 12;
                const hashedPassword = await bcrypt.hash(password, saltRounds);
                userData.password = hashedPassword;

                const result = await dbHelper.createWithTransaction('user', userData, session);
                createdUser = result;
                
                if (!createdUser || !createdUser._id) {
                    throw new Error('Failed to create user - no ID returned');
                }
            });

            if (emailExists) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Email already exists';
                return responseData;
            }

            await invalidateUserSearchCache();

            responseData.status = Status.CREATED;
            responseData.error = null;
            responseData.message = 'User added successfully';
            responseData.userId = createdUser._id.toString();
            responseData.user = {
                id: createdUser._id.toString(),
                name: createdUser.name,
                email: createdUser.email,
                role: createdUser.role,
                createdAt: createdUser.createdAt
            };

        } catch (error) {
            console.error('Error adding user:', error);

            if (error?.code === 11000 || error?.code === 'ER_DUP_ENTRY') {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Email already exists';
            } else if (error?.name === 'ValidationError') {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid data provided: ' + (error.message || 'Validation failed');
            } else if (error?.name === 'CastError') {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid data format provided';
            } else if (error?.name === 'MongoError' || error?.name === 'MongoServerError') {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Database constraint violation';
            } else {
                responseData.status = Status.INTERNAL_SERVER_ERROR;
                responseData.error = 'Error adding user';
            }
        }

        return responseData;
    },

    /**
     * Updates an existing user.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {string} userId - The ID of the user to update.
     * @param {Object} data - The data object containing the user details to update.
     * @param {Object} user - The user object containing the user ID and role.
     * @returns {Object} Response data with status, error, and a message on success.
     */
    updateUser: async (dbHelper, userId, data, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error updating user',
        };

        try {
            if (!user || user.role !== UserRole.SUPERINTENDENT) {
                responseData.status = Status.FORBIDDEN;
                responseData.error = 'Only superintendent can update a user';
                return responseData;
            }

            if (!userId) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Missing user ID';
                return responseData;
            }

            const { name, email, role, password } = data;
            
            const updateData = {};
            const validationErrors = [];

            if (name !== undefined) {
                if (!isPresent(name)) {
                    validationErrors.push('Name cannot be empty');
                } else if (!isValidName(name)) {
                    validationErrors.push('Invalid name format. Name must contain only letters, spaces, hyphens, periods, and apostrophes');
                } else {
                    updateData.name = name.trim().replace(/\s+/g, ' ');
                }
            }

            if (email !== undefined) {
                const normalizedEmail = email.toLowerCase().trim();
                if (!isPresent(email)) {
                    validationErrors.push('Email cannot be empty');
                } else if (!isValidEmail(normalizedEmail)) {
                    validationErrors.push('Invalid email address format');
                } else {
                    updateData.email = normalizedEmail;
                }
            }

            if (role !== undefined) {
                if (!isPresent(role)) {
                    validationErrors.push('Role cannot be empty');
                } else if (!isValidRole(role)) {
                    validationErrors.push(`Invalid role. Must be one of: ${Object.values(UserRole).join(', ')}`);
                } else {
                    updateData.role = role;
                }
            }

            if (password !== undefined && password !== null && password !== '') {
                if (!isValidPassword(password)) {
                    validationErrors.push('Password must be 8-128 characters long');
                } else {
                    const saltRounds = 12;
                    updateData.password = await bcrypt.hash(password, saltRounds);
                }
            }

            if (validationErrors.length > 0) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = validationErrors.join(', ');
                return responseData;
            }

            if (Object.keys(updateData).length === 0) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'No valid fields to update';
                return responseData;
            }

            const targetUser = await dbHelper.findOne('user', { _id: userId }, { projection: { _id: 1, email: 1, role: 1 } });
            if (!targetUser) {
                responseData.status = Status.NOT_FOUND;
                responseData.error = 'User not found';
                return responseData;
            }

            // Check if email is being changed and if the new email already exists
            if (updateData.email && updateData.email !== targetUser.email) {
                const emailExists = await dbHelper.findOne('user', 
                    { email: updateData.email, _id: { $ne: userId } }, 
                    { projection: { _id: 1 } }
                );
                
                if (emailExists) {
                    responseData.status = Status.BAD_REQUEST;
                    responseData.error = 'Email already exists';
                    return responseData;
                }
            }

            updateData.updatedAt = new Date();

            await dbHelper.updateOne('user', { _id: userId }, updateData);
            
            await invalidateUserSearchCache();

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = 'User updated successfully';

        } catch (error) {
            console.error('Error updating user:', error);

            if (error?.code === 11000 || error?.code === 'ER_DUP_ENTRY') {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Email already exists';
            } else if (error?.name === 'ValidationError') {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid data provided: ' + (error.message || 'Validation failed');
            } else if (error?.name === 'CastError') {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid data format provided';
            } else if (error?.name === 'MongoError' || error?.name === 'MongoServerError') {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Database constraint violation';
            } else {
                responseData.status = Status.INTERNAL_SERVER_ERROR;
                responseData.error = 'Error updating user';
            }
        }

        return responseData;
    },

    /**
     * Get all users by role.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {string} role - The role of the users to retrieve.
     * @param {Object} user - The user object.
     * @param {Object} options - Optional parameters for pagination and sorting.
     * @returns {Object} Response data with status, error, and an array of users on success.
     */
    getAllUsersByRole: async (dbHelper, role, user, options = {}) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error fetching users by role',
            users: [],
            totalCount: 0,
        };
        try {
            if (user.role !== UserRole.SUPERINTENDENT) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'You are not authorized to perform this action';
                return responseData;
            }

            if (!role) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Missing role';
                return responseData;
            }

            if (!isValidRole(role)) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Invalid role';
                return responseData;
            }

            const {
                limit = 20,
                skip = 0,
                sort = 'createdAt:desc'
            } = options;

            const limitValue = clampLimit(limit, 20);
            const skipValue = clampSkip(skip, 0);
            const sortOpt = parseSort(sort) || { createdAt: -1 };

            const cacheKey = `get_users_by_role:${role}:${limitValue}:${skipValue}:${JSON.stringify(sortOpt)}`;
            try {
                const cachedResult = await redisClient.get(cacheKey);
                if (cachedResult) {
                    const parsed = JSON.parse(cachedResult);
                    responseData.status = Status.OK;
                    responseData.error = null;
                    responseData.users = parsed.users;
                    responseData.totalCount = parsed.totalCount;
                    return responseData;
                }
            } catch (cacheError) {
                console.warn('Cache read error for getAllUsersByRole:', cacheError);
            }

            const projection = { 
                _id: 1,
                email: 1, 
                name: 1, 
                role: 1, 
                createdAt: 1, 
                lastLoggedIn: 1,
                googleId: 1,
                facebookId: 1
            };

            const [users, totalCount] = await Promise.all([
                dbHelper.findMany('user', { role }, {
                    projection,
                    sort: sortOpt,
                    limit: limitValue,
                    skip: skipValue,
                }),
                dbHelper.count('user', { role })
            ]);
            try {
                await redisClient.set(cacheKey, JSON.stringify({
                    users,
                    totalCount
                }), { EX: 60 });
            } catch (cacheError) {
                console.warn('Cache write error for getAllUsersByRole:', cacheError);
            }

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.users = users;
            responseData.totalCount = totalCount;
        } catch (error) {
            console.error('Error fetching users by role:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error fetching users by role';
        }
        return responseData;
    },

    /**
     * Search users based on the provided query object.
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {Object} query - The search and filter object.
     * @param {Object} user - The user object containing the user ID and role.
     * @returns {Object} Response data with status, error, and an array of users on success.
     */
    searchUsers: async (dbHelper, query = {}, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error searching users',
            users: [],
        };

        try {
            if (!user) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'User not logged in';
                return responseData;
            }
            if (user.role !== UserRole.SUPERINTENDENT) {
                responseData.status = Status.UNAUTHORIZED; 
                responseData.error = 'You are not authorized to perform this action';
                return responseData;
            }

            const {
                email,
                name,
                role,
                id,
                search,               
                createdFrom,
                createdTo,
                lastLoggedFrom,
                lastLoggedTo,
                limit,
                skip,
                sort,
            } = query || {};

            const limitValue = clampLimit(limit, 20);
            const skipValue = clampSkip(skip, 0);
            
            const cacheKey = `search_users:${JSON.stringify({
                email: email?.trim(),
                name: name?.trim(),
                role: role?.trim(),
                id: id?.trim(),
                search: search?.trim(),
                createdFrom,
                createdTo,
                lastLoggedFrom,
                lastLoggedTo,
                limit: limitValue,
                skip: skipValue,
                sort
            })}`;

            try {
                const cachedResult = await redisClient.get(cacheKey);
                if (cachedResult) {
                    const parsed = JSON.parse(cachedResult);
                    responseData.status = Status.OK;
                    responseData.error = null;
                    responseData.users = parsed.users;
                    responseData.totalCount = parsed.totalCount;
                    return responseData;
                }
            } catch (cacheError) {
                console.warn('Cache read error:', cacheError);
            }

            const { finalQuery, hasValidFilters } = buildOptimizedUserQuery({
                email,
                name,
                role,
                id,
                search,
                createdFrom,
                createdTo,
                lastLoggedFrom,
                lastLoggedTo
            });

            if (!hasValidFilters) {
                responseData.status = Status.OK;
                responseData.error = null;
                responseData.users = [];
                responseData.totalCount = 0;
                return responseData;
            }

            const projection = { 
                _id: 1,
                email: 1, 
                name: 1, 
                role: 1, 
                createdAt: 1, 
                lastLoggedIn: 1,
                googleId: 1,
                facebookId: 1
            };

            const sortOpt = parseSort(sort) || { createdAt: -1 };

            const [users, totalCount] = await Promise.all([
                dbHelper.findMany('user', finalQuery, {
                    projection,
                    sort: sortOpt,
                    limit: limitValue,
                    skip: skipValue,
                }),
                dbHelper.count('user', finalQuery)
            ]);

            try {
                await redisClient.set(cacheKey, JSON.stringify({
                    users,
                    totalCount
                }), { EX: 60 });
            } catch (cacheError) {
                console.warn('Cache write error:', cacheError);
            }

            responseData.status = Status.OK;
            responseData.error = null;
            responseData.users = users;
            responseData.totalCount = totalCount;
            return responseData;
        } catch (error) {
            console.error('Error searching users:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error searching users';
            return responseData;
        }
    },

    /**
     * Delete a user
     * @param {Object} dbHelper - The database helper for database operations.
     * @param {string} userId - The ID of the user to delete.
     * @param {Object} user - The user object containing the user ID and role.
     * @returns {Object} Response data with status, error, and an array of users on success.
     */
    deleteUser: async (dbHelper, userId, user) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error deleting user',
        };
        try {
            if (!user) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'User not logged in';
                return responseData;
            }
            if (user.role !== UserRole.SUPERINTENDENT) {
                responseData.status = Status.UNAUTHORIZED;
                responseData.error = 'You are not authorized to perform this action';
                return responseData;
            }

            if (!userId) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'Missing user ID';
                return responseData;
            }

            const targetUser = await dbHelper.findOne('user', { _id: userId }, { projection: { _id: 1, role: 1, email: 1, name: 1 } });
            if (!targetUser) {
                responseData.status = Status.NOT_FOUND;
                responseData.error = 'User not found';
                return responseData;
            }

            if (targetUser._id.toString() === user.userId.toString()) {
                responseData.status = Status.BAD_REQUEST;
                responseData.error = 'You cannot delete your own account';
                return responseData;
            }

            if (targetUser.role === UserRole.SUPERINTENDENT) {
                const superintendentCount = await dbHelper.count('user', { role: UserRole.SUPERINTENDENT });
                if (superintendentCount <= 1) {
                    responseData.status = Status.BAD_REQUEST;
                    responseData.error = 'Cannot delete the last superintendent account. At least one superintendent must remain.';
                    return responseData;
                }

            }

            await dbHelper.deleteOne('user', { _id: userId, });
            
            await invalidateUserSearchCache();
            
            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = 'User deleted successfully';
        } catch (error) {
            console.error('Error deleting user:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error deleting user';
        }
        return responseData;
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
            const result = await safeRedisOperations.del(`rt:${userId}:${jti}`);
            if (result === null) {
                console.warn('Redis operation failed during logout - token may not be revoked');
            }
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
            
            await dbHelper.withTransaction(async (session) => {
                await dbHelper.updateOneWithTransaction('user', { email }, {
                    password: hashedPassword,
                    resetTokenHash: null,
                    resetTokenExpiry: null,
                    updatedAt: Date.now(),
                }, session);
            });

            // Handle Redis operation outside transaction with circuit breaker protection
            const revokeResult = await revokeAllRefreshTokens(user._id.toString());
            if (revokeResult === false) {
                console.warn('Failed to revoke refresh tokens after password reset - Redis may be down');
                // Log for monitoring - password is changed but old tokens remain valid
            }

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

            // Add locking mechanism to prevent race conditions
            const lockKey = `lock:rt:${userId}:${oldJti}`;
            const lockValue = uuidv4();
            const lockTTL = 30; // seconds

            // Try to acquire lock with circuit breaker protection
            const lockAcquired = await safeRedisOperations.set(lockKey, lockValue, { 
                EX: lockTTL, 
                NX: true 
            });

            if (!lockAcquired) {
                responseData.status = Status.TOO_MANY_REQUESTS;
                responseData.error = 'Token refresh in progress, please try again';
                return responseData;
            }

            try {
                // Check if Redis is available before treating null as "token not found"
                const cbState = redisCircuitBreaker.getState();
                const redisAvailable = cbState.state === 'CLOSED' || cbState.state === 'HALF_OPEN';
                
                const stored = await safeRedisOperations.get(oldKey);
                
                // Only enforce token reuse detection if Redis is available
                // If Redis is down, we rely on JWT verification only (stateless)
                if (redisAvailable) {
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
                } else {
                    // Redis is down - log warning but allow refresh to proceed
                    // We rely on JWT signature verification which already happened above
                    console.warn(`Redis unavailable during token refresh for user ${userId}. Allowing refresh based on JWT verification only.`);
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

                const multi = safeRedisOperations.multi();
                multi.del(oldKey);
                multi.set(newKey, newRefreshToken, { EX: REFRESH_TTL });
                multi.del(lockKey); // Release lock
                await safeRedisOperations.exec(multi);

                responseData.status = Status.OK;
                responseData.error = null;
                responseData.message = 'Tokens refreshed successfully';
                responseData.accessToken = newAccessToken;
                responseData.refreshToken = newRefreshToken;
                responseData.jti = newJti;
                responseData.userId = userId;
                responseData.role = user.role;

            } catch (error) {
                // Release lock on error
                await safeRedisOperations.del(lockKey);
                throw error;
            }

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

function escapeRegex(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function clampLimit(value, def = 20) {
    if (value == null || value === '') return def;
    const n = Number(value);
    if (!Number.isFinite(n)) return def;
    return Math.max(1, Math.min(100, Math.trunc(n)));
}

function clampSkip(value, def = 0) {
    if (value == null || value === '') return def;
    const n = Number(value);
    if (!Number.isFinite(n)) return def;
    return Math.max(0, Math.trunc(n));
}

function parseSort(s) {
    if (typeof s !== 'string') return null;
    const out = {};
    for (const part of s.split(',').map((t) => t.trim()).filter(Boolean)) {
        const [f, dir,] = part.split(':').map((t) => t.trim());
        if (!f) continue;
        out[f] = String(dir || 'asc').toLowerCase() === 'desc' ? -1 : 1;
    }
    return Object.keys(out).length ? out : null;
}

function isValidRole(role) {
    return Object.values(UserRole).includes(role);
}

function normalizeRole(role) {
    if (!role) return null;
    const r = String(role).trim().toUpperCase();
    if (r === 'CRMSTEAM' || r === 'CRMS TEAM' || r === 'CRMS_TEAM') return UserRole.CRMSTEAM;
    for (const v of Object.values(UserRole)) {
        if (String(v).toUpperCase() === r) return v;
    }
    return null;
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
        const { cursor: nextCursor, keys, } = await safeRedisOperations.scan(cursor, {
            MATCH: pattern,
            COUNT: 200,
        });
        cursor = nextCursor;
        if (keys && keys.length > 0) {
            await safeRedisOperations.del(...keys);
        }
    } while (cursor !== '0');
}

async function revokeAllRefreshTokens(userId) {
    try {
        const pattern = `rt:${userId}:*`;
        if (typeof redisClient.scanIterator === 'function') {
            for await (const key of redisClient.scanIterator({ MATCH: pattern, COUNT: 200, })) {
                await safeRedisOperations.del(key);
            }
            return true;
        }
        await revokeAllRefreshTokensScan(userId);
        return true;
    } catch (error) {
        console.error('Error revoking refresh tokens:', error);
        return false;
    }
}

async function invalidateUserSearchCache() {
    try {
        const pattern = 'search_users:*';
        const keys = await redisClient.keys(pattern);
        if (keys && keys.length > 0) {
            await redisClient.del(...keys);
        }
    } catch (cacheError) {
        console.warn('Failed to invalidate user search cache:', cacheError);
    }
}

function hashString(s) {
    return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

function generate6DigitCode() {
    return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/**
 * Builds an optimized MongoDB query for user search
 * @param {Object} params - Search parameters
 * @returns {Object} Query object and validation flag
 */
function buildOptimizedUserQuery({
    email,
    name,
    role,
    id,
    search,
    createdFrom,
    createdTo,
    lastLoggedFrom,
    lastLoggedTo
}) {
    const filter = {};
    const andConds = [];
    let hasValidFilters = false;

    if (typeof email === 'string' && email.trim()) {
        const emailTrimmed = email.trim();
        if (emailTrimmed.includes('@')) {
            filter.email = { $regex: `^${escapeRegex(emailTrimmed)}$`, $options: 'i' };
        } else {
            filter.email = { $regex: escapeRegex(emailTrimmed), $options: 'i' };
        }
        hasValidFilters = true;
    }

    if (typeof name === 'string' && name.trim()) {
        const nameTrimmed = name.trim();
        if (nameTrimmed.length > 2) {
            filter.name = { $regex: escapeRegex(nameTrimmed), $options: 'i' };
            hasValidFilters = true;
        }
    }

    if (typeof role === 'string' && role.trim()) {
        const normalizedRole = normalizeRole(role);
        if (normalizedRole) {
            filter.role = normalizedRole;
            hasValidFilters = true;
        } else {
            return { finalQuery: { _id: { $exists: false } }, hasValidFilters: false };
        }
    }

    if (typeof id === 'string' && id.trim()) {
        const idStr = id.trim();
        if (/^[0-9a-fA-F]{24}$/.test(idStr)) {
            filter._id = idStr;
            hasValidFilters = true;
        } else if (/^[0-9a-fA-F]{3,}$/.test(idStr)) {
            andConds.push({
                $expr: { $regexMatch: { input: { $toString: '$_id' }, regex: idStr, options: 'i' } }
            });
            hasValidFilters = true;
        } else {
            return { finalQuery: { _id: { $exists: false } }, hasValidFilters: false };
        }
    }

    const createdCond = {};
    const hasCreatedFrom = typeof createdFrom === 'string' && createdFrom.trim();
    const hasCreatedTo = typeof createdTo === 'string' && createdTo.trim();
    
    if (hasCreatedFrom) {
        const d = new Date(createdFrom);
        if (!Number.isNaN(d.getTime())) {
            createdCond.$gte = d;
            hasValidFilters = true;
            
            // If only createdFrom is provided (no createdTo), set upper bound to end of that day
            if (!hasCreatedTo) {
                const endOfDay = new Date(d);
                endOfDay.setHours(23, 59, 59, 999);
                createdCond.$lte = endOfDay;
            }
        }
    }
    if (hasCreatedTo) {
        const d = new Date(createdTo);
        if (!Number.isNaN(d.getTime())) {
            // If we already have $gte from createdFrom, use $lte for inclusive end
            // Otherwise use $lt for exclusive end (original behavior)
            if (createdCond.$gte) {
                const endOfDay = new Date(d);
                endOfDay.setHours(23, 59, 59, 999);
                createdCond.$lte = endOfDay;
            } else {
                createdCond.$lt = d;
            }
            hasValidFilters = true;
        }
    }
    if (Object.keys(createdCond).length) {
        andConds.push({ createdAt: createdCond });
    }

    const lastLoggedCond = {};
    const hasLastLoggedFrom = typeof lastLoggedFrom === 'string' && lastLoggedFrom.trim();
    const hasLastLoggedTo = typeof lastLoggedTo === 'string' && lastLoggedTo.trim();
    
    if (hasLastLoggedFrom) {
        const d = new Date(lastLoggedFrom);
        if (!Number.isNaN(d.getTime())) {
            lastLoggedCond.$gte = d;
            hasValidFilters = true;
            
            // If only lastLoggedFrom is provided (no lastLoggedTo), set upper bound to end of that day
            if (!hasLastLoggedTo) {
                const endOfDay = new Date(d);
                endOfDay.setHours(23, 59, 59, 999);
                lastLoggedCond.$lte = endOfDay;
            }
        }
    }
    if (hasLastLoggedTo) {
        const d = new Date(lastLoggedTo);
        if (!Number.isNaN(d.getTime())) {
            // If we already have $gte from lastLoggedFrom, use $lte for inclusive end
            // Otherwise use $lt for exclusive end (original behavior)
            if (lastLoggedCond.$gte) {
                const endOfDay = new Date(d);
                endOfDay.setHours(23, 59, 59, 999);
                lastLoggedCond.$lte = endOfDay;
            } else {
                lastLoggedCond.$lt = d;
            }
            hasValidFilters = true;
        }
    }
    if (Object.keys(lastLoggedCond).length) {
        andConds.push({ lastLoggedIn: lastLoggedCond });
    }

    // Handle general search term
    if (typeof search === 'string' && search.trim()) {
        const searchTerm = search.trim();
        const safeSearch = escapeRegex(searchTerm);
        
        const searchConditions = [
            { name: { $regex: safeSearch, $options: 'i' } },
            { email: { $regex: safeSearch, $options: 'i' } },
            { role: { $regex: safeSearch, $options: 'i' } }
        ];

        if (/^[0-9a-fA-F]{24}$/.test(searchTerm)) {
            searchConditions.push({ _id: searchTerm });
        } else if (/^[0-9a-fA-F]{3,}$/.test(searchTerm)) {
            searchConditions.push({
                $expr: {
                    $regexMatch: {
                        input: { $toString: '$_id' },
                        regex: searchTerm,
                        options: 'i'
                    }
                }
            });
        }

        andConds.push({ $or: searchConditions });
        hasValidFilters = true;
    }

    let finalQuery = {};
    if (Object.keys(filter).length > 0 && andConds.length > 0) {
        finalQuery = { $and: [filter, ...andConds] };
    } else if (Object.keys(filter).length > 0) {
        finalQuery = filter;
    } else if (andConds.length > 0) {
        finalQuery = { $and: andConds };
    }

    return { finalQuery, hasValidFilters };
}
