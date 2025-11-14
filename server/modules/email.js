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

// Helper function to generate reservation email HTML (for preview/testing)
export const generateReservationEmailHTML = (reservationDetails) => {
    const {
        guestName,
        facilityName,
        dateOfArrival,
        dateOfDeparture,
        timeOfArrival,
        numberOfGuests,
        totalEstimatedAmount,
        serviceType,
        category,
        status
    } = reservationDetails;

    // Format dates
    const formatDate = (date) => {
        if (!date) return 'N/A';
        const d = new Date(date);
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    // Format time from 24-hour to 12-hour format
    const formatTime = (time24) => {
        if (!time24) return 'N/A';
        
        // Handle formats like "14:00" or "14:00:00"
        const timeMatch = time24.match(/^(\d{1,2}):(\d{2})/);
        if (!timeMatch) return time24; // Return as-is if format is unexpected
        
        let hours = parseInt(timeMatch[1], 10);
        const minutes = timeMatch[2];
        const ampm = hours >= 12 ? 'PM' : 'AM';
        
        // Convert to 12-hour format
        hours = hours % 12;
        hours = hours ? hours : 12; // 0 should be 12
        
        return `${hours}:${minutes} ${ampm}`;
    };

    // Format amount
    const formatAmount = (amount) => {
        if (!amount) return '₱0.00';
        return `₱${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // Format guest count - only show categories that have values
    const formatGuestCount = (numberOfGuests) => {
        if (!numberOfGuests) return 'N/A';
        
        const parts = [];
        if (numberOfGuests.adult > 0) parts.push(`Adults: ${numberOfGuests.adult}`);
        if (numberOfGuests.children > 0) parts.push(`Children: ${numberOfGuests.children}`);
        if (numberOfGuests.pwds > 0) parts.push(`PWDs: ${numberOfGuests.pwds}`);
        if (numberOfGuests.seniorCitizen > 0) parts.push(`Senior Citizens: ${numberOfGuests.seniorCitizen}`);
        
        const breakdown = parts.length > 0 ? ` (${parts.join(', ')})` : '';
        return `Total: ${numberOfGuests.total || 0}${breakdown}`;
    };
    
    const guestCountText = formatGuestCount(numberOfGuests);

    const statusText = status || 'Pending';

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                @media only screen and (max-width: 600px) {
                    .email-container {
                        padding: 10px !important;
                    }
                    .email-content {
                        padding: 20px !important;
                    }
                    .details-section {
                        padding: 20px !important;
                        margin: 20px 0 !important;
                    }
                    .detail-row {
                        display: block !important;
                        padding: 12px 0 !important;
                        border-bottom: 1px solid #e0e0e0;
                    }
                    .detail-row:last-child {
                        border-bottom: none;
                    }
                    .detail-label {
                        display: block !important;
                        width: 100% !important;
                        margin-bottom: 4px !important;
                        font-size: 14px !important;
                    }
                    .detail-value {
                        display: block !important;
                        width: 100% !important;
                        font-size: 16px !important;
                    }
                    h2 {
                        font-size: 24px !important;
                        margin-bottom: 12px !important;
                    }
                    h3 {
                        font-size: 20px !important;
                        margin-bottom: 16px !important;
                    }
                    p {
                        font-size: 16px !important;
                        line-height: 1.6 !important;
                        margin: 16px 0 !important;
                    }
                    .amount-section {
                        padding: 20px !important;
                        margin: 20px 0 !important;
                    }
                    .amount-label {
                        font-size: 12px !important;
                        margin-bottom: 6px !important;
                    }
                    .amount-value {
                        font-size: 28px !important;
                    }
                }
            </style>
        </head>
        <body>
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;" class="email-container">
                <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" class="email-content">
                    <h2 style="color: #333; margin-top: 0; margin-bottom: 16px; font-size: 28px;">Hello ${guestName || 'Guest'},</h2>
                    <p style="color: #666; font-size: 16px; margin-bottom: 24px; line-height: 1.6;">Thank you for your reservation at Teachers Camp!</p>
                    
                    <div style="background-color: #f0f7ff; padding: 24px; border-radius: 5px; margin: 24px 0; border-left: 4px solid #4CAF50;" class="details-section">
                        <h3 style="color: #333; margin-top: 0; margin-bottom: 20px; font-size: 22px;">Reservation Details</h3>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr class="detail-row">
                                <td style="padding: 12px 0; color: #666; font-weight: bold; width: 40%; vertical-align: top;" class="detail-label">Facility:</td>
                                <td style="padding: 12px 0; color: #333; vertical-align: top;" class="detail-value">${facilityName || 'N/A'}</td>
                            </tr>
                            <tr class="detail-row">
                                <td style="padding: 12px 0; color: #666; font-weight: bold; vertical-align: top;" class="detail-label">Service Type:</td>
                                <td style="padding: 12px 0; color: #333; vertical-align: top;" class="detail-value">${serviceType || 'N/A'}</td>
                            </tr>
                            <tr class="detail-row">
                                <td style="padding: 12px 0; color: #666; font-weight: bold; vertical-align: top;" class="detail-label">Category:</td>
                                <td style="padding: 12px 0; color: #333; vertical-align: top;" class="detail-value">${category || 'N/A'}</td>
                            </tr>
                            <tr class="detail-row">
                                <td style="padding: 12px 0; color: #666; font-weight: bold; vertical-align: top;" class="detail-label">Status:</td>
                                <td style="padding: 12px 0; color: #333; font-weight: bold; vertical-align: top;" class="detail-value">${statusText}</td>
                            </tr>
                            <tr class="detail-row">
                                <td style="padding: 12px 0; color: #666; font-weight: bold; vertical-align: top;" class="detail-label">Date of Arrival:</td>
                                <td style="padding: 12px 0; color: #333; vertical-align: top;" class="detail-value">${formatDate(dateOfArrival)}</td>
                            </tr>
                            <tr class="detail-row">
                                <td style="padding: 12px 0; color: #666; font-weight: bold; vertical-align: top;" class="detail-label">Date of Departure:</td>
                                <td style="padding: 12px 0; color: #333; vertical-align: top;" class="detail-value">${formatDate(dateOfDeparture)}</td>
                            </tr>
                            <tr class="detail-row">
                                <td style="padding: 12px 0; color: #666; font-weight: bold; vertical-align: top;" class="detail-label">Time of Arrival:</td>
                                <td style="padding: 12px 0; color: #333; vertical-align: top;" class="detail-value">${formatTime(timeOfArrival)}</td>
                            </tr>
                            <tr class="detail-row">
                                <td style="padding: 12px 0; color: #666; font-weight: bold; vertical-align: top;" class="detail-label">Number of Guests:</td>
                                <td style="padding: 12px 0; color: #333; vertical-align: top;" class="detail-value">${guestCountText}</td>
                            </tr>
                        </table>
                    </div>
                    
                    <!-- Separate Estimated Amount Section -->
                    <div style="background-color: #f8f9fa; padding: 24px; border-radius: 8px; margin: 24px 0; text-align: center; border: 2px solid #4CAF50;" class="amount-section">
                        <p style="color: #666; font-size: 14px; margin: 0 0 8px 0; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;" class="amount-label">Total Estimated Amount</p>
                        <p style="color: #4CAF50; font-size: 32px; font-weight: bold; margin: 0; line-height: 1.2;" class="amount-value">${formatAmount(totalEstimatedAmount)}</p>
                    </div>
                    
                    <p style="color: #666; font-size: 15px; line-height: 1.7; margin: 20px 0;">
                        Your reservation has been submitted successfully. We will review your reservation and notify you of any updates.
                    </p>
                    
                    <p style="color: #666; font-size: 15px; line-height: 1.7; margin: 20px 0;">
                        If you have any questions, please contact us.
                    </p>
                    
                    <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">
                    <p style="color: #999; font-size: 13px; margin: 0; line-height: 1.6;">Best regards,<br>Teachers Camp</p>
                </div>
            </div>
        </body>
        </html>
    `;
};

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
            
            await transporter.sendMail(mailOptions);
            
            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = 'Verification code sent successfully';

        } catch (error) {
            if ((error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET' || error.code === 'ENOTFOUND') && retryCount < maxRetries) {
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
            
            await transporter.sendMail(mailOptions);
            
            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = 'Verification email sent successfully';

        } catch (error) {
            if ((error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET' || error.code === 'ENOTFOUND') && retryCount < maxRetries) {
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

    sendReservationConfirmationEmail: async (email, reservationDetails, retryCount = 0) => {
        const responseData = {
            status: Status.INTERNAL_SERVER_ERROR,
            error: 'Error on sending reservation confirmation email',
        };
        
        const maxRetries = 3;
        const retryDelay = 2000;
        
        try {
            const {
                reservationCode,
                guestName,
                facilityName,
                dateOfArrival,
                dateOfDeparture,
                timeOfArrival,
                numberOfGuests,
                totalEstimatedAmount,
                serviceType,
                category,
                status
            } = reservationDetails;

            // Format dates
            const formatDate = (date) => {
                if (!date) return 'N/A';
                const d = new Date(date);
                return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            };

            // Format time from 24-hour to 12-hour format
            const formatTime = (time24) => {
                if (!time24) return 'N/A';
                
                // Handle formats like "14:00" or "14:00:00"
                const timeMatch = time24.match(/^(\d{1,2}):(\d{2})/);
                if (!timeMatch) return time24; // Return as-is if format is unexpected
                
                let hours = parseInt(timeMatch[1], 10);
                const minutes = timeMatch[2];
                const ampm = hours >= 12 ? 'PM' : 'AM';
                
                // Convert to 12-hour format
                hours = hours % 12;
                hours = hours ? hours : 12; // 0 should be 12
                
                return `${hours}:${minutes} ${ampm}`;
            };

            // Format amount
            const formatAmount = (amount) => {
                if (!amount) return '₱0.00';
                return `₱${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            };

            // Format guest count
            const guestCountText = numberOfGuests 
                ? `Total: ${numberOfGuests.total || 0} (Adults: ${numberOfGuests.adult || 0}, Children: ${numberOfGuests.children || 0}${numberOfGuests.pwds ? `, PWDs: ${numberOfGuests.pwds}` : ''}${numberOfGuests.seniorCitizen ? `, Senior Citizens: ${numberOfGuests.seniorCitizen}` : ''})`
                : 'N/A';

            const statusText = status || 'Pending';

            // Generate HTML using the helper function
            const html = generateReservationEmailHTML(reservationDetails);

            const mailOptions = {
                from: process.env.EMAIL_ADDRESS,
                to: email,
                subject: `Reservation Confirmation - Teachers Camp`,
                text: `Hello ${guestName || 'Guest'},

Thank you for your reservation at Teachers Camp!

Reservation Details:
- Facility: ${facilityName || 'N/A'}
- Service Type: ${serviceType || 'N/A'}
- Category: ${category || 'N/A'}
- Status: ${statusText}
- Date of Arrival: ${formatDate(dateOfArrival)}
- Date of Departure: ${formatDate(dateOfDeparture)}
- Time of Arrival: ${formatTime(timeOfArrival)}
- Number of Guests: ${guestCountText}
- Total Estimated Amount: ${formatAmount(totalEstimatedAmount)}

Your reservation has been submitted successfully. We will review your reservation and notify you of any updates.

If you have any questions, please contact us.

Best regards,
Teachers Camp Team`,
                html: html,
            };

            await transporter.verify();
            
            await transporter.sendMail(mailOptions);
            
            responseData.status = Status.OK;
            responseData.error = null;
            responseData.message = 'Reservation confirmation email sent successfully';

        } catch (error) {
            if ((error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET' || error.code === 'ENOTFOUND') && retryCount < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, retryDelay * (retryCount + 1)));
                
                return await emailModule.sendReservationConfirmationEmail(email, reservationDetails, retryCount + 1);
            }
            
            responseData.status = Status.INTERNAL_SERVER_ERROR;
            responseData.error = 'Error on sending reservation confirmation email';
            
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
