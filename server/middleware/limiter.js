import rateLimit from 'express-rate-limit';

export const basicLimiter = rateLimit({
windowMs: 60 * 1000,
max: 40,
message: { error: 'Too many requests, try again in a minute.' }
});