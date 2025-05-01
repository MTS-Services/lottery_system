// src/routes/index.js

const express = require('express');
const userRoutes = require('./user.routes');
const groupRoutes = require('./group.routes');
const invitationRoutes = require('./invitation.routes');
const paymentRoutes = require('./payment.routes');
// const lotteryRoutes = require('./lottery.routes'); // Uncomment if needed

const router = express.Router();

// Attach all routes with clean path
router.use('/users', userRoutes);         // /api/users
router.use('/groups', groupRoutes);        // /api/groups
router.use('/invitations', invitationRoutes); // /api/invitations/accept
router.use('/payments', paymentRoutes);    // /api/payments
// router.use('/lotteries', lotteryRoutes); // if needed later

// Health check
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;
