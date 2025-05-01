// src/routes/lottery.routes.js
// If you need manual lottery triggers, define routes here
// Otherwise, this file might not be necessary as lottery is triggered by payment service
const express = require('express');
// const lotteryController = require('../controllers/lottery.controller');

const router = express.Router();

// Example for manual trigger (requires lotteryController implementation)
// router.post('/groups/:groupId/draw', lotteryController.manualDrawLottery);

module.exports = router;


// const express = require('express');
// const router = express.Router();
// const groupController = require('../controllers/groupController');
// // const { isAuthenticated, isGroupAdmin } = require('../middleware/authMiddleware'); // Import auth middleware

// // Route to manually schedule the lottery
// // In production, use middleware: router.post('/:groupId/schedule-lottery', isAuthenticated, isGroupAdmin, groupController.handleScheduleLotteryManually);
// router.post('/:groupId/schedule-lottery', groupController.handleScheduleLotteryManually);


// // ... other group routes

// module.exports = router;