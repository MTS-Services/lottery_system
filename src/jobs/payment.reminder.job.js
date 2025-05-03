const cron = require('node-cron');
const prisma = require('../utils/prisma.client');
const { sendEmail } = require('../services/email.service');
const AppError = require('../utils/errors'); // Optional error utility

// Schedule to run every day at 9:00 AM (Asia/Dhaka time)
const schedulePaymentReminders = () => {
  cron.schedule(
    '0 9 * * *',
    async () => {
      console.log('Running daily payment reminder job...');

      try {
        // Calculate date range for 2 days ahead
        const now = new Date();
        const dueFrom = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
        const dueTo = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

        const memberships = await prisma.membership.findMany({
          where: {
            isActive: true,
            nextPaymentDueDate: {
              gte: dueFrom,
              lt: dueTo,
            },
          },
          include: {
            user: true,
            group: {
              include: {
                admin: true, // Make sure admin details are included
              },
            },
          },
        });

        if (memberships.length === 0) {
          console.log('No memberships due for payment in the next 2 days.');
          return;
        }

        console.log(`Found ${memberships.length} memberships due for payment in the next 2 days.`);

        for (const membership of memberships) {
          const { user, group } = membership;
          const dueDate =
            membership.cyclePaymentCount === 0
              ? group.currentCycleStartDate
              : membership.nextPaymentDueDate;

          if (!dueDate) {
            console.warn(
              `Skipping reminder for user ${user.email} in group "${group.groupName}" due to missing due date.`
            );
            continue;
          }

          const dueDateString = new Date(dueDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          });

          // Send email to user
          await sendEmail({
            to: user.email,
            subject: `Payment Reminder for Group "${group.groupName}"`,
            text: `Hi ${user.name},\n\nThis is a friendly reminder that your contribution of $${group.contributionAmount} for the group "${group.groupName}" is due in 2 days on ${dueDateString}.\n\nPlease make your payment through the app.\n\nBest regards,\nThe ROSCA App Team`,
            html: `<p>Hi <strong>${user.name}</strong>,</p><p>This is a friendly reminder that your contribution of <strong>$${group.contributionAmount}</strong> for the group "<strong>${group.groupName}</strong>" is due in 2 days on <strong>${dueDateString}</strong>.</p><p>Please make your payment through the app.</p><p>Best regards,<br>The ROSCA App Team</p>`,
          }).catch((err) =>
            console.error(
              `Failed to send payment reminder email to ${user.email} for group ${group.groupName}:`,
              err
            )
          );

          // Send email to group admin
          await sendEmail({
            to: group.admin.email,
            subject: `Member Payment Reminder - ${user.name}`,
            text: `Hi ${group.admin.name},\n\nThis is a reminder that ${user.name}'s contribution of $${group.contributionAmount} for the group "${group.groupName}" is due in 2 days on ${dueDateString}.\n\nBest regards,\nThe ROSCA App Team`,
            html: `<p>Hi <strong>${group.admin.name}</strong>,</p><p>This is a reminder that <strong>${user.name}</strong>'s contribution of <strong>$${group.contributionAmount}</strong> for the group "<strong>${group.groupName}</strong>" is due in 2 days on <strong>${dueDateString}</strong>.</p><p>Best regards,<br>The ROSCA App Team</p>`,
          }).catch((err) =>
            console.error(
              `Failed to send admin reminder email to ${group.admin.email} for group ${group.groupName}:`,
              err
            )
          );

          console.log(
            `Reminder sent to ${user.email} and admin ${group.admin.email} for group "${group.groupName}".`
          );

          await new Promise((resolve) => setTimeout(resolve, 100)); // Optional delay to avoid rate limits
        }

        console.log('Payment reminder job finished.');
      } catch (error) {
        console.error('Error running payment reminder job:', error);
        // Optional: Notify dev/admin team
      }
    },
    {
      scheduled: true,
      timezone: 'Asia/Dhaka',
    }
  );

  console.log('Payment reminder job scheduled.');
};

module.exports = { schedulePaymentReminders };
