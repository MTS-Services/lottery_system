// src/app.js
require('dotenv').config(); // Load .env variables early
const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes/index');
const AppError = require('./utils/errors');
const { schedulePaymentReminders } = require('./jobs/payment.reminder.job');

const app = express();

// --- Middleware ---
app.use(cors()); // Enable CORS for all origins (adjust in production)
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies


// --- API Routes ---
app.use('/api', apiRoutes);


// --- Global Error Handling Middleware ---
// Must have 4 arguments for Express to recognize it as error handler
app.use((err, req, res, next) => {
    err.statusCode = err.statusCode || 500; // Default to 500 Internal Server Error
    err.status = err.status || 'error';

    console.error('ERROR 💥:', err); // Log the full error stack

    // Send response
    res.status(err.statusCode).json({
        status: err.status,
        message: err.message,
        // Optionally include stack trace in development
        // stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        error: err // Include the error object itself can sometimes be useful (or strip it in prod)
    });
});


// --- Start Server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`http://localhost:${PORT} is running in ${process.env.NODE_ENV} mode`);
    // --- Start Scheduled Jobs ---
    schedulePaymentReminders(); // Initialize the cron job
    console.log('Scheduled jobs initialized.');
});


// --- Handle Unhandled Rejections and Uncaught Exceptions ---
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  // Optionally close server gracefully before exiting
  // server.close(() => {
  //   process.exit(1);
  // });
   process.exit(1); // Exit immediately (can use a more graceful shutdown)
});

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  process.exit(1);
});