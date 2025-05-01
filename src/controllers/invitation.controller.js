const invitationService = require('../services/invitation.service');
const AppError = require('../utils/errors');

const sendInvitations = async (req, res, next) => {
    try {
        const { groupId } = req.params;
        const { adminUserId, listOfMemberEmails } = req.body;
        if (!adminUserId) {
            throw new AppError('Admin User ID is required (Insecure - Should come from auth)', 400);
        }

        const results = await invitationService.sendInvitations(groupId, adminUserId, listOfMemberEmails);

        res.status(200).json({
            status: 'success',
            message: 'Invitations processed successfully',
            data: { results },
        });
    } catch (error) {
        next(error);
    }
};

const acceptInvitation = async (req, res, next) => {
    try {
        const { invitationCode } = req.body;
        const { userId } = req.body; // Insecure: should come from auth middleware

        if (!userId) {
            throw new AppError('Accepting User ID is required (Insecure - Should come from auth)', 400);
        }

        const result = await invitationService.acceptInvitation(invitationCode, userId);

        res.status(200).json({
            status: 'success',
            message: 'Invitation accepted successfully',
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    sendInvitations,
    acceptInvitation,
};
