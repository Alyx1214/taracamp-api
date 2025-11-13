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

    sendVerificationEmail: async (email, verificationUrl, name = 'User', retryCount = 0) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error on sending verification email',
        };
        
        const maxRetries = 3;
        const retryDelay = 2000;
        
        try {
            const mailOptions = {
                from: process.env.EMAIL_ADDRESS,
                to: email,
                subject: 'Verify Your Email Address - Teachers Camp',
                text: `Hello ${name},\n\nThank you for registering with Teachers Camp! Please verify your email address by clicking the link below:\n\n${verificationUrl}\n\nThis link will expire in 24 hours.\n\nIf you did not create an account, please ignore this email.\n\nBest regards,\nTeachers Camp Team`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #333;">Hello ${name},</h2>
                        <p>Thank you for registering with Teachers Camp! Please verify your email address by clicking the button below:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${verificationUrl}" style="background-color: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Verify Email Address</a>
                        </div>
                        <p style="color: #999; font-size: 12px;">This link will expire in 24 hours.</p>
                        <p style="color: #999; font-size: 12px;">If you did not create an account, please ignore this email.</p>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                        <p style="color: #999; font-size: 12px;">Best regards,<br>Teachers Camp Team</p>
                    </div>
                `,
            };

            await transporter.verify();
            
            const result = await transporter.sendMail(mailOptions);
            
            console.log('Verification email sent successfully:', result.messageId);
            
            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = 'Verification email sent successfully';

        } catch (error) {
            console.error(`Error on sending verification email (attempt ${retryCount + 1}):`, error);
            
            if ((error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET' || error.code === 'ENOTFOUND') && retryCount < maxRetries) {
                console.log(`Retrying email send in ${retryDelay}ms... (attempt ${retryCount + 2}/${maxRetries + 1})`);
                
                await new Promise(resolve => setTimeout(resolve, retryDelay * (retryCount + 1)));
                
                return await emailModule.sendVerificationEmail(email, verificationUrl, name, retryCount + 1);
            }
            
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error on sending verification email';
            
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
