const express = require('express');
const groupController = require('../controllers/group.controller');
const invitationController = require('../controllers/invitation.controller'); // For nested invite route
// const lotteryController = require('../controllers/lottery.controller'); // If adding manual trigger


const router = express.Router();

router.post('/create', groupController.createGroup);
router.get('/:groupId', groupController.getGroup);
router.post('/:groupId/activate', groupController.activateGroup); // Route to activate

// Nested route for inviting members to a specific group
router.post('/:groupId/invite', invitationController.sendInvitations);



//router.post('/details/', groupController.getGroupDetails);
router.post('/activegroupdetails', groupController.getActiveGroupDetails); // Route to get active group details
router.post('/completedgroupdetails', groupController.getCompletedGroupDetails);

// Optional: Manual Lottery Trigger (Needs Controller)
// router.post('/:groupId/draw-lottery', lotteryController.manualDrawLottery);


module.exports = router;