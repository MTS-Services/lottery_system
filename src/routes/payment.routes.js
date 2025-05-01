const express = require('express');
const paymentController = require('../controllers/payment.controller');

const router = express.Router();

router.post('/record', paymentController.recordPayment);
router.get('/showallpayment/:userId', paymentController.getAllPaymentsByUserId); // Assuming you want to fetch payments by user ID

module.exports = router;