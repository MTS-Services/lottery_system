const prisma = require('../utils/prisma.client');
const { sendEmail } = require('./email.service');
const { checkAndExecuteLottery } = require('./lottery.service'); // Import lottery check/execution
const { formatDateForCycle,calculateNextCycleStartDateBasedOnFrequency } = require('../utils/helpers');
const AppError = require('../utils/errors');

const recordPayment = async (paymentData) => {
    const { userId, groupId, amount, transactionId, status, paymentDate } = paymentData;

    if (status?.toLowerCase() !== 'succeeded') {
        throw new AppError('Payment status must be "succeeded" to record', 400);
    }
    if (!userId || !groupId || !amount || !transactionId || !paymentDate) {
        throw new AppError('Missing required payment fields', 400);
    }

    // Check for duplicate transaction ID to ensure idempotency
    const existingPayment = await prisma.payment.findUnique({ where: { transactionId } });
    if (existingPayment) {
        console.log(`Payment with transactionId ${transactionId} already recorded.`);
        return { message: 'Payment already recorded', paymentId: existingPayment.paymentId };
    }

    const membership = await prisma.membership.findUnique({
        where: { userId_groupId: { userId, groupId } }, // Use compound unique index
        include: {
            group: true, // Need group details
            user: true, // Need user email/name for notifications
        },
    });

    if (!membership || !membership.isActive) {
        throw new AppError('Active membership not found for this user and group', 404);
    }
    if (membership.group.status !== 'ACTIVE') {
        throw new AppError(`Cannot record payment for group that is ${membership.group.status.toLowerCase()}`, 400);
    }

    // Verify amount matches expected contribution
    if (Math.abs(parseFloat(amount) - membership.group.contributionAmount) > 0.01) {
        throw new AppError(`Payment amount $${amount} does not match expected contribution $${membership.group.contributionAmount}`, 400);
    }

    // Get the cycleIdentifier for the group
const cycleIdentifier = membership.cyclePaymentCount === 0 
? formatDateForCycle(membership.group.currentCycleStartDate) 
: formatDateForCycle(membership.nextPaymentDueDate);


    // Check if the user has already made a payment for the same cycleIdentifier
    const existingCyclePayment = await prisma.payment.findFirst({
        where: {
            userId,
            groupId,
            cycleIdentifier,
        },
    });

    if (existingCyclePayment) {
        throw new AppError(`User ${userId} has already made a payment for cycle ${cycleIdentifier}`, 400);
    }
    const today = new Date();

    // This is the *next* cycle's start date
    const nextCycleStartDate =
      membership.cyclePaymentCount === 0
        ? membership.group.currentCycleStartDate
        : membership.nextPaymentDueDate;
    
    // Calculate current cycle *start* date
    const currentCycleStartDate = new Date(nextCycleStartDate);
    switch (membership.group.frequency) {
      case 'DAILY':
        currentCycleStartDate.setDate(currentCycleStartDate.getDate() - 1);
        break;
      case 'WEEKLY':
        currentCycleStartDate.setDate(currentCycleStartDate.getDate() - 7);
        break;
      case 'MONTHLY':
        currentCycleStartDate.setMonth(currentCycleStartDate.getMonth() - 1);
        break;
      default:
        throw new Error('Invalid frequency');
    }

    console.log(`Current cycle start date: ${currentCycleStartDate}`);
    console.log(`Next cycle start date: ${nextCycleStartDate}`);
    console.log(`Today: ${today}`);
    
    // ✅ Block if paying before current cycle start
    if (today < currentCycleStartDate) {
      throw new AppError("Next payment is not allowed before the current cycle starts.", 400);
    }
    
    
   

   

    // Prevent overpayment
    if (membership.cyclePaymentCount >= membership.group.maxMembers) {
        throw new AppError(`User ${userId} has reached the maximum payment count for this group`, 400);
    }


// const result = await prisma.$transaction(async (tx) => {
//     const paymentTimestamp = new Date(paymentDate);

//     // Create the new payment record
//     const newPayment = await tx.payment.create({
//         data: {
//             amount: parseFloat(amount),
//             transactionId,
//             status: 'succeeded',
//             paymentDate: paymentTimestamp,
//             cycleIdentifier,
//             membershipId: membership.membershipId,
//             userId,
//             groupId,
//         },
//     });

//     const cyclePaymentCount = membership.cyclePaymentCount + 1;

//     // Check if all members have paid (only proceed to update the cycle date once all members have paid)
//     const group = await tx.group.findUnique({
//         where: { groupId },
//         include: {
//             memberships: true, // Fetch memberships to check cyclePaymentCount for all members
//         },
//     });

//     // Check if all members have cyclePaymentCount > 0
//     const allMembersPaid = group.memberships.every(member => member.cyclePaymentCount > 0);

//     if (allMembersPaid && cyclePaymentCount <= group.maxMembers) {
//         // If all members have paid, update the next payment date for the entire group
//         const nextCycleStartDate = calculateNextCycleStartDateBasedOnFrequency(
//             group.currentCycleStartDate,
//             group.frequency
//         );

//         // Update the member's cycle payment count and next payment due date
//         await tx.membership.update({
//             where: { membershipId: membership.membershipId },
//             data: {
//                 cyclePaymentCount: cyclePaymentCount,
//                 nextPaymentDueDate: nextCycleStartDate,
//             },
//         });

//         // Update the group's next cycle start date only when all members have paid
//         // await tx.group.update({
//         //     where: { groupId },
//         //     data: {
//         //         nextCycleStartDate: nextCycleStartDate,
//         //     },
//         // });
//     } else {
//         // If not all members have paid, update only the cycle payment count for the member
//         await tx.membership.update({
//             where: { membershipId: membership.membershipId },
//             data: {
//                 cyclePaymentCount: cyclePaymentCount,
//             },
//         });
//     }

//     return { newPayment, user: membership.user, group: membership.group };
// });

// Proceed with payment
const result = await prisma.$transaction(async (tx) => {
    const paymentTimestamp = new Date(paymentDate);

    const newPayment = await tx.payment.create({
        data: {
            amount: parseFloat(amount),
            transactionId,
            status: 'succeeded',
            paymentDate: paymentTimestamp,
            cycleIdentifier,
            membershipId: membership.membershipId,
            userId,
            groupId,
        },
    });

    const cyclePaymentCount = membership.cyclePaymentCount + 1;
    const nextCycleStartDate = calculateNextCycleStartDateBasedOnFrequency(
        membership.group.currentCycleStartDate,
        membership.group.frequency
    );

    // Ensure cyclePaymentCount and nextPaymentDueDate are updated correctly
    await tx.membership.update({
        where: { membershipId: membership.membershipId },
        data: {
            cyclePaymentCount: cyclePaymentCount,
            nextPaymentDueDate: nextCycleStartDate,
        },
    });

    return { newPayment, user: membership.user, group: membership.group };
});



    const { newPayment, user, group } = result;

    // Email User Confirmation
    sendEmail({
        to: user.email,
        subject: `Payment Received for Group "${group.groupName}"`,
        text: `Hi ${user.name},\n\nWe have successfully received your payment of $${newPayment.amount} for the group "${group.groupName}" (Transaction ID: ${newPayment.transactionId}) for the cycle starting ${cycleIdentifier}.\n\nThank you!`,
        html: `<p>Hi ${user.name},</p><p>We have successfully received your payment of <strong>${newPayment.amount}</strong> for the group "<strong>${group.groupName}</strong>" (Transaction ID: ${newPayment.transactionId}) for the cycle starting ${cycleIdentifier}.</p><p>Thank you!</p>`,
    }).catch(err => console.error(`Failed to send payment confirmation email to ${user.email}:`, err));

    // Email Admin Update
    const admin = await prisma.user.findUnique({ where: { userId: group.adminUserId }, select: { email: true, name: true } });
    if (admin) {
        sendEmail({
            to: admin.email,
            subject: `Payment Received in Group "${group.groupName}"`,
            text: `Hi ${admin.name},\n\nA payment of $${newPayment.amount} was received from user ${user.name} (${user.email}) for group "${group.groupName}" on ${newPayment.paymentDate.toLocaleString()}.\nTransaction ID: ${newPayment.transactionId}`,
            html: `<p>Hi ${admin.name},</p><p>A payment of <strong>${newPayment.amount}</strong> was received from user <strong>${user.name}</strong> (${user.email}) for group "<strong>${group.groupName}</strong>" on ${newPayment.paymentDate.toLocaleString()}.</p><p>Transaction ID: ${newPayment.transactionId}</p>`,
        }).catch(err => console.error("Failed to send admin payment notification email:", err));
    }

    checkAndExecuteLottery(groupId).catch(err => {
        console.error(`Error during post-payment lottery check for group ${groupId}:`, err);

        sendEmail({
            to: admin.email,
            subject: `Error Executing Lottery for Group "${group.groupName}"`,
            text: `Hi ${admin.name},\n\nAn error occurred while executing the lottery for group "${group.groupName}".\n\nError details: ${err.message}`,
            html: `<p>Hi ${admin.name},</p><p>An error occurred while executing the lottery for group "<strong>${group.groupName}</strong>".</p><p>Error details: <strong>${err.message}</strong></p>`,
        }).catch(err => console.error("Failed to send admin lottery failure notification:", err));
    });

    return { message: 'Payment recorded successfully', paymentId: newPayment.paymentId };
};


//show all payment by userId for  role base admin will see all payment for eache group but member will see only his payment for all group.

const getAllPaymentsByUserId = async (userId) => {
    if (!userId) {
      throw new AppError('User ID is required', 400);
    }
  
    // Fetch user role
    const user = await prisma.user.findUnique({
      where: { userId },
      select: { role: true },
    });
  
    if (!user) {
      throw new AppError('User not found', 404);
    }
  
    let payments;
  
    if (user.role === 'ADMIN') {
      // Admin sees all payments for groups they manage
      payments = await prisma.payment.findMany({
        where: {
          group: {
            adminUserId: userId,
          },
        },
        include: {
          user: {
            select: { userId: true, name: true, email: true },
          },
          group: {
            select: { groupId: true, groupName: true },
          },
          membership: true,
        },
        orderBy: {
          paymentDate: 'desc',
        },
      });
    } else {
      // Member sees only their own payments
      payments = await prisma.payment.findMany({
        where: { userId },
        include: {
          group: {
            select: { groupId: true, groupName: true },
          },
          membership: true,
        },
        orderBy: {
          paymentDate: 'desc',
        },
      });
    }
  
    if (payments.length === 0) {
      throw new AppError('No payments found', 404);
    }
  
    // Group payments by group name
    const groupedByGroup = payments.reduce((acc, payment) => {
      const groupName = payment.group.groupName;
  
      if (!acc[groupName]) {
        acc[groupName] = [];
      }
  
      acc[groupName].push({
        paymentId: payment.paymentId,
        amount: payment.amount,
        paymentDate: payment.paymentDate,
        status: payment.status,
        cycleIdentifier: payment.cycleIdentifier,
        ...(user.role === 'ADMIN' && {
          paidBy: {
            userId: payment.user.userId,
            name: payment.user.name,
            email: payment.user.email,
          },
        }),
      });
  
      return acc;
    }, {});
  
    return groupedByGroup;
  };
  

module.exports = {
    recordPayment,
    getAllPaymentsByUserId,
};



