import redisClient from './redisClient.js';

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
}

// Create a singleton instance
const redisCircuitBreaker = new RedisCircuitBreaker({
    failureThreshold: 3,
    timeout: 5000,
    resetTimeout: 30000
});

/**
 * Safe Redis operations with circuit breaker protection
 */
export const safeRedisOperations = {
    set: async (key, value, options = {}) => {
        return await redisCircuitBreaker.execute(
            () => redisClient.set(key, value, options),
            null // fallback - operation failed but not critical
        );
    },

    get: async (key) => {
        return await redisCircuitBreaker.execute(
            () => redisClient.get(key),
            null // fallback - return null if Redis is down
        );
    },

    del: async (...keys) => {
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
