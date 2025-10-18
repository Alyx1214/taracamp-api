import { v4 as uuidv4 } from 'uuid';

/**
 * Request ID tracking middleware for monitoring and debugging
 */
export function requestIdMiddleware(req, res, next) {
    // Generate or use existing request ID
    const requestId = req.headers['x-request-id'] || uuidv4();
    
    // Add request ID to request object
    req.requestId = requestId;
    
    // Add request ID to response headers
    res.setHeader('X-Request-ID', requestId);
    
    // Add request ID to all console logs in this request
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    
    console.log = (...args) => {
        originalLog(`[${requestId}]`, ...args);
    };
    
    console.error = (...args) => {
        originalError(`[${requestId}]`, ...args);
    };
    
    console.warn = (...args) => {
        originalWarn(`[${requestId}]`, ...args);
    };
    
    // Restore original console methods after response
    res.on('finish', () => {
        console.log = originalLog;
        console.error = originalError;
        console.warn = originalWarn;
    });
    
    next();
}

/**
 * Enhanced logging utility with request ID support
 */
export const logger = {
    info: (requestId, message, ...args) => {
        console.log(`[${requestId}] INFO:`, message, ...args);
    },
    
    error: (requestId, message, ...args) => {
        console.error(`[${requestId}] ERROR:`, message, ...args);
    },
    
    warn: (requestId, message, ...args) => {
        console.warn(`[${requestId}] WARN:`, message, ...args);
    },
    
    debug: (requestId, message, ...args) => {
        if (process.env.NODE_ENV === 'development') {
            console.log(`[${requestId}] DEBUG:`, message, ...args);
        }
    }
};

export default requestIdMiddleware;
