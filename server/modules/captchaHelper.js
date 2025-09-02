import svgCaptcha from 'svg-captcha';
import { Status } from '../constants.js';

const MAX_ATTEMPTS = 5;
const WAIT_TIME = 10 * 60 * 1000; // 10 minutes in milliseconds

const captchaHelper = {
    generateCaptcha: () => {
        // Generate SVG captcha
        const captcha = svgCaptcha.create({
            size: 4,
            noise: 3,
            color: true,
            background: '#ffffff'
        });

        return {
            digits: captcha.text,
            buffer: Buffer.from(captcha.data)
        };
    },
    isBlocked: (session) => {
        const now = Date.now();
        return session.blockUntil && session.blockUntil > now;
    },
    verifyCaptcha: (captcha, session) => {
        let responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error on verifying captcha'
        };

        if (!captcha || !captcha.length) {
            responseData.status = Status.BAD_REQUEST;
            responseData.error = 'Missing captcha';
            return responseData;
        }

        if (captchaHelper.isBlocked(session)) {
            const waitTime = Math.ceil((session.blockUntil - Date.now()) / 1000);
            responseData.status = Status.TOO_MANY_ATTEMPTS;
            responseData.error = `Too many attempts. Please try again after ${waitTime} seconds.`;
            return responseData;
        }

        if (!session.verificationAttempts) session.verificationAttempts = 0;

        if (captcha !== session.captcha) {
            session.verificationAttempts += 1;
            if (session.verificationAttempts >= MAX_ATTEMPTS) {
                session.blockUntil = Date.now() + WAIT_TIME;
                responseData.status = Status.TOO_MANY_ATTEMPTS;
                responseData.error = 'Too many attempts. Please try again later.';
                return responseData;
            }

            responseData.status = Status.BAD_REQUEST;
            responseData.error = 'CAPTCHA verification failed.';
            return responseData;
        }

        session.verificationAttempts = 0;
        session.attempts = 0;

        responseData = {
            status: Status.OK,
            error: null
        };

        return responseData;
    },
    handleCaptcha: (session) => {
        let responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error on getting captcha'
        };
        try {
            if (captchaHelper.isBlocked(session)) {
                const waitTime = Math.ceil((session.blockUntil - Date.now()) / 1000);
                responseData.status = Status.TOO_MANY_ATTEMPTS;
                responseData.error = 'Too many attempts. Please try again after ' + waitTime + ' seconds.';
                return responseData;
            }
        
            if (!session.attempts) {
                session.attempts = 0;
            }
        
            session.attempts += 1;
        
            if (session.attempts > MAX_ATTEMPTS) {
                session.blockUntil = Date.now() + WAIT_TIME;
                responseData.status = Status.TOO_MANY_ATTEMPTS;
                responseData.error = 'Too many attempts. Please try again later.';
                return responseData;
            }

            const { digits, buffer } = captchaHelper.generateCaptcha();
            responseData.status = Status.OK;
            responseData.error = null;
            session.captcha = digits;
            responseData.captcha = buffer.toString('base64');
        } catch (error) {
            console.error('Error on getting captcha:', error);
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error on getting captcha';
        }
        return responseData;
    },
    resetCaptcha: (session) => {
        session.verificationAttempts = 0;
        session.attempts = 0;
        session.captcha = null;
    }
};

export default captchaHelper;