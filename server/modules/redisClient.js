import { createClient } from 'redis';

const redisClient = createClient({
    url: process.env.REDIS_URL,
    socket: {
        connectTimeout: 10000,
        // Keep retrying forever — returning an Error permanently closes the client
        // and leaves the process stuck with "The client is closed" until restart.
        reconnectStrategy: (retries) => {
            const delay = Math.min(retries * 100, 3000);
            if (retries > 0 && retries % 10 === 0) {
                console.warn(`Redis: Still reconnecting (attempt ${retries})...`);
            }
            return delay;
        }
    }
});

redisClient.on('error', (err) => console.error('Redis Client Error', err.message || err));
redisClient.on('connect', () => console.log('Redis: Connecting...'));
redisClient.on('ready', () => console.log('Redis: Ready'));
redisClient.on('end', () => console.warn('Redis: Connection closed'));
redisClient.on('reconnecting', () => console.log('Redis: Reconnecting...'));

let connectingPromise = null;

/**
 * Ensure the Redis client is connected. Safe to call concurrently.
 * Returns true if the client is open, false otherwise.
 */
export async function ensureRedisConnected() {
    if (redisClient.isOpen) {
        return true;
    }

    if (connectingPromise) {
        return connectingPromise;
    }

    connectingPromise = (async () => {
        try {
            if (!redisClient.isOpen) {
                console.log('Redis: Attempting to reconnect closed client...');
                await redisClient.connect();
            }
            return redisClient.isOpen;
        } catch (err) {
            console.error('Redis: Reconnect failed:', err.message || err);
            return false;
        } finally {
            connectingPromise = null;
        }
    })();

    return connectingPromise;
}

export default redisClient;
