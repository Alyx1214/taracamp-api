import redisClient, { ensureRedisConnected } from './redisClient.js';

/** Returned by safe ops when Redis is unreachable (distinct from Redis null replies). */
export const REDIS_UNAVAILABLE = Symbol('REDIS_UNAVAILABLE');

/**
 * Redis Circuit Breaker implementation to handle Redis failures gracefully
 */
class RedisCircuitBreaker {
    constructor(options = {}) {
        this.failureThreshold = options.failureThreshold || 5;
        this.timeout = options.timeout || 60000; // 1 minute
        this.resetTimeout = options.resetTimeout || 30000; // 30 seconds
        this.failureCount = 0;
        this.lastFailureTime = null;
        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    }

    async execute(operation, fallback = null) {
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime > this.resetTimeout) {
                this.state = 'HALF_OPEN';
            } else {
                console.warn('Redis circuit breaker is OPEN, using fallback');
                return fallback;
            }
        }

        try {
            const connected = await ensureRedisConnected();
            if (!connected) {
                throw new Error('The client is closed');
            }

            const result = await Promise.race([
                operation(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Redis operation timeout')), this.timeout)
                )
            ]);

            if (this.state === 'HALF_OPEN') {
                this.state = 'CLOSED';
                this.failureCount = 0;
            }

            return result;
        } catch (error) {
            this.failureCount++;
            this.lastFailureTime = Date.now();

            if (this.failureCount >= this.failureThreshold) {
                this.state = 'OPEN';
                console.error(`Redis circuit breaker opened after ${this.failureCount} failures:`, error);
            }

            console.warn('Redis operation failed, using fallback:', error.message);
            return fallback;
        }
    }

    getState() {
        return {
            state: this.state,
            failureCount: this.failureCount,
            lastFailureTime: this.lastFailureTime
        };
    }

    reset() {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.lastFailureTime = null;
    }

    isAvailable() {
        return this.state === 'CLOSED' || this.state === 'HALF_OPEN';
    }
}

// Create a singleton instance
const redisCircuitBreaker = new RedisCircuitBreaker({
    failureThreshold: 3,
    timeout: 5000,
    resetTimeout: 30000
});

// Clear breaker state once Redis is healthy again
redisClient.on('ready', () => {
    if (redisCircuitBreaker.getState().state !== 'CLOSED') {
        console.log('Redis: Ready — resetting circuit breaker');
        redisCircuitBreaker.reset();
    }
});

/**
 * Safe Redis operations with circuit breaker protection
 */
export const safeRedisOperations = {
    set: async (key, value, options = {}) => {
        return await redisCircuitBreaker.execute(
            () => redisClient.set(key, value, options),
            REDIS_UNAVAILABLE
        );
    },

    get: async (key) => {
        return await redisCircuitBreaker.execute(
            () => redisClient.get(key),
            null // miss and downtime both yield null; callers use circuit state when needed
        );
    },

    del: async (...keys) => {
        // Redis del command requires at least one key
        if (!keys || keys.length === 0) {
            return 0; // No keys to delete, return success
        }
        return await redisCircuitBreaker.execute(
            () => redisClient.del(...keys),
            0 // fallback - assume deletion succeeded
        );
    },

    multi: () => {
        return redisClient.multi();
    },

    exec: async (multi) => {
        return await redisCircuitBreaker.execute(
            () => multi.exec(),
            [] // fallback - assume operations succeeded
        );
    },

    scan: async (cursor, options = {}) => {
        return await redisCircuitBreaker.execute(
            () => redisClient.scan(cursor, options),
            { cursor: '0', keys: [] } // fallback - return empty scan result
        );
    },

    keys: async (pattern) => {
        return await redisCircuitBreaker.execute(
            () => redisClient.keys(pattern),
            [] // fallback - return empty keys array
        );
    }
};

export default redisCircuitBreaker;

// Export the circuit breaker instance for state checking
export { redisCircuitBreaker };
