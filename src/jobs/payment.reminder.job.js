const cron = require('node-cron');
const prisma = require('../utils/prisma.client');
const { sendEmail } = require('../services/email.service');
const AppError = require('../utils/errors'); // Although errors here might just be logged


// Schedule to run every day at 9:00 AM (adjust cron string as needed)
// Cron format: second minute hour day-of-month month day-of-week
// '0 9 * * *' = 1.42 AM daily
const schedulePaymentReminders = () => {
    cron.schedule('0 9 * * *', async () => {
        console.log('Running daily payment reminder job...');

        try {
            const now = new Date();
            const reminderDateStart = new Date();
            reminderDateStart.setDate(now.getDate() + 2); // Target due date is 2 days from now
            reminderDateStart.setHours(0, 0, 0, 0); // Start of the target day

            const reminderDateEnd = new Date(reminderDateStart);
            reminderDateEnd.setHours(23, 59, 59, 999); // End of the target day


            // Find active memberships that are unpaid and due in 2 days
            const membershipsToRemind = await prisma.membership.findMany({
                where: {
                    isActive: true,
                    paymentStatusForCurrentCycle: 'UNPAID',
                    group: {
                        status: 'ACTIVE',
                        nextPaymentDueDate: {
                            gte: reminderDateStart, // Due date is >= start of target day
                            lte: reminderDateEnd,   // Due date is <= end of target day
                        },
                    },
                },
                include: {
                    user: { // Need user email and name
                        select: { email: true, name: true }
                    },
                    group: { // Need group name, amount, due date
                        select: { groupName: true, contributionAmount: true, nextPaymentDueDate: true }
                    }
                }
            });

            console.log(`Found ${membershipsToRemind.length} memberships needing payment reminders.`);

            for (const membership of membershipsToRemind) {
                if (!membership.user?.email || !membership.group?.nextPaymentDueDate) {
                    console.warn(`Skipping reminder for membershipId ${membership.membershipId} due to missing user email or group due date.`);
                    continue;
                }

                const { user, group } = membership;
                const dueDateString = group.nextPaymentDueDate.toDateString();

                sendEmail({
                    to: user.email,
                    subject: `Payment Reminder for Group "${group.groupName}"`,
                    text: `Hi ${user.name},\n\nThis is a friendly reminder that your contribution of $<span class="math-inline">\{group\.contributionAmount\} for the group "</span>{group.groupName}" is due in 2 days on ${dueDateString}.\n\nPlease make your payment through the app.\n\nBest regards,\nThe ROSCA App Team`,
                    html: `<p>Hi <span class="math-inline">\{user\.name\},</p\><p\>This is a friendly reminder that your contribution of <strong\></span><span class="math-inline">\{group\.contributionAmount\}</strong\> for the group "<strong\></span>{group.groupName}</strong>" is due in 2 days on <strong>${dueDateString}</strong>.</p><p>Please make your payment through the app.</p><p>Best regards,<br>The ROSCA App Team</p>`,
                }).catch(err => console.error(`Failed to send payment reminder email to ${user.email} for group ${group.groupName}:`, err));

                // Optional: Add a small delay between emails if sending many
                await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
            }

            console.log('Payment reminder job finished.');

        } catch (error) {
             console.error('Error running payment reminder job:', error);
             // Consider sending an alert to admin if the job fails critically
        }
    }, {
        scheduled: true,
        timezone: "Asia/Dhaka" // Set your server's timezone or the target timezone
    });

    console.log('Payment reminder job scheduled.');
};

module.exports = { schedulePaymentReminders };