const prisma = require('../utils/prisma.client');
const { hashPassword } = require('../utils/helpers');
const { sendEmail } = require('./email.service');
const AppError = require('../utils/errors');

const createUser = async (userData) => {
    const {userId, name, email, dateOfBirth, password, role } = userData;

    // Basic validation example
 
    if (!userId || !name || !email || !password || !dateOfBirth) {
        throw new AppError('Missing required user fields', 400);
    }
     // Validate role if provided
    if (role && !['MEMBER', 'ADMIN'].includes(role.toUpperCase())) {
         throw new AppError('Invalid role specified', 400);
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        throw new AppError('Email already in use', 409); // 409 Conflict
    }

    //unique userId from req.body
    const checkUserId = await prisma.user.findUnique({ where: { userId } });
    if (checkUserId) {
        throw new AppError('User ID already in use', 409); // 409 Conflict
    }

    const passwordHash = await hashPassword(password);

   console.log("userId",userId);


    const newUser = await prisma.user.create({
        data: {
            userId,
            name,
            email,
            dateOfBirth: new Date(dateOfBirth), // Ensure it's a Date object
            passwordHash,
        
            role: role ? role.toUpperCase() : 'MEMBER', // Default to MEMBER if not provided
        },
        // Select only non-sensitive fields to return
        select: {
            userId: true,
            name: true,
            email: true,
            role: true,
            createdAt: true
        }
    });

    // Send welcome email (fire and forget - don't block response if email fails)
    sendEmail({
        to: newUser.email,
        subject: 'Welcome to ROSCA App!',
        text: `Hi ${newUser.name},\n\nYour account has been successfully created. You can now log in and participate in groups.\n\nBest regards,\nThe ROSCA App Team`,
        html: `<p>Hi ${newUser.name},</p><p>Your account has been successfully created. You can now log in and participate in groups.</p><p>Best regards,<br>The ROSCA App Team</p>`,
    }).catch(err => console.error("Failed to send welcome email:", err)); // Log email errors

    return newUser;
};

// Add other user-related service functions if needed (e.g., getUserById)
const getUserById = async (userId) => {
    const user = await prisma.user.findUnique({
         where: { userId },
         // Exclude password hash
         select: { userId: true, name: true, email: true, role: true, dateOfBirth: true, createdAt: true }
    });
    if (!user) {
        throw new AppError('User not found', 404);
    }
    return user;
};


//get all users except password hash and admin role
const getAllUsers = async () => {
    const users = await prisma.user.findMany({
        select: { userId: true, name: true, email: true, role: true, dateOfBirth: true, createdAt: true },
        where: { role: { not: 'ADMIN' } } // Exclude admin users
    });
    return users;
};


//filter history by userId. show 3) thing only 1)recent payment info(with groupname, amount, date) 2)recent lottery info((if he belong )with groupname, amount, date) 3)recent group info(with groupname, date)
const userHistory = async (userId) => {
    const user = await prisma.user.findUnique({
        where: { userId },
        include: {
            memberships: {
                include: {
                    group: true,
                },
            },
            lotteryWins: { // ✅ use the correct relation name
                include: {
                    group: true,
                },
            },
        },
    });

    if (!user) {
        throw new AppError('User not found', 404);
    }

    const paymentHistory = user.memberships.map((membership) => ({
        groupName: membership.group.groupName,
        amount: membership.group.contributionAmount,
        date: membership.nextPaymentDueDate,
    }));

    const lotteryHistory = user.lotteryWins.map((lottery) => ({
        groupName: lottery.group.groupName,
        amount: lottery.potAmount,
        date: lottery.lotteryDate,
    }));

    const groupHistory = user.memberships.map((membership) => ({
        groupName: membership.group.groupName,
        date: membership.joinDate,
    }));

    return {
        paymentHistory,
        lotteryHistory,
        groupHistory,
    };
};




module.exports = {
    createUser,
    getUserById,
    getAllUsers,
    userHistory
};