import rateLimit from 'express-rate-limit';

export const basicLimiter = rateLimit({
windowMs: 60 * 1000,
max: 150,
message: { error: 'Too many requests, try again in a minute.' }
});

export const registrationLimiter = rateLimit({
windowMs: 15 * 60 * 1000,
max: 5,
message: { error: 'Too many registration attempts. Please try again in 15 minutes.' },
skipSuccessfulRequests: true,
standardHeaders: true,
legacyHeaders: false,
});

export const loginLimiter = rateLimit({
windowMs: 15 * 60 * 1000,
max: 10,
message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
skipSuccessfulRequests: true,
standardHeaders: true,
legacyHeaders: false,
});