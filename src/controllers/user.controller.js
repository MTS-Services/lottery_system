const userService = require('../services/user.service');
const AppError = require('../utils/errors');

const createUser = async (req, res, next) => {
    try {
        console.log("request body ",req.body);
        const newUser = await userService.createUser(req.body);
      
        res.status(201).json({
            status: 'success',
            data: {
                user: newUser,
            },
        });
    } catch (error) {
        next(error); // Pass error to global error handler
    }
};

 const getUser = async (req, res, next) => {
    try {
        const userId = req.params.id; // Assuming route is /users/:id
        if (!userId) {
             throw new AppError('User ID is required', 400);
        }
        const user = await userService.getUserById(userId);
        res.status(200).json({
            status: 'success',
            data: {
                user,
            },
        });
    } catch (error) {
         next(error);
    }
};



const getAllUsers = async (req, res, next) => {
    try {
        const users = await userService.getAllUsers();
        res.status(200).json({
            status: 'success',
            data: {
                users,
            },
        });
    }
    catch (error) {
        next(error);
    }
}

//
//filter history by userId. show 3) thing only 1)recent payment info(with groupname, amount, date) 2)recent lottery info((if he belong )with groupname, amount, date) 3)recent group info(with groupname, date)
// const userHistory = async (userId) => {
//     const user = await prisma.user.findUnique({
//         where: { userId },
//         include: {
//             memberships: {
//                 include: {
//                     group: true,
//                 },
//             },
//             lotteries: true,
//         },
//     });

//     if (!user) {
//         throw new AppError('User not found', 404);
//     }

//     const paymentHistory = user.memberships.map((membership) => ({
//         groupName: membership.group.groupName,
//         amount: membership.contributionAmount,
//         date: membership.nextPaymentDueDate,
//     }));

//     const lotteryHistory = user.lotteries.map((lottery) => ({
//         groupName: lottery.group.groupName,
//         amount: lottery.amount,
//         date: lottery.date,
//     }));

//     const groupHistory = user.memberships.map((membership) => ({
//         groupName: membership.group.groupName,
//         date: membership.joinedDate,
//     }));


//     return {
//         paymentHistory,
//         lotteryHistory,
//         groupHistory,
//     };
// };

const userHistory = async (req, res, next) => {
    try {
        const userId = req.body.userId; // Assuming route is /users/:id
        if (!userId) {
            throw new AppError('User ID is required', 400);
        }
        const history = await userService.userHistory(userId);
        res.status(200).json({
            status: 'success',
            data: {
                history,
            },
        });
    } catch (error) {
        next(error);
    }
}



module.exports = {
    createUser,
    getUser,
    getAllUsers,
    userHistory
};