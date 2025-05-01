// src/services/email.service.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    // Optional: Add TLS options if needed, e.g., for self-signed certs
    // tls: {
    //     rejectUnauthorized: false // Only for testing, not recommended for production
    // }
});

const sendEmail = async (options) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_FROM,
            to: options.to,
            subject: options.subject,
            text: options.text, // Plain text body
            html: options.html, // HTML body (optional)
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent: ' + info.response);
        return info;
    } catch (error) {
        console.error('Error sending email:', error);
        // Decide if you want to throw the error or handle it silently
        // Depending on the importance of the email, you might queue it for retry
        // throw new Error(`Email could not be sent: ${error.message}`);
    }
};

module.exports = { sendEmail };