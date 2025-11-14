import { createClient } from 'redis';

const redisClient = createClient({
    url: process.env.REDIS_URL,
    socket: {
        connectTimeout: 10000, // 10 seconds timeout
        reconnectStrategy: (retries) => {
            if (retries > 10) {
                console.error('Redis: Too many reconnection attempts');
                return new Error('Too many retries');
            }
            return Math.min(retries * 100, 3000); // Exponential backoff, max 3s
        }
    }
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.on('connect', () => console.log('Redis: Connecting...'));
redisClient.on('ready', () => console.log('Redis: Ready'));

export default redisClient;
