

const prisma = require('../utils/prisma.client');
const { sendEmail } = require('./email.service');
const { calculateNextDueDate, formatDateForCycle } = require('../utils/helpers');
const AppError = require('../utils/errors');

const checkAndExecuteLottery = async (groupId) => {
    console.log(`Checking lottery readiness for group ${groupId}...`);

    // Fetch the group and its active memberships, including admin data
    const group = await prisma.group.findUnique({
        where: { groupId },
        include: {
            memberships: {
                where: { isActive: true },
                select: { 
                    cyclePaymentCount: true,  // Use select here, not include
                    user: { select: { name: true, email: true } }
                }
            },
            admin: { select: { name: true, email: true } }
        }
    });
    

    if (!group || group.status !== 'ACTIVE') {
        console.log(`Group ${groupId} not found or not active. Skipping lottery check.`);
        return;
    }

    const activeMembers = group.memberships;
    if (activeMembers.length === 0) {
        console.log(`Group ${groupId} has no active members. Skipping lottery.`);
        return;
    }

const cycleDate = async () => {
    // Fetch active members and check their cyclePaymentCount
    const activeMembers = await prisma.membership.findMany({
        where: { groupId, isActive: true },
        select: { cyclePaymentCount: true, nextPaymentDueDate: true }
    });
    console.log(activeMembers);

    // Check if any member has cyclePaymentCount of 0
    const anyMemberHasCycleCountZero = activeMembers.some(member => member.cyclePaymentCount === 0);

    console.log(`Any member has cyclePaymentCount of 0: ${anyMemberHasCycleCountZero}`);

    if (anyMemberHasCycleCountZero) {
        // If any member has cyclePaymentCount 0, set cycleDate to the group's currentCycleStartDate
        console.log(`Cycle date set to currentCycleStartDate: ${group.currentCycleStartDate.toISOString().split('T')[0]}`);
        return group.currentCycleStartDate.toISOString().split('T')[0];  // Get date in YYYY-MM-DD format
    }

    // If all members have cyclePaymentCount > 1, use the nextPaymentDueDate of the first active member
    const firstMemberWithPayment = activeMembers.find(member => member.cyclePaymentCount > 1);
    console.log(`First member with cyclePaymentCount > 1: ${firstMemberWithPayment?.nextPaymentDueDate}`);

    if (firstMemberWithPayment) {
        // Return nextPaymentDueDate of the first member with cyclePaymentCount > 1
        return firstMemberWithPayment.nextPaymentDueDate?.toISOString().split('T')[0]; // Get date in YYYY-MM-DD format
    }

    // In case no eligible member was found with cyclePaymentCount > 1 (unlikely scenario), default to the group's next cycle start date
    console.log(`Cycle date set to currentCycleStartDate: ${group.currentCycleStartDate.toISOString().split('T')[0]}`);
    return group.currentCycleStartDate.toISOString().split('T')[0];
};

// Example usage:
const cycleDateValue = await cycleDate();
console.log(`Cycle Date: ${cycleDateValue}`);



    const totalCyclePayments = await prisma.payment.aggregate({
        where: {
            groupId,

                cycleIdentifier: cycleDateValue // Convert to string and get the date part
          
        },
        _count: {
            userId: true,
        }
    });


    console.log(totalCyclePayments)
    

    // Find the group details to check `maxMembers`
    const totalMembersCount = activeMembers.length;
    const maxMembers = group.maxMembers;

    // Check if the total `cyclePaymentCount` matches maxMembers
    const totalCyclePaymentCount = totalCyclePayments._count.userId || 0; // Default to 0 if undefined

    if (totalCyclePaymentCount === maxMembers) {
        console.log(`All members paid for group ${groupId}. Executing lottery draw...`);

        // Send "Ready for Lottery" email to admin before executing
        if (group.admin) {
            sendEmail({
                to: group.admin.email,
                subject: `All Payments Received for "${group.groupName}" - Lottery Starting!`,
                text: `Hi ${group.admin.name},\n\nAll members in group "${group.groupName}" have paid their contribution for the current cycle.\nThe lottery draw will now proceed automatically.\n\nYou will receive another email with the results shortly.`,
                html: `<p>Hi ${group.admin.name},</p><p>All members in group "<strong>${group.groupName}</strong>" have paid their contribution for the current cycle.</p><p><strong>The lottery draw will now proceed automatically.</strong></p><p>You will receive another email with the results shortly.</p>`,
            }).catch(err => console.error("Failed to send admin lottery ready email:", err));
        }

        try {
            await executeLotteryDraw(groupId, group, activeMembers,cycleDateValue,totalCyclePayments);
        } catch (error) {
            console.error(`Error executing lottery for group ${groupId}:`, error);
            if (group.admin) {
                sendEmail({
                    to: group.admin.email,
                    subject: `ERROR: Lottery Failed for Group "${group.groupName}"`,
                    text: `Hi ${group.admin.name},\n\nAn error occurred while executing the lottery for group "${group.groupName}".\nError details: ${error.message}`,
                    html: `<p>Hi ${group.admin.name},</p><p>An error occurred while executing the lottery for group "<strong>${group.groupName}</strong>".</p><p>Error details: <strong>${error.message}</strong></p>`,
                }).catch(err => console.error("Failed to send admin lottery failure email:", err));
            }
        }
    } else {
        console.log(`Group ${groupId} not ready for lottery. Not all members have paid.`);
    }
};


// This function performs the actual lottery draw and cycle advancement
const executeLotteryDraw = async (groupId, groupData, activeMembersData,cycleDate,totalCyclePayments) => {
    const group = groupData || await prisma.group.findUnique({ where: { groupId } });

    if (!group || group.status !== 'ACTIVE') {
        throw new AppError(`Cannot draw lottery: Group ${groupId} not found or not active.`, 400);
    }

    const activeMembers = await prisma.membership.findMany({
        where: { 
            groupId, 
            isActive: true 
        },
        include: {
            user: {
                select: {
                    userId: true,
                    name: true,
                    email: true
                }
            }
        }
    });
    
    console.log(activeMembers);
    

     // Select eligible members (those who haven't won yet) with their `membershipId`
     const eligibleMembers = activeMembers.filter(m => !m.hasWonLottery).map(m => {
        return {
            ...m, // Include all existing data
            membershipId: m.membershipId // Ensure membershipId is available for the winner
        };
    });
   
    
console.log(`Eligible members for lottery:`, eligibleMembers);

// If no eligible members left (i.e., all have won), complete the group
if (eligibleMembers.length === 0) {
    console.log(`All members have won in group ${groupId}. Completing group.`);
    
    // Set all members' isActive to false
    await prisma.membership.updateMany({
        where: { groupId, isActive: true },
        data: { isActive: false },
    });

    // Set the group status to COMPLETED
    await prisma.group.update({
        where: { groupId },
        data: { status: 'COMPLETED' },
    });

    // Notify admin and members that the group has completed
    await sendCompletionNotifications(groupId, group, activeMembers);
    return;
}

// Select a random winner from eligible members
const winnerIndex = Math.floor(Math.random() * eligibleMembers.length);
const winner = eligibleMembers[winnerIndex];

// Ensure winner's `membershipId` is available for the update
const winnerMembershipId = winner.membershipId;

if (!winnerMembershipId) {
    throw new AppError("Winner membershipId not found, cannot update membership.", 400);
}

const potAmount = group.contributionAmount * activeMembers.length; // Total pot amount
const cycleIdentifier = cycleDate; // Use the cycle date passed as a parameter
const lotteryDate = new Date();

const newCurrentCycleStartDate = new Date(group.nextPaymentDueDate || Date.now());
newCurrentCycleStartDate.setHours(0, 0, 0, 0); // Set to midnight
const newNextPaymentDueDate = calculateNextDueDate(newCurrentCycleStartDate, group.frequency);

console.log(`New next payment due date: ${newNextPaymentDueDate}`);



await prisma.$transaction(async (tx) => {
    // Update winner's membership using membershipId
    await tx.membership.update({
        where: { membershipId: winnerMembershipId },
        data: { hasWonLottery: true },
    });

    // Record the lottery
    await tx.lottery.create({
        data: {
            groupId,
            cycleIdentifier,
            winningUserId: winner.userId,
            potAmount,
            lotteryDate,
        },
    });
});

const activeMembers2 = await prisma.membership.findMany({
    where: { groupId, isActive: true },
    select: { cyclePaymentCount: true, membershipId: true, userId: true },
});

console.log(`Active members: ${JSON.stringify(activeMembers2)}`);

// Check if all members' cyclePaymentCount equals maxMembers
const allMembersPaid = activeMembers2.every(member => member.cyclePaymentCount === group.maxMembers);

if (allMembersPaid) {
    console.log(`All members have made maximum payments for group ${groupId}. Completing group.`);

    // Deactivate all active members
    await prisma.membership.updateMany({
        where: { groupId, isActive: true },
        data: { isActive: false },
    });

    // Update the group status to COMPLETED
    await prisma.group.update({
        where: { groupId },
        data: { status: 'COMPLETED' },
    });

    // Notify admin and members that the group has completed
    await sendCompletionNotifications(groupId, group, activeMembers);
    console.log(`Group ${groupId} completed.`);
} else {
    console.log(`Group ${groupId} not ready for completion. Not all members have made the maximum number of payments.`);
}


// Send email notifications to winner and other members
await sendLotteryNotifications(groupId, winner, group, potAmount, newNextPaymentDueDate);
console.log(`Lottery draw completed for group ${groupId}. Winner: ${winner.user.name}`);


};



// Function to send completion notifications (when group is complete)
const sendCompletionNotifications = async (groupId, group, activeMembers) => {
    const admin = await prisma.user.findUnique({ where: { userId: group.adminUserId }, select: { email: true, name: true } });
    if (admin) {
        sendEmail({
            to: admin.email,
            subject: `Group "${group.groupName}" Completed!`,
            text: `Hi ${admin.name},\n\nThe ROSCA group "${group.groupName}" has successfully completed its cycle, and all members have received their payout.\n\nThank you for your management!`,
            html: `<p>Hi ${admin.name},</p><p>The ROSCA group "<strong>${group.groupName}</strong>" has successfully completed its cycle, and all members have received their payout.</p><p>Thank you for your management!</p>`,
        }).catch(err => console.error("Failed to send admin group completion email:", err));
    }

    activeMembers.forEach(member => {
        if (member.user?.email) {
            sendEmail({
                to: member.user.email,
                subject: `Group "${group.groupName}" has Completed!`,
                text: `Hi ${member.user.name},\n\nThe ROSCA group "${group.groupName}" has successfully completed its cycle, and all members have received their payout.\n\nThank you for your participation!`,
                html: `<p>Hi ${member.user.name},</p><p>The ROSCA group "<strong>${group.groupName}</strong>" has successfully completed its cycle, and all members have received their payout.</p><p>Thank you for your participation!</p>`,
            }).catch(err => console.error(`Failed to send member group completion email to ${member.user.email}:`, err));
        }
    });
};

// Function to send lottery result notifications
const sendLotteryNotifications = async (groupId, winner, group, potAmount, nextPaymentDueDate) => {
    // Notify Winner

    //if group is completed, do not send next payment due date
    if (group.status === 'COMPLETED') {
        nextPaymentDueDate = null; // Set to null or handle accordingly
    }
    if (winner.user?.email) {
        sendEmail({
            to: winner.user.email,
            subject: `Congratulations! You Won the Lottery for Group "${group.groupName}"!`,
            text: `Hi ${winner.user.name},\n\nCongratulations! You have won the lottery for group "${group.groupName}".\n\nYou will receive a payout of $${potAmount}.${
                nextPaymentDueDate ? `\n\nYour next contribution of $${group.contributionAmount} is due by ${nextPaymentDueDate.toDateString()}.` : ''
            }`,
            html: `<p>Hi ${winner.user.name},</p><p>Congratulations! You have won the lottery for group "<strong>${group.groupName}</strong>".</p><p>You will receive a payout of <strong>$${potAmount}</strong>.</p><p>${nextPaymentDueDate ? `Your next contribution of <strong>$${group.contributionAmount}</strong> is due by <strong>${nextPaymentDueDate.toDateString()}</strong>.` : ''}</p>`,
        }).catch(err => console.error(`Failed to send lottery winner email to ${winner.user.email}:`, err));
    }

    // Notify Other Members
    const otherMembers = group.memberships.filter(m => m.userId !== winner.userId && m.userId !== group.adminUserId);
    for (const member of otherMembers) {
        if (member.user?.email) {
            sendEmail({
                to: member.user.email,
                subject: `Lottery Results for Group "${group.groupName}"`,
                text: `Hi ${member.user.name},\n\nThe lottery draw for group "${group.groupName}" has been completed.\nThe winner is ${winner.user.name}.${
                    nextPaymentDueDate ? `\n\nYour next contribution of $${group.contributionAmount} is due by ${nextPaymentDueDate.toDateString()}.` : ''
                }`,
                html: `<p>Hi ${member.user.name},</p><p>The lottery draw for group "<strong>${group.groupName}</strong>" has been completed.</p><p>The winner is <strong>${winner.user.name}</strong>.</p><p>${nextPaymentDueDate ? `Your next contribution of <strong>$${group.contributionAmount}</strong> is due by <strong>${nextPaymentDueDate.toDateString()}</strong>.` : ''}</p>`,
            }).catch(err => console.error(`Failed to send lottery result email to ${member.user.email}:`, err));
        }
    }
};

module.exports = {
    checkAndExecuteLottery,
    executeLotteryDraw,
};
