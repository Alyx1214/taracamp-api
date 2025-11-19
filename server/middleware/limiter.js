import rateLimit from 'express-rate-limit';

// Custom key generator that properly extracts IP and strips port numbers
const getIpAddress = (req) => {
  // Get IP from request (Express handles X-Forwarded-For when trust proxy is set)
  let ip = req.ip || req.socket.remoteAddress || 'unknown';
  
  // Handle IPv6 mapped IPv4 addresses (::ffff:192.168.1.1)
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  
  // Remove port number if present
  // For IPv4: 192.168.1.1:8080 -> 192.168.1.1
  // For IPv6 with brackets: [2001:db8::1]:8080 -> 2001:db8::1
  if (ip.startsWith('[') && ip.includes(']')) {
    // IPv6 with port: [2001:db8::1]:8080
    ip = ip.substring(1, ip.indexOf(']'));
  } else if (ip.includes(':')) {
    // Check if it's IPv4 with port (contains dots before the colon)
    const colonIndex = ip.lastIndexOf(':');
    const beforeColon = ip.substring(0, colonIndex);
    // If the part before the colon contains dots, it's likely IPv4 with port
    if (beforeColon.includes('.')) {
      ip = beforeColon;
    }
    // Otherwise, it might be IPv6 without brackets, keep as is
  }
  
  return ip;
};

export const basicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300, // Increased from 150 to 300 to accommodate admin operations
  message: { error: 'Too many requests, try again in a minute.' },
  keyGenerator: (req) => getIpAddress(req)
});

export const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many registration attempts. Please try again in 15 minutes.' },
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getIpAddress(req)
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getIpAddress(req)
});