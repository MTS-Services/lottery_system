const groupService = require('../services/group.service');
const { sendEmail } = require('../services/email.service'); 
const AppError = require('../utils/errors');


const createGroup = async (req, res, next) => {
    try {
        
        const { adminUserId, groupName, contributionAmount, frequency, maxMembers, description } = req.body;
        if (!adminUserId) {
             throw new AppError('Admin User ID is required (Insecure - Should come from auth)', 400);
        }
         // --- END SECURITY WARNING ---

        const newGroup = await groupService.createGroup({ adminUserId, groupName, contributionAmount, frequency, maxMembers, description });
        res.status(201).json({
            status: 'success',
            data: {
                group: newGroup,
            },
        });
    } catch (error) {
        next(error);
    }
};

const activateGroup = async (req, res, next) => {
    try {
        const { groupId } = req.params;
        const { adminUserId } = req.body; 

        if (!adminUserId) {
            throw new AppError('Admin User ID is required (Insecure - Should come from auth)', 400);
        }

        // Get group details and send activation email
        const group = await groupService.getGroupById(groupId);
        if (!group) {
            throw new AppError('Group not found', 404);
        }

        // Send email to all members about the group activation
        group.memberships.forEach(member => {
            if (member.user && member.user.email) { // Ensure member has a valid email
                sendEmail({
                    to: member.user.email, // Ensure member has a valid email
                    subject: `Group "${group.groupName}" Activated!`,
                    text: `Hi ${member.user.name},\n\nThe group "${group.groupName}" has been activated successfully! You can now start contributing.\n\nGroup ID: ${groupId}`,
                    html: `<p>Hi ${member.user.name},</p><p>The group "<strong>${group.groupName}</strong>" has been activated successfully! You can now start contributing.</p><p>Group ID: ${groupId}</p>`,
                }).catch(err => console.error("Failed to send group activation email:", err));
            } else {
                console.error(`Member ${member.user ? member.user.name : 'Unknown'} does not have a valid email address.`);
            }
        });

        // Activate the group
        const activatedGroup = await groupService.activateGroup(groupId, adminUserId);

        res.status(200).json({
            status: 'success',
            message: 'Group activated successfully',
            data: {
                group: activatedGroup,
            },
        });
    } catch (error) {
        next(error);
    }
};


 const getGroup = async (req, res, next) => {
    try {
        const { groupId } = req.params;
        const group = await groupService.getGroupById(groupId);
        res.status(200).json({
            status: 'success',
            data: {
                group,
            },
        });
    } catch (error) {
         next(error);
    }
};

const getActiveGroupDetails = async (req, res, next) => {
    try {
        console.log("Fetching group details...");
        const { groupId } = req.params;
        const userId = req.body.userId; // Get the user ID from the authenticated user (auth middleware)

        // Fetch group details including active memberships and admin details
        const group = await groupService.getActiveGroupDetails( userId);

        // Check if the group exists
        if (!group) {
            throw new AppError('Group not found', 404);
        }

        res.status(200).json({
            status: 'success',
            data: {
                group,
            },
        });
    } catch (error) {
        next(error);
    }
}
const getCompletedGroupDetails = async (req, res, next) => {
    try {
        console.log("Fetching group details...");
        const { groupId } = req.params;
        const userId = req.body.userId; // Get the user ID from the authenticated user (auth middleware)

        // Fetch group details including active memberships and admin details
        const group = await groupService.getCompletedGroupDetails( userId);

        // Check if the group exists
        if (!group) {
            throw new AppError('Group not found', 404);
        }

        res.status(200).json({
            status: 'success',
            data: {
                group,
            },
        });
    } catch (error) {
        next(error);
    }
}




module.exports = {
    createGroup,
    activateGroup,
    getGroup,
    getActiveGroupDetails,
    getCompletedGroupDetails
};