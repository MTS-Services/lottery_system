const express = require('express');
const invitationController = require('../controllers/invitation.controller');

const router = express.Router();

// Note: Sending invites is nested under groups: POST /api/groups/:groupId/invite
router.post('/accept', invitationController.acceptInvitation);

module.exports = router;