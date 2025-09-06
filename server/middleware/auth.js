import jwtHelper from '../modules/jwtHelper.js';

export function authenticateJWT(req, res, next) {
const authHeader = req.headers.authorization || '';
if (!authHeader.startsWith('Bearer ')) {
return res.status(401).json({ error: 'Authorization header missing or malformed' });
}
const token = authHeader.split(' ')[1];
const user = jwtHelper.verifyAccessToken(token);
if (!user) return res.status(401).json({ error: 'Invalid or expired token' });
req.user = user;
next();
}