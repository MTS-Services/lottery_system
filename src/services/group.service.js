const prisma = require('../utils/prisma.client');
const { sendEmail } = require('./email.service');
const { calculateNextDueDate } = require('../utils/helpers');
const AppError = require('../utils/errors');

const createGroup = async (groupData) => {
    const { adminUserId, groupName, contributionAmount, frequency, maxMembers, description } = groupData;

  
    const admin = await prisma.user.findUnique({ where: { userId: adminUserId } });
    if (!admin || admin.role !== 'ADMIN') {
        throw new AppError('User not authorized or not found', 403); 
    }
 

    if (!groupName || !contributionAmount || !frequency || !maxMembers) {
         throw new AppError('Missing required group fields', 400);
    }
    if (!['WEEKLY', 'BI_WEEKLY', 'MONTHLY'].includes(frequency.toUpperCase())) {
        throw new AppError('Invalid frequency specified', 400);
    }

    const newGroup = await prisma.group.create({
        data: {
            groupName,
            contributionAmount: parseFloat(contributionAmount),
            frequency: frequency.toUpperCase(),
            maxMembers: parseInt(maxMembers, 10),
            description,
            adminUserId, // Link to the admin
            status: 'PENDING', // Start as PENDING, activate separately
        },
    });

    // Send notification to Admin
    sendEmail({
        to: admin.email,
        subject: `Group "${newGroup.groupName}" Created Successfully!`,
        text: `Hi <span class="math-inline">${admin.name},\\n\\nYou have successfully created the group "</span>${newGroup.groupName}".\nDetails:\n - Amount: $${newGroup.contributionAmount}\n - Frequency: ${newGroup.frequency}\n - Max Members: ${newGroup.maxMembers}\n\nYou can now start inviting members and activate the group when ready.\n\nGroup ID: ${newGroup.groupId}`,
        html: `<p>Hi <span class="math-inline">${admin.name},</p><p>You have successfully created the group "<strong>${newGroup.groupName}</strong>".</p><p><strong>Details:</strong></p><ul><li>Amount: $${newGroup.contributionAmount}</li><li>Frequency: ${newGroup.frequency}</li><li>Max Members: ${newGroup.maxMembers}</li></ul><p>You can now start inviting members and activate the group when ready.</p><p>Group ID: ${newGroup.groupId}</p>`,
    }).catch(err => console.error("Failed to send group creation email:", err));

    return newGroup;
};

const activateGroup = async (groupId, adminUserId) => {
     // --- SECURITY WARNING --- (Verify admin ownership)
    const group = await prisma.group.findFirst({
        where: { groupId, adminUserId },
        include: { memberships: true } // Check if members exist
    });

    if (!group) {
        throw new AppError('Group not found or user not authorized to activate', 404);
    }
    if (group.status !== 'PENDING') {
        throw new AppError(`Group is already ${group.status.toLowerCase()}`, 400);
    }
     
    //count membership of that group and change maxmimum mamber to recent member count
    const activeMembersCount = await prisma.membership.count({
        where: { groupId, isActive: true },
        _count:{
            user: true
        }
    });
    if (activeMembersCount === 0) {
        throw new AppError('Cannot activate group with no active members', 400);
    }
    if (activeMembersCount > group.maxMembers) {
        await prisma.group.update({
            where: { groupId },
            data: { maxMembers: activeMembersCount },
        });
    }

    const now = new Date();
    const nextDueDate = calculateNextDueDate(now, group.frequency);
   // const nextPaymentDueDate = calculateNextDueDate(nextDueDate, group.frequency);

    const updatedGroup = await prisma.group.update({
        where: { groupId },
        data: {
            status: 'ACTIVE',
            currentCycleStartDate: nextDueDate,
        },
    });
    //find members email of user from groupId
    const members = await prisma.membership.findMany({
        where: { groupId, isActive: true },
        include: { user:true },
    });
    // Optional: Notify admin/members about activation?
    // ... email logic ...

    const admin = await prisma.user.findUnique({ where: { userId: adminUserId }, select: { email: true, name: true } });
    if (admin) {
        sendEmail({
            to: admin.email,
            subject: `Group "${updatedGroup.groupName}" Activated Successfully!`,
            text: `Hi ${admin.name},\n\nThe group "${updatedGroup.groupName}" has been successfully activated.\n\nNext payment due date: ${updatedGroup.currentCycleStartDate}\n\nBest regards,\nAyuuto Savings App Team`,
            html: `<p>Hi ${admin.name},</p><p>The group "<strong>${updatedGroup.groupName}</strong>" has been successfully activated.</p><p>Next payment due date: <strong>${updatedGroup.currentCycleStartDate}</strong></p><p>Best regards,<br>Ayuuto Savings App Team</p>`,
        }).catch(err => console.error("Failed to send group activation email:", err));
    }

    // Optional: Notify all members about activati
    for (const member of members) {

   
      
        sendEmail({
         
            to: member.user.email,
            subject: `Group "${updatedGroup.groupName}" Activated!`,

            text: `Hi ${member.user.name},\n\nThe group "${updatedGroup.groupName}" has been activated.\n\nNext payment due date: ${updatedGroup.currentCycleStartDate}\n\nBest regards,\nAyuuto Savings App Team`,
            html: `<p>Hi ${member.user.name},</p><p>The group "<strong>${updatedGroup.groupName}</strong>" has been activated.</p><p>Next payment due date: <strong>${updatedGroup.currentCycleStartDate}</strong></p><p>Best regards,<br>Ayuuto Savings App Team</p>`,
        }).catch(err => console.error(`Failed to send activation email to ${member.user.email}:`, err));
    }

    return updatedGroup;
};

const getGroupById = async (groupId) => {
    const group = await prisma.group.findUnique({
        where: { groupId },
        include: {
            admin: { select: { userId: true, name: true, email: true } }, // Include admin details
            memberships: { // Include member count and details (optional)
                where: { isActive: true },
                select: { userId: true, user: { select: { name: true, email: true } }, hasWonLottery: true, cyclePaymentCount: true },
            },
            // invitations: { where: { status: 'PENDING' } } // Include pending invites count (optional)
        }
     });
    if (!group) {
        throw new AppError('Group not found', 404);
    }
    return group;
};

const getGroupDetailsForInvite = async (groupId) => {
     const group = await prisma.group.findUnique({
         where: { groupId },
         select: {
             groupId: true,
             groupName: true,
             contributionAmount: true,
             frequency: true,
             description: true,
             admin: { select: { userId: true, name: true, email: true } },
             maxMembers: true,
             _count: { // Get counts directly
                select: {
                    memberships: { where: { isActive: true } },
                    invitations: { where: { status: 'PENDING' } }
                }
            }
         }
     });
      if (!group) {
         throw new AppError('Group not found for invite details', 404);
     }
     return group;
};



// const getGroupDetails = async (groupId, userId) => {
//     // Fetch group details including active memberships and admin details
//     const group = await prisma.group.findUnique({
//         where: { groupId },
//         include: {
//             admin: { select: { userId: true, name: true, email: true } }, // Admin details
//             memberships: { // Active members' details
//                 where: { groupId: groupId },
//                 select: { 
//                     userId: true,
//                     hasWonLottery: true, 
//                     cyclePaymentCount: true, 
//                     nextPaymentDueDate: true,
//                     user: { select: { name: true, email: true } } 
//                 },
//             },
//             lotteries: { // Get recent lottery winner
//                 take: 1,
//                 orderBy: { lotteryDate: 'desc' },
//                 select: { winningUserId: true },
//             }
//         },
//     });

//     // Check if the group exists
//     if (!group) {
//         throw new AppError('Group not found', 404);
//     }

//     // Total active members
//     const totalMembers = group.memberships.length;

//     // Determine the cycle date
//     let cycleDate = group.currentCycleStartDate ? group.currentCycleStartDate.toISOString().split('T')[0] : null; // Default to current cycle start date

//     // Check if any member has a next payment due date (i.e., a member has won the lottery)
//     const membersWithLotteryWins = group.memberships.filter(member => member.hasWonLottery);
//     if (membersWithLotteryWins.length > 0) {
//         // If any member has won the lottery, use their nextPaymentDueDate
//         cycleDate = membersWithLotteryWins[0].nextPaymentDueDate?.toISOString().split('T')[0] || cycleDate;
//     }

//     // Round: cyclePaymentCount/maxMembers
//     const roundInfo = group.memberships.map(member => `${member.cyclePaymentCount}/${group.maxMembers}`);

//     // Check if all round values are the same
//     const uniqueRoundInfo = [...new Set(roundInfo)].length === 1 ? roundInfo[0] : roundInfo;

//     // Group contribution amount
//     const contributionAmount = group.contributionAmount;

//     // Determine if the group is completed (check if all members have paid the maximum)
//     const allMembersPaid = group.memberships.every(member => member.cyclePaymentCount >= group.maxMembers);
//     const groupStatus = allMembersPaid ? 'COMPLETED' : group.status;

//     // Get the most recent winner's name if the group is completed
//     const recentWinner = groupStatus === 'COMPLETED' && group.lotteries.length > 0 
//         ? group.lotteries[0].winningUserId // Get the most recent winner's userId
//         : null;

//     const winnerName = recentWinner ? (await prisma.user.findUnique({ where: { userId: recentWinner } })).name : null;

//     // Return group details along with the memberships data if the group is not completed
//     return {
//         groupId: group.groupId,
//         groupName: group.groupName,
//         status: groupStatus,
//         totalMembers,
//         cycleDate,
//         uniqueRoundInfo,
//         contributionAmount,
//         admin: group.admin,
//         maxMembers: group.maxMembers,
//         description: group.description,
//         // Only include member data if the group is NOT completed
//         members: groupStatus !== 'COMPLETED' ? group.memberships.map(member => ({
//             userId: member.userId,
//             name: member.user.name,
//             email: member.user.email,
//             cyclePaymentCount: member.cyclePaymentCount,
//             hasWonLottery: member.hasWonLottery,
//             nextPaymentDueDate: member.nextPaymentDueDate,
//         })) : [], // No members data if completed
//         // Include winner name if group is completed
//         winnerName: winnerName || 'No winner yet',
//     };
// };

//

// const getGroupDetails = async (userId) => {
//     // Step 1: Fetch user role
//     const user = await prisma.user.findUnique({
//         where: { userId },
//         select: { role: true }
//     });

//     if (!user) {
//         throw new AppError('User not found', 404);
//     }

//     const isAdmin = user.role === 'ADMIN';

//     let groups;

//     if (isAdmin) {
//         // Admin: get all groups they manage
//         groups = await prisma.group.findMany({
//             where: { adminUserId: userId },
//             include: {
//                 admin: { select: { userId: true, name: true, email: true } },
//                 memberships: {
//                     select: {
//                         userId: true,
//                         hasWonLottery: true,
//                         cyclePaymentCount: true,
//                         nextPaymentDueDate: true,
//                         user: { select: { name: true, email: true } }
//                     }
//                 },
//                 lotteries: {
//                     take: 1,
//                     orderBy: { lotteryDate: 'desc' },
//                     select: { winningUserId: true }
//                 }
//             }
//         });
//     } else {
//         // Member: get groups they're part of
//         groups = await prisma.group.findMany({
//             where: {
//                 memberships: { some: { userId } }
//             },
//             include: {
//                 admin: { select: { userId: true, name: true, email: true } },
//                 memberships: {
//                     where: { userId },
//                     select: {
//                         userId: true,
//                         hasWonLottery: true,
//                         cyclePaymentCount: true,
//                         nextPaymentDueDate: true,
//                         user: { select: { name: true, email: true } }
//                     }
//                 },
//                 lotteries: {
//                     take: 1,
//                     orderBy: { lotteryDate: 'desc' },
//                     select: { winningUserId: true }
//                 }
//             }
//         });
//     }

//     if (!groups || groups.length === 0) {
//         throw new AppError('No groups found for this user.', 404);
//     }

//     // Step 3: Map and build response for each group
//     const groupDetails = await Promise.all(groups.map(async (group) => {
//         const totalMembers = await prisma.membership.count({
//             where: { groupId: group.groupId, isActive: true }
//         });

//         let cycleDate = group.currentCycleStartDate?.toISOString().split('T')[0] || null;

//         // If admin, use memberships in memory to detect cycle date
//         if (isAdmin) {
//             const membersWithLotteryWins = group.memberships.filter(member => member.hasWonLottery);
//             if (membersWithLotteryWins.length > 0) {
//                 cycleDate = membersWithLotteryWins[0].nextPaymentDueDate?.toISOString().split('T')[0] || cycleDate;
//             }
//         } else {
//             // Member: fetch winner's membership for nextPaymentDueDate
//             if (group.lotteries.length > 0) {
//                 const winnerUserId = group.lotteries[0].winningUserId;

//                 const winnerMembership = await prisma.membership.findFirst({
//                     where: {
//                         groupId: group.groupId,
//                         userId: winnerUserId
//                     },
//                     select: {
//                         nextPaymentDueDate: true
//                     }
//                 });

//                 if (winnerMembership?.nextPaymentDueDate) {
//                     cycleDate = winnerMembership.nextPaymentDueDate.toISOString().split('T')[0];
//                 }
//             }
//         }

//         // // Round info: cyclePaymentCount/maxMembers
//         // const roundInfoArr = group.memberships.map(member => `${member.cyclePaymentCount}/${group.maxMembers}`);
//         // const uniqueRoundInfo = [...new Set(roundInfoArr)].length === 1 ? roundInfoArr[0] : roundInfoArr;

//         // const allMembersPaid = group.memberships.every(member => member.cyclePaymentCount >= group.maxMembers);
//          //let groupStatus = group.status;

// // 1. Calculate individual rounds (e.g., 1/2, 2/2)
// const roundInfoArr = group.memberships.map(member => `${member.cyclePaymentCount}/${group.maxMembers}`);

// // 2. Determine highest round number
// const highestCycleCount = Math.max(...group.memberships.map(member => member.cyclePaymentCount));

// // 3. Check if all members completed
// const allMembersPaid = group.memberships.every(member => member.cyclePaymentCount >= group.maxMembers);
// let groupStatus = group.status;

// // 4. Set readable round info
// let roundInfo;
// if (groupStatus === 'COMPLETED' || allMembersPaid) {
//     // All members paid
//     roundInfo = `${group.maxMembers}/${group.maxMembers}`;
// } else {
//     // Show running cycle info
//     roundInfo = `Running Cycle: ${highestCycleCount}/${group.maxMembers}`;
// }

//         // Maintain status from table (group.status)

//         // Get winner name if lottery exists
//         const recentWinner = group.lotteries?.length > 0
//             ? group.lotteries[0].winningUserId
//             : null;

//         const winnerName = recentWinner
//             ? (await prisma.user.findUnique({ where: { userId: recentWinner } })).name
//             : 'No winner yet';

//         return {
//             groupId: group.groupId,
//             groupName: group.groupName,
//             status: groupStatus,
//             totalMembers,
//             cycleDate,
//             roundInfo: uniqueRoundInfo,
//             contributionAmount: group.contributionAmount,
//             admin: group.admin,
//             maxMembers: group.maxMembers,
//             description: group.description,
//             members: isAdmin || groupStatus !== 'COMPLETED'
//                 ? group.memberships.map(member => ({
//                     userId: member.userId,
//                     name: member.user?.name || 'N/A',
//                     email: member.user?.email || 'N/A',
//                     cyclePaymentCount: member.cyclePaymentCount,
//                     hasWonLottery: member.hasWonLottery,
//                     nextPaymentDueDate: member.nextPaymentDueDate
//                 }))
//                 : [],
//             winnerName
//         };
//     }));

//     return groupDetails;
// };


// const getGroupDetails = async (userId) => {
//     const user = await prisma.user.findUnique({
//         where: { userId },
//         select: { role: true }
//     });

//     if (!user) throw new AppError('User not found', 404);

//     const isAdmin = user.role === 'ADMIN';

//     let groups;
//     if (isAdmin) {
//         groups = await prisma.group.findMany({
//             where: { adminUserId: userId },
//             include: {
//                 admin: { select: { userId: true, name: true, email: true } },
//                 memberships: {
//                     select: {
//                         userId: true,
//                         hasWonLottery: true,
//                         cyclePaymentCount: true,
//                         nextPaymentDueDate: true,
//                         user: { select: { name: true, email: true } }
//                     }
//                 },
//                 lotteries: {
//                     take: 1,
//                     orderBy: { lotteryDate: 'desc' },
//                     select: { winningUserId: true }
//                 }
//             }
//         });
//     } else {
//         groups = await prisma.group.findMany({
//             where: {
//                 memberships: { some: { userId } }
//             },
//             include: {
//                 admin: { select: { userId: true, name: true, email: true } },
//                 memberships: {
//                     where: { userId },
//                     select: {
//                         userId: true,
//                         cyclePaymentCount: true,
//                         nextPaymentDueDate: true,
//                         hasWonLottery: true,
//                         user: { select: { name: true, email: true } }
//                     }
//                 },
//                 lotteries: {
//                     take: 1,
//                     orderBy: { lotteryDate: 'desc' },
//                     select: { winningUserId: true }
//                 }
//             }
//         });
//     }

//     if (!groups || groups.length === 0) {
//         throw new AppError('Group not found or you are not a member of any group', 404);
//     }

//     const groupDetails = await Promise.all(groups.map(async (group) => {
        
//                     const totalMembers = await prisma.membership.count({
//                         where: { groupId: group.groupId}
//                     });

//             let cycleDate = group.currentCycleStartDate?.toISOString().split('T')[0] || null;

//                     // If admin, use memberships in memory to detect cycle date
//                     if (isAdmin) {
//                         const membersWithLotteryWins = group.memberships.filter(member => member.hasWonLottery);
//                         if (membersWithLotteryWins.length > 0) {
//                             cycleDate = membersWithLotteryWins[0].nextPaymentDueDate?.toISOString().split('T')[0] || cycleDate;
//                         }
//                     } else {
//                         // Member: fetch winner's membership for nextPaymentDueDate
//                         if (group.lotteries.length > 0) {
//                             const winnerUserId = group.lotteries[0].winningUserId;
            
//                             const winnerMembership = await prisma.membership.findFirst({
//                                 where: {
//                                     groupId: group.groupId,
//                                     userId: winnerUserId
//                                 },
//                                 select: {
//                                     nextPaymentDueDate: true
//                                 }
//                             });
            
//                             if (winnerMembership?.nextPaymentDueDate) {
//                                 cycleDate = winnerMembership.nextPaymentDueDate.toISOString().split('T')[0];
//                             }
//                         }
//                     }

//         const roundInfoArr = group.memberships.map(member => `${member.cyclePaymentCount}/${group.maxMembers}`);
//         const highestCycleCount = Math.max(...group.memberships.map(member => member.cyclePaymentCount));
//         const allMembersPaid = group.memberships.every(member => member.cyclePaymentCount >= group.maxMembers);

//         let groupStatus = group.status;

//         let roundInfo;
//         if (groupStatus === 'COMPLETED') {
//             roundInfo = `${group.maxMembers}/${group.maxMembers}`;
//         } else {
//             roundInfo = `Running Cycle: ${highestCycleCount}/${group.maxMembers}`;
//         }

//         const recentWinner = group.lotteries?.length > 0
//             ? group.lotteries[0].winningUserId
//             : null;
//         const winnerName = recentWinner
//             ? (await prisma.user.findUnique({ where: { userId: recentWinner } })).name
//             : null;

//         return {
//             groupId: group.groupId,
//             groupName: group.groupName,
//             status: groupStatus,
//             totalMembers,
//             cycleDate: groupStatus === 'COMPLETED' ? cycleDate : undefined,
//             nextCycleDate: groupStatus !== 'COMPLETED' ? cycleDate : undefined,
//             roundInfo,
//             contributionAmount: group.contributionAmount,
//             admin: group.admin,
//             maxMembers: group.maxMembers,
//             description: group.description,
//             members:  group.memberships.map(member => ({
//                     userId: member.userId,
//                     name: member.user?.name || 'N/A',
//                     email: member.user?.email || 'N/A',
//                     cyclePaymentCount: member.cyclePaymentCount,
//                     hasWonLottery: member.hasWonLottery,
//                     nextPaymentDueDate: member.nextPaymentDueDate
//                 })),
                
//             LastwinnerName: winnerName || 'No winner yet'
//         };
//     }));

//     return groupDetails;
// };

const buildGroupDetails = async (groups, isAdmin) => {
    return await Promise.all(groups.map(async (group) => {
        const totalMembers = await prisma.membership.count({
            where: { groupId: group.groupId }
        });

        let cycleDate = group.currentCycleStartDate?.toISOString().split('T')[0] || null;

        if (isAdmin) {
            const membersWithLotteryWins = group.memberships.filter(member => member.hasWonLottery);
            if (membersWithLotteryWins.length > 0) {
                cycleDate = membersWithLotteryWins[0].nextPaymentDueDate?.toISOString().split('T')[0] || cycleDate;
            }
        } else {
            if (group.lotteries.length > 0) {
                const winnerUserId = group.lotteries[0].winningUserId;
                const winnerMembership = await prisma.membership.findFirst({
                    where: { groupId: group.groupId, userId: winnerUserId },
                    select: { nextPaymentDueDate: true }
                });

                if (winnerMembership?.nextPaymentDueDate) {
                    cycleDate = winnerMembership.nextPaymentDueDate.toISOString().split('T')[0];
                }
            }
        }

        const roundInfoArr = group.memberships.map(member => `${member.cyclePaymentCount}/${group.maxMembers}`);
        const highestCycleCount = Math.max(...group.memberships.map(member => member.cyclePaymentCount));
        const allMembersPaid = group.memberships.every(member => member.cyclePaymentCount >= group.maxMembers);

        const roundInfo = group.status === 'COMPLETED'
            ? `${group.maxMembers}/${group.maxMembers}`
            : `Running Cycle: ${highestCycleCount}/${group.maxMembers}`;

        const recentWinner = group.lotteries?.[0]?.winningUserId || null;
        const winnerName = recentWinner
            ? (await prisma.user.findUnique({ where: { userId: recentWinner } })).name
            : null;

        return {
            groupId: group.groupId,
            groupName: group.groupName,
            status: group.status,
            totalMembers,
            cycleDate: group.status === 'COMPLETED' ? cycleDate : undefined,
            nextCycleDate: group.status !== 'COMPLETED' ? cycleDate : undefined,
            roundInfo,
            contributionAmount: group.contributionAmount,
            admin: group.admin,
            maxMembers: group.maxMembers,
            description: group.description,
            members: group.memberships.map(member => ({
                userId: member.userId,
                name: member.user?.name || 'N/A',
                email: member.user?.email || 'N/A',
                cyclePaymentCount: member.cyclePaymentCount,
                hasWonLottery: member.hasWonLottery,
                nextPaymentDueDate: member.nextPaymentDueDate
            })),
            LastwinnerName: winnerName || 'No winner yet'
        };
    }));
};

const getActiveGroupDetails = async (userId) => {
    const user = await prisma.user.findUnique({
        where: { userId },
        select: { role: true }
    });
    if (!user) throw new AppError('User not found', 404);
    const isAdmin = user.role === 'ADMIN';

    let groups;
    if (isAdmin) {
        groups = await prisma.group.findMany({
            where: {
                adminUserId: userId,
                status: { in: ['PENDING', 'ACTIVE'] }
            },
            include: {
                admin: { select: { userId: true, name: true, email: true } },
                memberships: {
                    select: {
                        userId: true,
                        hasWonLottery: true,
                        cyclePaymentCount: true,
                        nextPaymentDueDate: true,
                        user: { select: { name: true, email: true } }
                    }
                },
                lotteries: {
                    take: 1,
                    orderBy: { lotteryDate: 'desc' },
                    select: { winningUserId: true }
                }
            }
        });
    } else {
        groups = await prisma.group.findMany({
            where: {
                memberships: { some: { userId } },
                status: { in: ['PENDING', 'ACTIVE'] }
            },
            include: {
                admin: { select: { userId: true, name: true, email: true } },
                memberships: {
                    where: { userId },
                    select: {
                        userId: true,
                        cyclePaymentCount: true,
                        nextPaymentDueDate: true,
                        hasWonLottery: true,
                        user: { select: { name: true, email: true } }
                    }
                },
                lotteries: {
                    take: 1,
                    orderBy: { lotteryDate: 'desc' },
                    select: { winningUserId: true }
                }
            }
        });
    }

    if (!groups || groups.length === 0) {
        throw new AppError('No active/pending groups found for the user', 404);
    }

    return await buildGroupDetails(groups, isAdmin);
};


const getCompletedGroupDetails = async (userId) => {
    const user = await prisma.user.findUnique({
        where: { userId },
        select: { role: true }
    });
    if (!user) throw new AppError('User not found', 404);
    const isAdmin = user.role === 'ADMIN';

    let groups;
    if (isAdmin) {
        groups = await prisma.group.findMany({
            where: {
                adminUserId: userId,
                status: 'COMPLETED'
            },
            include: {
                admin: { select: { userId: true, name: true, email: true } },
                memberships: {
                    select: {
                        userId: true,
                        hasWonLottery: true,
                        cyclePaymentCount: true,
                        nextPaymentDueDate: true,
                        user: { select: { name: true, email: true } }
                    }
                },
                lotteries: {
                    take: 1,
                    orderBy: { lotteryDate: 'desc' },
                    select: { winningUserId: true }
                }
            }
        });
    } else {
        groups = await prisma.group.findMany({
            where: {
                memberships: { some: { userId } },
                status: 'COMPLETED'
            },
            include: {
                admin: { select: { userId: true, name: true, email: true } },
                memberships: {
                    where: { userId },
                    select: {
                        userId: true,
                        cyclePaymentCount: true,
                        nextPaymentDueDate: true,
                        hasWonLottery: true,
                        user: { select: { name: true, email: true } }
                    }
                },
                lotteries: {
                    take: 1,
                    orderBy: { lotteryDate: 'desc' },
                    select: { winningUserId: true }
                }
            }
        });
    }

    if (!groups || groups.length === 0) {
        throw new AppError('No completed groups found for the user', 404);
    }

    return await buildGroupDetails(groups, isAdmin);
};



module.exports = {
    createGroup,
    activateGroup,
    getGroupById,
    getGroupDetailsForInvite,
    getActiveGroupDetails,
    getCompletedGroupDetails,
};