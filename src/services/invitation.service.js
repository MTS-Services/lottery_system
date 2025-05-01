const prisma = require('../utils/prisma.client');
const { generateUniqueCode } = require('../utils/helpers');
const { sendEmail } = require('./email.service');
const AppError = require('../utils/errors');
const { getGroupDetailsForInvite } = require('./group.service'); 

const sendInvitations = async (groupId, adminUserId, listOfMemberEmails) => {

    const groupDetails = await getGroupDetailsForInvite(groupId); 
 console.log(groupDetails);
    if (groupDetails.admin.userId !== adminUserId) { 

         console.error(`User ${adminUserId} is not authorized to invite for group ${groupId}`);
         throw new AppError('User not authorized to invite for this group', 403);
    }
  


    const currentMemberCount = groupDetails._count.memberships;
    const pendingInviteCount = groupDetails._count.invitations;
    const availableSlots = groupDetails.maxMembers - currentMemberCount;
    const canInviteCount = availableSlots - pendingInviteCount;


    if (listOfMemberEmails.length > canInviteCount) {
        throw new AppError(`Cannot invite ${listOfMemberEmails.length} members. Only ${canInviteCount} slots available for new invitations.`, 400);
    }

    const invitationResults = [];
    const adminSummary = [];

    for (const email of listOfMemberEmails) {
        const normalizedEmail = email.toLowerCase().trim();
        if (!normalizedEmail) continue;

        try {
             // Check if user with this email is already an active member
            const existingMembership = await prisma.membership.findFirst({
                where: { groupId, user: { email: normalizedEmail }, isActive: true }
            });
            if (existingMembership) {
                invitationResults.push({ email: normalizedEmail, status: 'failed', reason: 'Already a member' });
                continue;
            }

             // Check if there's already an active PENDING invitation
            const existingInvitation = await prisma.invitation.findFirst({
                where: { groupId, invitedUserEmail: normalizedEmail, status: 'PENDING' }
            });
            if (existingInvitation) {
                invitationResults.push({ email: normalizedEmail, status: 'failed', reason: 'Already invited' });
                continue;
            }

            const invitationCode = generateUniqueCode(10); // Make code longer

            // Add expiry? Example: 7 days
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7);

            await prisma.invitation.create({
                data: {
                    groupId,
                    invitedUserEmail: normalizedEmail,
                    invitationCode,
                    adminUserId, // User who sent the invite
                    expiresAt,
                    status: 'PENDING',
                },
            });

            // Send email to invited user
            sendEmail({
                to: normalizedEmail,
                subject: `Invitation to Join Group "${groupDetails.groupName}" on ROSCA App!`,
                text: `Hi,\n\nYou've been invited by <span class="math-inline">${groupDetails.admin.name} to join the group "</span>${groupDetails.groupName}".\nThis group requires a contribution of $${groupDetails.contributionAmount} ${groupDetails.frequency}.\n\nUse the unique code ${invitationCode} in the app to accept.\n\nGroup Description: ${groupDetails.description || 'N/A'}\nThis code is valid until ${expiresAt.toDateString()}.\n\nBest regards,\nThe ROSCA App Team`,
                html: `<p>Hi,</p><p>You've been invited by <strong><span class="math-inline">${groupDetails.admin.name}</strong> to join the group "<strong></span>${groupDetails.groupName}</strong>".</p><p>This group requires a contribution of <strong>$${groupDetails.contributionAmount} <span class="math-inline">${groupDetails.frequency}</strong>.</p><p>Use the unique code <strong></span>${invitationCode}</strong> in the app to accept.</p><p>Group Description: ${groupDetails.description || 'N/A'}</p><p>This code is valid until ${expiresAt.toDateString()}.</p><p>Best regards,<br>The ROSCA App Team</p>`,
            }).catch(err => console.error(`Failed to send invitation email to ${normalizedEmail}:`, err));

            invitationResults.push({ email: normalizedEmail, status: 'success', code: invitationCode });
            adminSummary.push(`- ${normalizedEmail}: Code ${invitationCode}`);

        } catch (error) {
             console.error(`Failed to process invitation for ${normalizedEmail}:`, error);
             invitationResults.push({ email: normalizedEmail, status: 'failed', reason: 'Internal server error' });
        }
    }

     // Send summary email to Admin
     if (adminSummary.length > 0) {
         const admin = await prisma.user.findUnique({ where: { userId: adminUserId }, select: { email: true, name: true } }); // Fetch admin email if not already available
         if (admin) {
             sendEmail({
                 to: admin.email,
                 subject: `Invitation Summary for Group "${groupDetails.groupName}"`,
                 text: `Hi <span class="math-inline">${admin.name},\\n\\nYou have invited the following users to "</span>${groupDetails.groupName}":\n${adminSummary.join('\n')}\n\nPlease keep these codes safe in case a user misplaces their email.`,
                 html: `<p>Hi <span class="math-inline">${admin.name},</p><p>You have invited the following users to "<strong>${groupDetails.groupName}</strong>":</p><ul>${adminSummary.map(line => `<li>${line.substring(2)}</li>`).join('')}</ul><p>Please keep these codes safe in case a user misplaces their email.</p>`,
             }).catch(err => console.error("Failed to send admin invitation summary email:", err));
         }
     }

    return invitationResults; // Return status for each email invited
};

const acceptInvitation = async (invitationCode, acceptingUserId) => {
    const invitation = await prisma.invitation.findUnique({
        where: { invitationCode },
        include: { group: true } // Include group details like maxMembers and status
    });

    if (!invitation) {
        throw new AppError('Invalid invitation code', 404);
    }
    if (invitation.status !== 'PENDING') {
         throw new AppError(`Invitation has already been ${invitation.status.toLowerCase()}`, 400);
    }
    if (invitation.expiresAt && new Date() > invitation.expiresAt) {
         // Optionally update status to EXPIRED here
         await prisma.invitation.update({ where: { invitationId: invitation.invitationId }, data: { status: 'EXPIRED' } });
        throw new AppError('Invitation has expired', 410); // 410 Gone
    }

    // Verify the user accepting matches the invited email
    const user = await prisma.user.findUnique({ where: { userId: acceptingUserId } });
    if (!user || user.email.toLowerCase() !== invitation.invitedUserEmail.toLowerCase()) {
         throw new AppError('Invitation is not intended for this user', 403);
    }

    // Check group status and capacity again before joining
     if (invitation.group.status !== 'PENDING' && invitation.group.status !== 'ACTIVE') {
          throw new AppError(`Cannot join group as it is ${invitation.group.status.toLowerCase()}`, 400);
     }
     const currentMemberCount = await prisma.membership.count({ where: { groupId: invitation.groupId, isActive: true } });
     if (currentMemberCount >= invitation.group.maxMembers) {
         throw new AppError('Group is already full', 409); // 409 Conflict
     }

     // Use transaction to ensure atomicity
     const result = await prisma.$transaction(async (tx) => {
         // 1. Update Invitation status
         await tx.invitation.update({
             where: { invitationId: invitation.invitationId },
             data: { status: 'ACCEPTED' },
         });

         // 2. Create Membership record
         const newMembership = await tx.membership.create({
             data: {
                 userId: acceptingUserId,
                 groupId: invitation.groupId,
                 cyclePaymentCount: 0, // Start with 0 payments made
                 isActive: true,
                 // joinDate is handled by @default(now())
             },
         });

         return { membership: newMembership, group: invitation.group }; // Return needed data
     });

    // Post-transaction: Send emails
    const { membership, group } = result;

    // Email to Member
    sendEmail({
        to: user.email,
        subject: `Successfully Joined Group "${group.groupName}"!`,
        text: `Hi ${user.name},\n\nYou have successfully joined the group "${group.groupName}".\n\nGroup Details:\n - Frequency: ${group.frequency}\n - Admin: ${group.admin ? group.admin.name : 'Unknown'}\n\nWelcome aboard!`,
        html: `<p>Hi ${user.name},</p><p>You have successfully joined the group "<strong>${group.groupName}</strong>".</p><p><strong>Group Details:</strong></p><ul><li>Frequency: ${group.frequency}</li><li>Admin: ${group.admin ? group.admin.name : 'Unknown'}</li></ul><p>Welcome aboard!</p>`,
    }).catch(err => console.error(`Failed to send join confirmation email to ${user.email}:`, err));

    // Email to Admin
    const admin = await prisma.user.findUnique({ where: { userId: group.adminUserId }, select: { email: true, name: true } });
    if (admin) {
        const updatedMemberCount = currentMemberCount + 1;
        const remainingSlots = group.maxMembers - updatedMemberCount;
        const pendingInvitesCount = await prisma.invitation.count({ where: { groupId: group.groupId, status: 'PENDING' } });

        sendEmail({
            to: admin.email,
            subject: `New Member Joined "${group.groupName}"!`,
            text: `Hi ${admin.name},\n\nUser ${user.name} (${user.email}) has accepted their invitation and joined "${group.groupName}".\n\n - Total members joined: ${updatedMemberCount}\n - Remaining slots: ${remainingSlots}\n - Invited members yet to join: ${pendingInvitesCount}\n\n${remainingSlots === 0 ? 'The group is now full.' : ''}`,
            html: `<p>Hi ${admin.name},</p><p>User <strong>${user.name}</strong> (${user.email}) has accepted their invitation and joined "<strong>${group.groupName}</strong>".</p><ul><li>Total members joined: ${updatedMemberCount}</li><li>Remaining slots: ${remainingSlots}</li><li>Invited members yet to join: ${pendingInvitesCount}</li></ul>${remainingSlots === 0 ? '<p><strong>The group is now full.</strong></p>' : ''}`,
        }).catch(err => console.error("Failed to send admin join notification email:", err));
    }

    return { message: 'Successfully joined group', membershipId: membership.membershipId };
};



module.exports = {
    sendInvitations,
    acceptInvitation,
};