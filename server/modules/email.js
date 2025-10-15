import { Status, } from '../constants.js';
import nodemailer  from 'nodemailer';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_ADDRESS,
        pass: process.env.EMAIL_PASSWORD,
    },
    connectionTimeout: 60000,
    greetingTimeout: 30000,
    socketTimeout: 60000,
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateLimit: 14,
    tls: {
        rejectUnauthorized: false
    },
    debug: process.env.NODE_ENV === 'development', 
});

const emailModule = {
    sendVerificationCode: async (email, verificationCode, retryCount = 0) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error on sending verification code',
        };
        
        const maxRetries = 3;
        const retryDelay = 2000;
        
        try {
            const mailOptions = {
                from: process.env.EMAIL_ADDRESS,
                to: email,
                subject: 'Your Password Reset Verification Code',
                text: `Your verification code for password reset is: ${verificationCode}. This code is valid for 10 minutes.`,
                html: `<p>Your verification code for password reset is: <strong>${verificationCode}</strong>.</p><p>This code is valid for 10 minutes.</p>`,
            };

            await transporter.verify();
            
            const result = await transporter.sendMail(mailOptions);
            
            console.log('Email sent successfully:', result.messageId);
            
            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = 'Verification code sent successfully';

        } catch (error) {
            console.error(`Error on sending verification code (attempt ${retryCount + 1}):`, error);
            
            if ((error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET' || error.code === 'ENOTFOUND') && retryCount < maxRetries) {
                console.log(`Retrying email send in ${retryDelay}ms... (attempt ${retryCount + 2}/${maxRetries + 1})`);
                
                await new Promise(resolve => setTimeout(resolve, retryDelay * (retryCount + 1)));
                
                return await emailModule.sendVerificationCode(email, verificationCode, retryCount + 1);
            }
            
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error on sending verification code';
            
            if (error.code === 'ETIMEDOUT') {
                responseData.error = 'Email service timeout - please try again later';
            } else if (error.code === 'EAUTH') {
                responseData.error = 'Email authentication failed - please check email configuration';
            } else if (error.code === 'ENOTFOUND') {
                responseData.error = 'Email service not available - please try again later';
            }
        }
        
        return responseData;
    },
};

export default emailModule;
