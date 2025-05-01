// const prisma = require('../utils/prisma.client');
// const { sendEmail } = require('./email.service');
// const { calculateNextDueDate, formatDateForCycle } = require('../utils/helpers');
// const AppError = require('../utils/errors');

// // This function checks if all members paid and triggers the lottery execution
// const checkAndExecuteLottery = async (groupId) => {
//     console.log(`Checking lottery readiness for group ${groupId}...`);
//     const group = await prisma.group.findUnique({
//         where: { groupId },
//         include: {
//             memberships: {
//                 where: { isActive: true }, // Only consider active members
//                 include: { user: { select: { name: true, email: true } } } // Include user for notifications
//             },
//              admin: { select: { name: true, email: true } } // Include admin for notifications
//         }
//     });

//     if (!group || group.status !== 'ACTIVE') {
//         console.log(`Group ${groupId} not found or not active. Skipping lottery check.`);
//         return; // Not active, do nothing
//     }

//     const activeMembers = group.memberships;
//     if (activeMembers.length === 0) {
//         console.log(`Group ${groupId} has no active members. Skipping lottery.`);
//          // Optionally set status to completed or cancelled if no members?
//         return;
//     }

//     const allPaid = activeMembers.every(m => m.paymentStatusForCurrentCycle === 'PAID');

//     if (allPaid) {
//         console.log(`All members paid for group ${groupId}. Executing lottery draw...`);

//         // Send "Ready for Lottery" email to admin *before* executing
//         if (group.admin) {
//              sendEmail({
//                  to: group.admin.email,
//                  subject: `All Payments Received for "${group.groupName}" - Lottery Starting!`,
//                  text: `Hi <span class="math-inline">${group.admin.name},\\n\\nAll members in group "</span>${group.groupName}" have paid their contribution for the current cycle (ending ${group.nextPaymentDueDate ? group.nextPaymentDueDate.toDateString() : 'N/A'}).\nThe lottery draw will now proceed automatically.\n\nYou will receive another email with the results shortly.`,
//                  html: `<p>Hi <span class="math-inline">${group.admin.name},</p><p>All members in group "<strong></span>${group.groupName}</strong>" have paid their contribution for the current cycle (ending ${group.nextPaymentDueDate ? group.nextPaymentDueDate.toDateString() : 'N/A'}).</p><p><strong>The lottery draw will now proceed automatically.</strong></p><p>You will receive another email with the results shortly.</p>`,
//              }).catch(err => console.error("Failed to send admin lottery ready email:", err));
//         }

//          try {
//              await executeLotteryDraw(groupId, group, activeMembers); // Pass fetched data to avoid re-query
//          } catch (error) {
//              console.error(`Error executing lottery for group ${groupId}:`, error);
//              // Notify admin about the failure
//               if (group.admin) {
//                 sendEmail({
//                     to: group.admin.email,
//                     subject: `ERROR: Lottery Failed for Group "${group.groupName}"`,
//                     text: `Hi <span class="math-inline">${group.admin.name},\\n\\nAn error occurred while executing the lottery for group "</span>${group.groupName}".\n\nError details: ${error.message}\n\nPlease check the system logs for more information.`,
//                     html: `<p>Hi <span class="math-inline">${group.admin.name},</p><p>An error occurred while executing the lottery for group "<strong></span>${group.groupName}</strong>".</p><p>Error details: <strong>${error.message}</strong></p><p>Please check the system logs for more information.</p>`,
//                 }).catch(err => console.error("Failed to send admin lottery failure email:", err));
//              }
//          }
//     } else {
//         console.log(`Group ${groupId} not ready for lottery. Not all members have paid.`);
//         // Optional: Notify admin if due date passed and not all paid? (Handled by reminder job potentially)
//     }
// };


// // This function performs the actual lottery draw and cycle advancement
// const executeLotteryDraw = async (groupId, groupData, activeMembersData) => {
//      // Use passed data if available, otherwise fetch
//      const group = groupData || await prisma.group.findUnique({ where: { groupId } });
//      if (!group || group.status !== 'ACTIVE') {
//          throw new AppError(`Cannot draw lottery: Group ${groupId} not found or not active.`, 400);
//      }

//      const activeMembers = activeMembersData || await prisma.membership.findMany({
//          where: { groupId, isActive: true },
//          include: { user: { select: { userId: true, name: true, email: true } } }
//      });

//     const eligibleMembers = activeMembers.filter(m => !m.hasWonLottery);

//     if (eligibleMembers.length === 0) {
//         console.log(`No eligible members left to win in group ${groupId}. Completing group.`);
//         // All members have won, mark group as completed
//         await prisma.group.update({
//             where: { groupId },
//             data: { status: 'COMPLETED' },
//         });

//         // Notify admin and members about group completion
//         const admin = await prisma.user.findUnique({ where: { userId: group.adminUserId }, select: { email: true, name: true } });
//          if (admin) {
//              sendEmail({
//                  to: admin.email,
//                  subject: `Group "${group.groupName}" Completed!`,
//                     text: `Hi <span class="math-inline">${admin.name},\\n\\nThe ROSCA group "</span>${group.groupName}" has successfully completed its cycle, and all members have received their payout.\n\nThank you for your management!`,
//                     html: `<p>Hi <span class="math-inline">${admin.name},</p><p>The ROSCA group "<strong></span>${group.groupName}</strong>" has successfully completed its cycle, and all members have received their payout.</p><p>Thank you for your management!</p>`,
//              }).catch(err => console.error("Failed to send admin group completion email:", err));
//         }
//         activeMembers.forEach(member => {
//             if (member.user?.email) {
//                 sendEmail({
//                      to: member.user.email,
//                      subject: `Group "${group.groupName}" has Completed!`,
//                         text: `Hi <span class="math-inline">${member.user.name},\\n\\nThe ROSCA group "</span>${group.groupName}" has successfully completed its cycle, and all members have received their payout.\n\nThank you for your participation!`,
//                         html: `<p>Hi <span class="math-inline">${member.user.name},</p><p>The ROSCA group "<strong></span>${group.groupName}</strong>" has successfully completed its cycle, and all members have received their payout.</p><p>Thank you for your participation!</p>`,
//                  }).catch(err => console.error(`Failed to send member group completion email to ${member.user.email}:`, err));
//              }
//         });
//         return; // Stop execution for this group
//     }

//     // Select a random winner
//     const winnerIndex = Math.floor(Math.random() * eligibleMembers.length);
//     const winner = eligibleMembers[winnerIndex];

//     // Calculate pot amount
//     const potAmount = group.contributionAmount * activeMembers.length; // Based on active members this cycle

//     // Prepare for next cycle
//     const cycleIdentifier = formatDateForCycle(group.currentCycleStartDate); // Cycle that just finished
//     const lotteryDate = new Date();
//     const newCurrentCycleStartDate = new Date(lotteryDate); // Start next cycle immediately after lottery
//     newCurrentCycleStartDate.setHours(0, 0, 0, 0); // Optional: Start next cycle at midnight?
//     const newNextPaymentDueDate = calculateNextDueDate(newCurrentCycleStartDate, group.frequency);

//     // Use transaction for atomicity
//      await prisma.$transaction(async (tx) => {
//          // 1. Update winner's membership
//          await tx.membership.update({
//              where: { membershipId: winner.membershipId },
//              data: { hasWonLottery: true },
//          });

//          // 2. Create Lottery record
//          await tx.lottery.create({
//              data: {
//                  groupId,
//                  cycleIdentifier,
//                  winningUserId: winner.userId,
//                  potAmount,
//                  lotteryDate,
//              },
//          });

//          // 3. Update Group with next cycle dates
//          await tx.group.update({
//              where: { groupId },
//              data: {
//                  currentCycleStartDate: newCurrentCycleStartDate,
//                  nextPaymentDueDate: newNextPaymentDueDate,
//              },
//          });

//          // 4. Reset payment status for ALL active members for the NEW cycle
//          const activeMemberIds = activeMembers.map(m => m.membershipId);
//          await tx.membership.updateMany({
//              where: {
//                   membershipId: { in: activeMemberIds }
//                 // Alternatively: where: { groupId: groupId, isActive: true }
//              },
//              data: { paymentStatusForCurrentCycle: 'UNPAID' },
//          });
//      });

//     // Post-transaction: Send notification emails

//     // Email Winner
//      if (winner.user?.email) {
//         sendEmail({
//             to: winner.user.email,
//             subject: `Congratulations! You Won the Lottery for Group "${group.groupName}"!`,
//             text: `Hi <span class="math-inline">${winner.user.name},\\n\\nCongratulations! You have won the lottery for group "</span>${group.groupName}" (cycle ending ${cycleIdentifier}).\n\nYou will receive a payout of $${potAmount}.\n\nYour next contribution of $${group.contributionAmount} is due by ${newNextPaymentDueDate.toDateString()}.`,
//             html: `<p>Hi <span class="math-inline">${winner.user.name},</p><p>Congratulations! You have won the lottery for group "<strong></span>${group.groupName}</strong>" (cycle ending ${cycleIdentifier}).</p><p>You will receive a payout of <strong>$${potAmount}</strong>.</p><p>Your next contribution of <strong>$${group.contributionAmount}</strong> is due by <strong>${newNextPaymentDueDate.toDateString()}</strong>.</p>`,
//         }).catch(err => console.error(`Failed to send lottery winner email to ${winner.user.email}:`, err));
//      }


//     // Email Other Members
//     const otherMembers = activeMembers.filter(m => m.userId !== winner.userId);
//     otherMembers.forEach(member => {
//          if (member.user?.email) {
//             sendEmail({
//                 to: member.user.email,
//                 subject: `Lottery Results for Group "${group.groupName}"`,
//                 text: `Hi <span class="math-inline">${member.user.name},\\n\\nThe lottery draw for group "</span>${group.groupName}" for the cycle ending ${cycleIdentifier} has been completed.\nThe winner is ${winner.user.name}.\n\nYour next contribution of $${group.contributionAmount} is due by ${newNextPaymentDueDate.toDateString()}.`,
//                 html: `<p>Hi <span class="math-inline">${member.user.name},</p><p>The lottery draw for group "<strong></span>${group.groupName}</strong>" for the cycle ending <span class="math-inline">${cycleIdentifier} has been completed.</p><p>The winner is <strong></span>${winner.user.name}</strong>.</p><p>Your next contribution of <strong>$<span class="math-inline">${group.contributionAmount}</strong> is due by <strong></span>${newNextPaymentDueDate.toDateString()}</strong>.</p>`,
//             }).catch(err => console.error(`Failed to send lottery result email to ${member.user.email}:`, err));
//          }
//     });

//      // Email Admin Result
//      const admin = await prisma.user.findUnique({ where: { userId: group.adminUserId }, select: { email: true, name: true } });
//      if (admin) {
//          sendEmail({
//              to: admin.email,
//              subject: `Lottery Completed for Group "${group.groupName}"`,
//                 text: `Hi <span class="math-inline">${admin.name},\\n\\nThe lottery draw for group "</span>${group.groupName}" has been completed.\nThe winner is ${winner.user.name}.\n\nPayout amount: $${potAmount}\nNext payment due date for all members: ${newNextPaymentDueDate.toDateString()}`,
//                 html: `<p>Hi <span class="math-inline">${admin.name},</p><p>The lottery draw for group "<strong></span>${group.groupName}</strong>" has been completed.</p><p>The winner is <strong></span>${winner.user.name}</strong>.</p><p>Payout amount: <strong>$${potAmount}</strong></p><p>Next payment due date for all members: <strong>${newNextPaymentDueDate.toDateString()}</strong></p>`,
//          }).catch(err => console.error("Failed to send admin lottery result email:", err));
//      }

//     console.log(`Lottery draw completed for group ${groupId}. Winner: ${winner.user.name}`);
// };


// module.exports = {
//     checkAndExecuteLottery,
//     // executeLotteryDraw // Export if needed externally, but usually called by checkAndExecuteLottery
// };


// const prisma = require('../utils/prisma.client');
// const { sendEmail } = require('./email.service'); // Assume sendEmail is correctly implemented
// // Import necessary helpers, including all date calculation functions needed
// const {
//     calculateNextDueDate,
//     formatDateForCycle,
//     calculateNextCycleStartDate, // Needed for executeScheduledLottery
//     calculateNextCycleStartDateBasedOnFrequency // Needed for advance payment logic reference (though used in payment service)
// } = require('../utils/helpers');

// const AppError = require('../utils/errors'); // Assume AppError is correctly implemented
// const dayjs = require('dayjs');
// const utc = require('dayjs/plugin/utc');
// dayjs.extend(utc);
// const { Prisma } = require('@prisma/client'); // Import Prisma client to use Decimal operations and Enums


// // --- Helper function to check if all active NON-ADMIN members have paid ---
// // This is crucial for the auto-scheduling trigger and manual schedule eligibility
// const areAllNonAdminMembersPaid = async (groupId, adminUserId) => {
//     // Count active members EXCLUDING the admin
//     const totalNonAdminMembers = await prisma.membership.count({
//         where: {
//             groupId: groupId,
//             isActive: true,
//             userId: { not: adminUserId }, // Exclude the admin user
//         },
//     });

//     // Count active, paid members EXCLUDING the admin
//     const paidNonAdminMembers = await prisma.membership.count({
//         where: {
//             groupId: groupId,
//             isActive: true,
//             userId: { not: adminUserId }, // Exclude the admin user
//             paymentStatusForCurrentCycle: 'PAID', // Using the string 'PAID' based on schema/previous code
//              // Assuming PaymentStatus enum maps to 'PAID' and 'UNPAID' strings if schema uses enum type
//         },
//     });

//     console.log(`Group ${groupId}: ${paidNonAdminMembers} / ${totalNonAdminMembers} non-admin members paid.`);

//     // If there are no active non-admin members, the group likely shouldn't draw or should complete.
//     // The check is only true if there's at least one non-admin member and ALL of them have paid.
//     return totalNonAdminMembers > 0 && paidNonAdminMembers === totalNonAdminMembers;
// };


// // --- Function to check payments and TRIGGER AUTO-SCHEDULE if ready ---
// // This is called by the payment service after a successful standard payment.
// // It replaces the immediate checkAndExecuteLottery logic from the old version.
// const checkAndScheduleLotteryIfReady = async (groupId) => {
//     console.log(`Checking lottery auto-schedule readiness for group ${groupId}...`);

//     // Fetch group including admin user (needed for exclusion) and current schedule status
//     const group = await prisma.group.findUnique({
//         where: { groupId },
//         include: {
//             admin: { select: { userId: true, name: true, email: true } } // Need admin userId for exclusion
//         }
//     });

//     if (!group || group.status !== 'ACTIVE') {
//         console.log(`Group ${groupId} not found or not active for scheduling check. Skipping.`);
//         return; // Not active, do nothing
//     }

//     // Check if it's already scheduled (manual or previous auto)
//     if (group.lotteryScheduledAt !== null) {
//         console.log(`Lottery already scheduled for group ${groupId} at ${dayjs(group.lotteryScheduledAt).format('YYYY-MM-DD HH:mm UTC')}. Skipping auto-schedule.`);
//         return; // Already scheduled, do nothing
//     }

//     // Check if all active NON-ADMIN members have paid using the helper
//     const allPaid = await areAllNonAdminMembersPaid(groupId, group.admin.userId);

//     if (allPaid) {
//         console.log(`All non-admin members paid for group ${groupId}. Auto-scheduling lottery...`);

//         // Auto-schedule for 2 hours from now
//         const autoScheduledTime = dayjs().utc().add(2, 'hour').toDate();

//         try {
//             // Update group with the auto-scheduled time
//             await prisma.group.update({
//                 where: { groupId },
//                 data: { lotteryScheduledAt: autoScheduledTime },
//             });

//             const scheduledTimeFormatted = dayjs(autoScheduledTime).format('YYYY-MM-DD HH:mm UTC');

//             // Fetch members to notify (exclude admin)
//             const members = await prisma.membership.findMany({
//                 where: {
//                     groupId: groupId,
//                     isActive: true,
//                     userId: { not: group.admin.userId }, // Exclude the admin
//                 },
//                 include: { user: true }, // Include user details for email
//             });

//             // Notify members about auto-schedule
//             for (const membership of members) {
//                  if (membership.user?.email) {
//                      sendEmail({
//                          to: membership.user.email,
//                          subject: `Lottery Automatically Scheduled for "${group.groupName}"`,
//                          text: `Hi ${membership.user.name},\n\nAll members have paid for group "${group.groupName}". The lottery has been automatically scheduled to draw around ${scheduledTimeFormatted}.`,
//                          html: `<p>Hi ${membership.user.name},</p><p>All members have paid for group "<strong>${group.groupName}</strong>". The lottery has been automatically scheduled to draw around <strong>${scheduledTimeFormatted}</strong>.</p>`,
//                      }).catch(err => console.error(`Failed to send auto-schedule email to ${membership.user.email}:`, err));
//                  }
//             }

//             // Notify admin about auto-schedule
//             if (group.admin?.email) {
//                  sendEmail({
//                      to: group.admin.email,
//                      subject: `Lottery Automatically Scheduled for "${group.groupName}"`,
//                      text: `Hi ${group.admin.name},\n\nAll non-admin members have paid for group "${group.groupName}". The lottery has been automatically scheduled to draw around ${scheduledTimeFormatted}. You can manually reschedule it if needed.`,
//                      html: `<p>Hi ${group.admin.name},</p><p>All non-admin members have paid for group "<strong>${group.groupName}</strong>". The lottery has been automatically scheduled to draw around <strong>${scheduledTimeFormatted}</strong>.</p><p>You can manually reschedule it if needed.</p>`,
//                  }).catch(err => console.error(`Failed to send admin auto-schedule email to ${group.admin.email}:`, err));
//             }

//             console.log(`Group ${group.groupName} (${group.groupId}) auto-scheduled lottery for ${scheduledTimeFormatted}`);

//         } catch (error) {
//             console.error(`Error auto-scheduling lottery for group ${groupId}:`, error);
//             // Log the error, but don't throw to avoid failing the payment process
//             // Maybe send an error email to admin if auto-scheduling fails?
//         }

//     } else {
//         console.log(`Group ${groupId} not ready for lottery auto-schedule. Not all non-admin members paid.`);
//         // Optional: Notify admin if due date has passed and not all paid (perhaps via a separate reminder job)
//     }
// };


// // --- Function for Manual Lottery Schedule (Admin Trigger) ---
// // This should be called by a dedicated API endpoint for the admin.
// const scheduleLotteryManually = async (groupId, adminUserId, durationInHours) => {
//     const group = await prisma.group.findUnique({ where: { groupId }, include: { admin: true } });
//     if (!group) {
//         throw new AppError("Group not found", 404);
//     }
//     // Check if the requesting user is the actual admin of this group
//     if (group.adminUserId !== adminUserId) {
//         throw new AppError("Not authorized to schedule for this group", 403);
//     }
//     if (group.status !== 'ACTIVE') {
//         throw new AppError(`Lottery can only be scheduled for active groups (current status: ${group.status.toLowerCase()})`, 400);
//     }
//     if (typeof durationInHours !== 'number' || durationInHours <= 0) {
//          throw new AppError("Invalid duration specified", 400);
//     }

//     // Check if all payments are in (REQUIRED before manual scheduling)
//     const allPaid = await areAllNonAdminMembersPaid(groupId, group.admin.userId);
//     if (!allPaid) {
//         throw new AppError("All non-admin members must pay before manually scheduling the lottery", 400);
//     }

//     // Calculate scheduled time based on admin's duration
//     const scheduledTime = dayjs().utc().add(durationInHours, 'hour').toDate();

//     // Update group with scheduled time (This will overwrite any existing auto-schedule)
//     // Using a transaction for safety, though unlikely to conflict here if check passes
//     try {
//         const updatedGroup = await prisma.$transaction(async (tx) => {
//              return tx.group.update({
//                  where: { groupId },
//                  data: {
//                      lotteryScheduledAt: scheduledTime,
//                  }
//              });
//         });


//         const scheduledTimeFormatted = dayjs(scheduledTime).format('YYYY-MM-DD HH:mm UTC');

//         // Fetch members to notify (exclude admin)
//         const members = await prisma.membership.findMany({
//             where: {
//                 groupId: groupId,
//                 isActive: true,
//                 userId: { not: group.admin.userId }, // Exclude the admin
//             },
//             include: { user: true }, // Include user details for email
//         });

//         // Notify members about manual schedule
//         for (const membership of members) {
//              if (membership.user?.email) {
//                  sendEmail({
//                      to: membership.user.email,
//                      subject: `Lottery Scheduled for "${group.groupName}"`,
//                      text: `Hi ${membership.user.name},\n\nThe lottery for group "${group.groupName}" has been manually scheduled by the admin to draw around ${scheduledTimeFormatted}.`,
//                      html: `<p>Hi ${membership.user.name},</p><p>The lottery for group "<strong>${group.groupName}</strong>" has been manually scheduled by the admin to draw around <strong>${scheduledTimeFormatted}</strong>.</p>`,
//                  }).catch(err => console.error(`Failed to send manual schedule email to ${membership.user.email}:`, err));
//              }
//         }

//         // Notify admin (confirmation)
//         if (group.admin?.email) {
//             sendEmail({
//                 to: group.admin.email,
//                 subject: `Lottery Manually Scheduled for "${group.groupName}"`,
//                 text: `Hi ${group.admin.name},\n\nYou have manually scheduled the lottery for group "${group.groupName}". The draw is set for ${scheduledTimeFormatted}.`,
//                 html: `<p>Hi ${group.admin.name},</p><p>You have manually scheduled the lottery for group "<strong>${group.groupName}</strong>". The draw is set for <strong>${scheduledTimeFormatted}</strong>.</p>`,
//             }).catch(err => console.error(`Failed to send admin manual schedule confirmation email to ${group.admin.email}:`, err));
//         }

//         console.log(`Group ${group.groupName} (${group.groupId}) manually scheduled lottery for ${scheduledTimeFormatted}`);

//         return updatedGroup; // Return updated group info

//     } catch (error) {
//         console.error(`Error manually scheduling lottery for group ${groupId}:`, error);
//          // Decide how to handle specific errors like DB errors
//         throw error; // Re-throw the error
//     }
// };


// // --- Function to EXECUTE the scheduled lottery draw (Called by Cron Job) ---
// // This function contains the actual lottery draw logic and cycle advancement.
// const executeScheduledLottery = async (groupId) => {
//     console.log(`Attempting to execute scheduled lottery for group ${groupId}...`);

//     // Fetch the group, ensure it's active and has a passed schedule time
//     // Include admin (for exclusion/notifications) and members (for draw pool/notifications)
//     const group = await prisma.group.findUnique({
//         where: { groupId },
//         include: {
//             admin: { select: { userId: true, name: true, email: true } }, // Need admin for exclusion/notifications
//             memberships: {
//                  where: { isActive: true }, // Only consider active members
//                  include: { user: true } // Include user for draw pool & notifications
//             },
//         },
//     });

//     const now = dayjs().utc();

//     // Double check conditions before proceeding
//     // We check lotteryScheduledAt here, but the cron job FINDING it implies time has passed.
//     // The crucial check is resetting lotteryScheduledAt *immediately below*.
//     if (!group || group.status !== 'ACTIVE' || !group.lotteryScheduledAt /*|| dayjs(group.lotteryScheduledAt).isAfter(now)*/ ) {
//          // The dayjs(group.lotteryScheduledAt).isAfter(now) check is generally done by the cron query,
//          // but slight clock drift or query timing could make it useful.
//          // However, the immediate reset is the primary concurrency guard.
//         console.log(`Draw conditions no longer met for group ${groupId} or already reset. Skipping execution.`);
//         return; // Exit if conditions are no longer met
//     }

//     // --- IMPORTANT CONCURRENCY FIX ---
//     // Immediately reset lotteryScheduledAt to null *before* executing the draw logic.
//     // This prevents another cron instance picking up the same group if this one takes time.
//     try {
//         await prisma.group.update({
//             where: { groupId: group.groupId },
//             data: { lotteryScheduledAt: null }, // Mark as unscheduled immediately
//         });
//         console.log(`Reset lotteryScheduledAt for group ${groupId} before draw execution.`);
//     } catch (resetError) {
//         console.error(`Failed to reset lotteryScheduledAt for group ${groupId} before draw. Could lead to double draw? Error:`, resetError);
//         // Decide how to handle - maybe abort this draw attempt? For now, log and continue.
//         // More robust systems might use database-level locking or a processing status flag.
//     }


//     // Identify eligible winners (active, NON-ADMIN, haven't won yet)
//     const eligibleMemberships = group.memberships.filter(
//         m => m.userId !== group.admin.userId && !m.hasWonLottery
//     );

//     // If no eligible members left to win
//     if (eligibleMemberships.length === 0) {
//         console.log(`No eligible members left to win in group ${groupId}. Completing group.`);
//          // All members who needed to win have won. Mark group as completed.
//          await prisma.group.update({
//             where: { groupId: group.groupId },
//             data: { status: 'COMPLETED' }, // Assuming COMPLETED is an enum value
//          }).catch(err => console.error(`Failed to set group ${groupId} to COMPLETED:`, err)); // Log update failure

//          // Notify everyone that the group is completed
//          const allMembers = group.memberships; // All active members currently
//          const admin = group.admin;

//          const completionSubject = `Group "${group.groupName}" Completed`;
//          const completionText = `Hi,\n\nThe group "${group.groupName}" has successfully completed its cycle as all eligible members have received the pot.\n\nThank you for your participation/management!`;
//          const completionHtml = `<p>Hi,</p><p>The group "<strong>${group.groupName}</strong>" has successfully completed its cycle as all eligible members have received the pot.</p><p>Thank you for your participation/management!</p>`;

//          if (admin?.email) {
//               sendEmail({ to: admin.email, subject: completionSubject, text: completionText, html: completionHtml }).catch(err => console.error("Failed to send admin group completion email:", err));
//          }
//          for(const m of allMembers) {
//              if (m.user?.email && m.userId !== group.admin.userId) { // Send only to non-admin members
//                  sendEmail({ to: m.user.email, subject: completionSubject, text: completionText, html: completionHtml }).catch(err => console.error(`Failed to send member group completion email to ${m.user.email}:`, err));
//              }
//          }

//         return; // Stop execution for this group
//     }

//     // Select a random winner from eligible members
//     const winnerIndex = Math.floor(Math.random() * eligibleMemberships.length);
//     const winningMembership = eligibleMemberships[winnerIndex];
//     const winningUser = winningMembership.user; // The actual User object

//     // Calculate pot amount (based on the count of active NON-ADMIN members who were expected to pay this cycle)
//     const activeNonAdminMemberCount = group.memberships.filter(m => m.userId !== group.admin.userId && m.isActive).length; // Recalculate based on current active members
//     // Ensure group.contributionAmount is treated as Decimal for multiplication
//     const potAmount = new Prisma.Decimal(String(group.contributionAmount)).mul(activeNonAdminMemberCount); // Use Decimal arithmetic, convert Float/Number to String first


//     // Prepare for next cycle (dates)
//     const lotteryDate = now.toDate(); // Use the actual draw time
//     // Calculate the start date of the *next* cycle based on the lottery draw date using the helper
//     const nextCycleStartDate = calculateNextCycleStartDate(lotteryDate); // Assumes calculateNextCycleStartDate helper exists

//     // Calculate the next payment due date for the *next* cycle using the helper
//     const newNextPaymentDueDate = calculateNextDueDate(nextCycleStartDate, group.frequency); // Assumes calculateNextDueDate helper exists

//     // Use the CURRENT cycle's start date for the cycle identifier of the finished cycle
//     const finishedCycleIdentifier = group.currentCycleStartDate ? formatDateForCycle(group.currentCycleStartDate) : 'N/A';


//     // --- Perform database updates in a transaction ---
//     try {
//         await prisma.$transaction(async (tx) => {
//             // 1. Update winner's membership status
//             await tx.membership.update({
//                 where: { membershipId: winningMembership.membershipId },
//                 data: { hasWonLottery: true },
//             });

//             // 2. Create Lottery record for the *finished* cycle
//             await tx.lottery.create({
//                 data: {
//                     groupId: group.groupId,
//                     cycleIdentifier: finishedCycleIdentifier, // Link to the finished cycle
//                     winningUserId: winningUser.userId,
//                     potAmount: potAmount, // Use the calculated Decimal amount
//                     lotteryDate: lotteryDate,
//                 },
//             });

//             // 3. Update Group with next cycle dates
//             // lotteryScheduledAt was already reset outside the transaction
//              await tx.group.update({
//                 where: { groupId: group.groupId },
//                 data: {
//                     currentCycleStartDate: nextCycleStartDate, // Set the new cycle's start date
//                     nextPaymentDueDate: newNextPaymentDueDate, // Set the new cycle's first payment due date
//                 },
//             });


//             // 4. Reset payment status for ALL active NON-ADMIN members for the NEW cycle
//             const activeNonAdminMemberIds = group.memberships
//                 .filter(m => m.userId !== group.admin.userId && m.isActive) // Filter again for safety
//                 .map(m => m.membershipId);

//             if (activeNonAdminMemberIds.length > 0) {
//                  await tx.membership.updateMany({
//                     where: {
//                         membershipId: { in: activeNonAdminMemberIds },
//                     },
//                     data: {
//                         paymentStatusForCurrentCycle: 'UNPAID', // Reset status
//                         lastPaymentDate: null, // Reset last payment date for the new cycle
//                     },
//                 });
//             }
//              console.log(`Group ${group.groupName} (${group.groupId}) advanced to next cycle and reset payments.`);

//         }); // End transaction

//          console.log(`Lottery successfully drawn for group: ${groupId}. Winner: ${winningUser.name}`);

//         // --- Send Notifications (outside transaction) ---
//         const lotteryDateFormatted = dayjs(lotteryDate).format('YYYY-MM-DD HH:mm UTC');
//         const nextDueDateFormatted = dayjs(newNextPaymentDueDate).format('YYYY-MM-DD'); // Format for email

//         // Notify Winner
//         if (winningUser?.email) {
//              sendEmail({
//                  to: winningUser.email,
//                  subject: `Congratulations! You Won the Lottery for Group "${group.groupName}"!`,
//                  text: `Hi ${winningUser.name},\n\nCongratulations! You have won the lottery draw for group "${group.groupName}" drawn on ${lotteryDateFormatted}.\nThe pot amount is $${potAmount.toFixed(2)}.\n\nRemember, you must continue contributing until all eligible members have received the pot. Your next contribution of $${group.contributionAmount.toFixed(2)} is due by ${nextDueDateFormatted}.`,
//                  html: `<p>Hi ${winningUser.name},</p><p>Congratulations! You have won the lottery draw for group "<strong>${group.groupName}</strong>" drawn on ${lotteryDateFormatted}.</p><p>The pot amount is <strong>$${potAmount.toFixed(2)}</strong>.</p><p>Remember, you must continue contributing until all eligible members have received the pot. Your next contribution of <strong>$${group.contributionAmount.toFixed(2)}</strong> is due by <strong>${nextDueDateFormatted}</strong>.</p>`,
//              }).catch(err => console.error(`Failed to send lottery winner email to ${winningUser.email}:`, err));
//         }


//         // Notify Other Members (active, non-admin, non-winner)
//         const otherMembers = group.memberships.filter(
//             m => m.userId !== winningUser.userId && m.userId !== group.admin.userId && m.isActive
//         );
//         for (const member of otherMembers) {
//              if (member.user?.email) {
//                  sendEmail({
//                      to: member.user.email,
//                      subject: `Lottery Results for Group "${group.groupName}"`,
//                      text: `Hi ${member.user.name},\n\nThe lottery draw for group "${group.groupName}" drawn on ${lotteryDateFormatted} has been completed.\nThe winner is ${winningUser.name}.\n\nYour next contribution of $${group.contributionAmount.toFixed(2)} is due by ${nextDueDateFormatted}.`,
//                      html: `<p>Hi ${member.user.name},</p><p>The lottery draw for group "<strong>${group.groupName}</strong>" drawn on ${lotteryDateFormatted} has been completed.</p><p>The winner is <strong>${winningUser.name}</strong>.</p><p>Your next contribution of <strong>$${group.contributionAmount.toFixed(2)}</strong> is due by <strong>${nextDueDateFormatted}</strong>.</p>`,
//                  }).catch(err => console.error(`Failed to send lottery result email to ${member.user.email}:`, err));
//              }
//         }

//         // Notify Admin
//         if (group.admin?.email) {
//              // Recalculate counts based on current state after transaction for accurate email
//              const updatedMemberships = await prisma.membership.findMany({
//                  where: { groupId: groupId, isActive: true },
//                  select: { hasWonLottery: true, userId: true } // Select only needed fields
//              });
//              const totalActiveNonAdmin = updatedMemberships.filter(m => m.userId !== group.admin.userId).length;
//              const winnersCount = updatedMemberships.filter(m => m.hasWonLottery).length;
//              const remainingEligible = totalActiveNonAdmin - winnersCount;


//              sendEmail({
//                  to: group.admin.email,
//                  subject: `Lottery Completed for Group "${group.groupName}"`,
//                  text: `Hi ${group.admin.name},\n\nThe lottery for group "${group.groupName}" (drawn on ${lotteryDateFormatted}) has been completed.\nThe winner is ${winningUser.name} (${winningUser.email}).\n\nPayout amount: $${potAmount.toFixed(2)}.\n\nThe group has advanced to the next cycle. Next payment due date for members: ${nextDueDateFormatted}.\n\nTotal active non-admin members: ${totalActiveNonAdmin}\nMembers who have won: ${winnersCount}\nRemaining members eligible to win: ${remainingEligible}`,
//                  html: `<p>Hi ${group.admin.name},</p><p>The lottery for group "<strong>${group.groupName}</strong>" (drawn on ${lotteryDateFormatted}) has been completed.</p><p>The winner is <strong>${winningUser.name}</strong> (<a href="mailto:${winningUser.email}">${winningUser.email}</a>).</p><p>Payout amount: <strong>$${potAmount.toFixed(2)}</strong>.</p><p>The group has advanced to the next cycle. Next payment due date for members: <strong>${nextDueDateFormatted}</strong>.</p><p>Total active non-admin members: ${totalActiveNonAdmin}</p><p>Members who have won: ${winnersCount}</p><p>Remaining members eligible to win: ${remainingEligible}</p>`,
//              }).catch(err => console.error(`Failed to send admin lottery result email to ${group.admin.email}:`, err));
//         }


//     } catch (error) {
//         console.error(`CRITICAL ERROR executing lottery for group ${groupId}:`, error);
//         // If the transaction fails, lotteryScheduledAt remains null (because we reset it FIRST)
//         // This group will be picked up again by the cron job in the next run, potentially causing issues.
//         // Need robust error logging and monitoring here. Notify admin of critical failure immediately.
//          if (group?.admin?.email) {
//               sendEmail({
//                   to: group.admin.email,
//                   subject: `CRITICAL ERROR: Lottery Execution Failed for "${group.groupName}"`,
//                   text: `Hi ${group.admin.name},\n\nA critical error occurred during the lottery draw for group "${group.groupName}". The draw may not have completed successfully.\n\nError details: ${error.message}\n\nManual intervention may be required. Please check system logs immediately.`,
//                   html: `<p>Hi ${group.admin.name},</p><p>A <strong>critical error</strong> occurred during the lottery draw for group "<strong>${group.groupName}</strong>". The draw may not have completed successfully.</p><p>Error details: <strong>${error.message}</strong></p><p>Manual intervention may be required. Please check system logs immediately.</p>`,
//               }).catch(err => console.error("Failed to send admin critical lottery error email:", err));
//          }
//         // Re-throw the error so the cron job runner can potentially log/handle it
//         throw error;
//     }
// };


// // --- Exported functions ---
// module.exports = {
//     // Renamed the old checkAndExecuteLottery to reflect its new role
//     checkAndScheduleLotteryIfReady, // Called by payment service

//     // Added manual scheduling function
//     scheduleLotteryManually,        // Called by a manual schedule endpoint

//     // This function is now the main entry point for the cron job
//     executeScheduledLottery,        // Called by the cron job

//     // Export the helper if needed elsewhere, otherwise keep it private
//     // areAllNonAdminMembersPaid,
// };
















// const prisma = require('../utils/prisma.client');
// const { sendEmail } = require('./email.service');
// const { calculateNextDueDate, formatDateForCycle } = require('../utils/helpers');
// const AppError = require('../utils/errors');

// // This function checks if all members paid and triggers the lottery execution
// const checkAndExecuteLottery = async (groupId) => {
//     console.log(`Checking lottery readiness for group ${groupId}...`);
//     const group = await prisma.group.findUnique({
//         where: { groupId },
//         include: {
//             memberships: {
//                 where: { isActive: true }, // Only consider active members
//                 include: { user: { select: { name: true, email: true } } } // Include user for notifications
//             },
//             admin: { select: { name: true, email: true } } // Include admin for notifications
//         }
//     });

//     if (!group || group.status !== 'ACTIVE') {
//         console.log(`Group ${groupId} not found or not active. Skipping lottery check.`);
//         return; // Not active, do nothing
//     }

//     const activeMembers = group.memberships;
//     if (activeMembers.length === 0) {
//         console.log(`Group ${groupId} has no active members. Skipping lottery.`);
//         return;
//     }


//     //get the current cycle start date. then check all invited member or maximummembers paid for that cycle or not. if paid for current cycle then start the loattery draw. if a group contain 6 members and 3 paid for current cycle then lottery draw will not start. if all 6 paid then lottery draw will start. and 1/6 winner will be selected. then update group current to next cycle date from group table. and update next payment due date for next cycle. and update all members payment status to unpaid for next cycle. and update the group status to completed if all members paid for current cycle. whaen all memeber receive payment   then set group as completed. and send email to all members and admin about the lottery draw result. 6 member means 6 lotary draw
//     // and 1/6 winner will be selected. and update group current to next cycle date from group table. and update next payment due date for next cycle. and update all members payment status to unpaid for next cycle. and update the group status to completed if all members paid for current cycle. whaen all memeber receive payment   then set group as completed. and send email to all members and admin about the lottery draw result.



//     const allPaid = activeMembers.every(m => m.paymentStatusForCurrentCycle === 'PAID');

//     if (allPaid) {
//         console.log(`All members paid for group ${groupId}. Executing lottery draw...`);

//         // Send "Ready for Lottery" email to admin *before* executing
//         if (group.admin) {
//             sendEmail({
//                 to: group.admin.email,
//                 subject: `All Payments Received for "${group.groupName}" - Lottery Starting!`,
//                 text: `Hi ${group.admin.name},\n\nAll members in group "${group.groupName}" have paid their contribution for the current cycle (ending ${group.nextPaymentDueDate ? group.nextPaymentDueDate.toDateString() : 'N/A'}).\nThe lottery draw will now proceed automatically.\n\nYou will receive another email with the results shortly.`,
//                 html: `<p>Hi ${group.admin.name},</p><p>All members in group "<strong>${group.groupName}</strong>" have paid their contribution for the current cycle (ending ${group.nextPaymentDueDate ? group.nextPaymentDueDate.toDateString() : 'N/A'}).</p><p><strong>The lottery draw will now proceed automatically.</strong></p><p>You will receive another email with the results shortly.</p>`,
//             }).catch(err => console.error("Failed to send admin lottery ready email:", err));
//         }

//         try {
//             await executeLotteryDraw(groupId, group, activeMembers); // Pass fetched data to avoid re-query
//         } catch (error) {
//             console.error(`Error executing lottery for group ${groupId}:`, error);
//             // Notify admin about the failure
//             if (group.admin) {
//                 sendEmail({
//                     to: group.admin.email,
//                     subject: `ERROR: Lottery Failed for Group "${group.groupName}"`,
//                     text: `Hi ${group.admin.name},\n\nAn error occurred while executing the lottery for group "${group.groupName}".\n\nError details: ${error.message}\n\nPlease check the system logs for more information.`,
//                     html: `<p>Hi ${group.admin.name},</p><p>An error occurred while executing the lottery for group "<strong>${group.groupName}</strong>".</p><p>Error details: <strong>${error.message}</strong></p><p>Please check the system logs for more information.</p>`,
//                 }).catch(err => console.error("Failed to send admin lottery failure email:", err));
//             }
//         }
//     } else {
//         console.log(`Group ${groupId} not ready for lottery. Not all members have paid.`);
//     }
// };

// // This function performs the actual lottery draw and cycle advancement
// const executeLotteryDraw = async (groupId, groupData, activeMembersData) => {
//     const group = groupData || await prisma.group.findUnique({ where: { groupId } });
//     if (!group || group.status !== 'ACTIVE') {
//         throw new AppError(`Cannot draw lottery: Group ${groupId} not found or not active.`, 400);
//     }

//     const activeMembers = activeMembersData || await prisma.membership.findMany({
//         where: { groupId, isActive: true },
//         include: { user: { select: { userId: true, name: true, email: true } } }
//     });

//     const eligibleMembers = activeMembers.filter(m => !m.hasWonLottery);

//     if (eligibleMembers.length === 0) {
//         console.log(`No eligible members left to win in group ${groupId}. Completing group.`);
//         await prisma.group.update({
//             where: { groupId },
//             data: { status: 'COMPLETED' },
//         });

//         // Notify admin and members about group completion
//         const admin = await prisma.user.findUnique({ where: { userId: group.adminUserId }, select: { email: true, name: true } });
//         if (admin) {
//             sendEmail({
//                 to: admin.email,
//                 subject: `Group "${group.groupName}" Completed!`,
//                 text: `Hi ${admin.name},\n\nThe ROSCA group "${group.groupName}" has successfully completed its cycle, and all members have received their payout.\n\nThank you for your management!`,
//                 html: `<p>Hi ${admin.name},</p><p>The ROSCA group "<strong>${group.groupName}</strong>" has successfully completed its cycle, and all members have received their payout.</p><p>Thank you for your management!</p>`,
//             }).catch(err => console.error("Failed to send admin group completion email:", err));
//         }

//         activeMembers.forEach(member => {
//             if (member.user?.email) {
//                 sendEmail({
//                     to: member.user.email,
//                     subject: `Group "${group.groupName}" has Completed!`,
//                     text: `Hi ${member.user.name},\n\nThe ROSCA group "${group.groupName}" has successfully completed its cycle, and all members have received their payout.\n\nThank you for your participation!`,
//                     html: `<p>Hi ${member.user.name},</p><p>The ROSCA group "<strong>${group.groupName}</strong>" has successfully completed its cycle, and all members have received their payout.</p><p>Thank you for your participation!</p>`,
//                 }).catch(err => console.error(`Failed to send member group completion email to ${member.user.email}:`, err));
//             }
//         });

//         return; // Stop execution for this group
//     }

//     const winnerIndex = Math.floor(Math.random() * eligibleMembers.length);
//     const winner = eligibleMembers[winnerIndex];

//     const potAmount = group.contributionAmount * activeMembers.length; // Based on active members this cycle

//     const cycleIdentifier = formatDateForCycle(group.currentCycleStartDate); // Cycle that just finished
//     const lotteryDate = new Date();

//     // Set currentCycleStartDate to nextPaymentDueDate
//     const newCurrentCycleStartDate = group.nextPaymentDueDate ? new Date(group.nextPaymentDueDate) : new Date();
//     newCurrentCycleStartDate.setHours(0, 0, 0, 0); // Set to midnight of the next payment due date

//     // Recalculate the next payment due date
//     const newNextPaymentDueDate = calculateNextDueDate(newCurrentCycleStartDate, group.frequency);

//     await prisma.$transaction(async (tx) => {
//         await tx.membership.update({
//             where: { membershipId: winner.membershipId },
//             data: { hasWonLottery: true },
//         });

//         await tx.lottery.create({
//             data: {
//                 groupId,
//                 cycleIdentifier,
//                 winningUserId: winner.userId,
//                 potAmount,
//                 lotteryDate,
//             },
//         });

//         await tx.group.update({
//             where: { groupId },
//             data: {
//                 currentCycleStartDate: newCurrentCycleStartDate,
//                 nextPaymentDueDate: newNextPaymentDueDate,
//             },
//         });

//         // Reset payment status for ALL active members for the NEW cycle, but only non-winners
//         const activeMemberIds = activeMembers.map(m => m.membershipId);
//         await tx.membership.updateMany({
//             where: {
//                 membershipId: { in: activeMemberIds },
//                 hasWonLottery: false, // Reset only non-winners
//             },
//             data: { paymentStatusForCurrentCycle: 'UNPAID' },
//         });
//     });

//     // Send email notifications to winner and other members
//     if (winner.user?.email) {
//         sendEmail({
//             to: winner.user.email,
//             subject: `Congratulations! You Won the Lottery for Group "${group.groupName}"!`,
//             text: `Hi ${winner.user.name},\n\nCongratulations! You have won the lottery for group "${group.groupName}" (cycle ending ${cycleIdentifier}).\n\nYou will receive a payout of $${potAmount}.\n\nYour next contribution of $${group.contributionAmount} is due by ${newNextPaymentDueDate.toDateString()}.`,
//             html: `<p>Hi ${winner.user.name},</p><p>Congratulations! You have won the lottery for group "<strong>${group.groupName}</strong>" (cycle ending ${cycleIdentifier}).</p><p>You will receive a payout of <strong>$${potAmount}</strong>.</p><p>Your next contribution of <strong>$${group.contributionAmount}</strong> is due by <strong>${newNextPaymentDueDate.toDateString()}</strong>.</p>`,
//         }).catch(err => console.error(`Failed to send lottery winner email to ${winner.user.email}:`, err));
//     }

//     const otherMembers = activeMembers.filter(m => m.userId !== winner.userId);
//     otherMembers.forEach(member => {
//         if (member.user?.email) {
//             sendEmail({
//                 to: member.user.email,
//                 subject: `Lottery Results for Group "${group.groupName}"`,
//                 text: `Hi ${member.user.name},\n\nThe lottery draw for group "${group.groupName}" for the cycle ending ${cycleIdentifier} has been completed.\nThe winner is ${winner.user.name}.\n\nYour next contribution of $${group.contributionAmount} is due by ${newNextPaymentDueDate.toDateString()}.`,
//                 html: `<p>Hi ${member.user.name},</p><p>The lottery draw for group "<strong>${group.groupName}</strong>" for the cycle ending ${cycleIdentifier} has been completed.</p><p>The winner is <strong>${winner.user.name}</strong>.</p><p>Your next contribution of <strong>$${group.contributionAmount}</strong> is due by <strong>${newNextPaymentDueDate.toDateString()}</strong>.</p>`,
//             }).catch(err => console.error(`Failed to send lottery result email to ${member.user.email}:`, err));
//         }
//     });

//     const admin = await prisma.user.findUnique({ where: { userId: group.adminUserId }, select: { email: true, name: true } });
//     if (admin) {
//         sendEmail({
//             to: admin.email,
//             subject: `Lottery Completed for Group "${group.groupName}"`,
//             text: `Hi ${admin.name},\n\nThe lottery draw for group "${group.groupName}" has been completed.\nThe winner is ${winner.user.name}.\n\nPayout amount: $${potAmount}\nNext payment due date for all members: ${newNextPaymentDueDate.toDateString()}`,
//             html: `<p>Hi ${admin.name},</p><p>The lottery draw for group "<strong>${group.groupName}</strong>" has been completed.</p><p>The winner is <strong>${winner.user.name}</strong>.</p><p>Payout amount: <strong>$${potAmount}</strong></p><p>Next payment due date for all members: <strong>${newNextPaymentDueDate.toDateString()}</strong></p>`,
//         }).catch(err => console.error("Failed to send admin lottery result email:", err));
//     }

//     console.log(`Lottery draw completed for group ${groupId}. Winner: ${winner.user.name}`);
// };

// module.exports = {
//     checkAndExecuteLottery,
//     executeLotteryDraw,
// };



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

    // Get cycleIdentifier from payment table for the group
    // const payments = await prisma.payment.findMany({
    //     where: {
    //         groupId,
    //     },
    //     select: {
    //         cycleIdentifier: true,
    //     },
    // });

    // const cycleIdentifier = payments.cycleIdentifier; // Assume the first payment cycleIdentifier is correct
    // if (!cycleIdentifier) {
    //     throw new AppError("Cycle identifier not found for group.", 400);
    // }

    // Find the total sum of `cyclePaymentCount` for all members for the same cycleIdentifier from the Membership model

    // Find the nextPaymentDueDate for the group

    // let cycleDate;  // Declare cycleDate outside of condition
    // console.log(group.memberships);

    // if (group.memberships[0].cyclePaymentCount == 0) {
    //     // If no payments found, set cycleDate to the current date
    //     cycleDate = group.currentCycleStartDate.toISOString().split('T')[0];
    
    //     console.log(`Cycle date set to current date: ${cycleDate}`);
    
    // } else {
    //     const findCycle = await prisma.membership.findMany({
    //         where: {
    //             groupId,
    //         },
    //         select: {
    //             nextPaymentDueDate: true,
    //         },
    //     });
    
    //     // Check if nextPaymentDueDate is available and set cycleDate
    //     cycleDate = findCycle[0]?.nextPaymentDueDate?.toISOString().split('T')[0]; // Convert to string and get the date part
    // }
    
    // if (!cycleDate) {
    //     throw new AppError("No valid nextPaymentDueDate found in the cycle.", 400);
    // }
    
    // console.log(cycleDate); // Log the cycle date
    
   //wait 5 seconds to get the cycle date from the payment table
//     await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for 5 seconds
//     const cycleDate = group.memberships[0].cyclePaymentCount === 0
//     ? group.currentCycleStartDate.toISOString().split('T')[0]
//     : (await prisma.payment.findMany({
//         where: { groupId },
//         select: { cycleIdentifier: true },
//     })).map(payment => payment.cycleIdentifier)[0];

// if (!cycleDate) {
//     throw new AppError("No valid nextPaymentDueDate found in the cycle.", 400);
// }
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
    if (winner.user?.email) {
        sendEmail({
            to: winner.user.email,
            subject: `Congratulations! You Won the Lottery for Group "${group.groupName}"!`,
            text: `Hi ${winner.user.name},\n\nCongratulations! You have won the lottery for group "${group.groupName}" (cycle ending ${group.currentCycleStartDate}).\n\nYou will receive a payout of $${potAmount}.\n\nYour next contribution of $${group.contributionAmount} is due by ${nextPaymentDueDate.toDateString()}.`,
            html: `<p>Hi ${winner.user.name},</p><p>Congratulations! You have won the lottery for group "<strong>${group.groupName}</strong>" (cycle ending ${group.currentCycleStartDate}).</p><p>You will receive a payout of <strong>$${potAmount}</strong>.</p><p>Your next contribution of <strong>$${group.contributionAmount}</strong> is due by <strong>${nextPaymentDueDate.toDateString()}</strong>.</p>`,
        }).catch(err => console.error(`Failed to send lottery winner email to ${winner.user.email}:`, err));
    }

    // Notify Other Members
    const otherMembers = group.memberships.filter(m => m.userId !== winner.userId && m.userId !== group.adminUserId);
    for (const member of otherMembers) {
        if (member.user?.email) {
            sendEmail({
                to: member.user.email,
                subject: `Lottery Results for Group "${group.groupName}"`,
                text: `Hi ${member.user.name},\n\nThe lottery draw for group "${group.groupName}" has been completed.\nThe winner is ${winner.user.name}.\n\nYour next contribution of $${group.contributionAmount} is due by ${nextPaymentDueDate.toDateString()}.`,
                html: `<p>Hi ${member.user.name},</p><p>The lottery draw for group "<strong>${group.groupName}</strong>" has been completed.</p><p>The winner is <strong>${winner.user.name}</strong>.</p><p>Your next contribution of <strong>$${group.contributionAmount}</strong> is due by <strong>${nextPaymentDueDate.toDateString()}</strong>.</p>`,
            }).catch(err => console.error(`Failed to send lottery result email to ${member.user.email}:`, err));
        }
    }
};

module.exports = {
    checkAndExecuteLottery,
    executeLotteryDraw,
};
