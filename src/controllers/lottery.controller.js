const lotteryService = require('../services/lottery.service');
const AppError = require('../utils/errors');

const triggerLotteryCheck = async (req, res, next) => {
    try {
        const { groupId } = req.params;

        if (!groupId) {
            throw new AppError('Group ID is required', 400);
        }

        await lotteryService.checkAndExecuteLottery(groupId);
        


        res.status(200).json({
            status: 'success',
            message: 'Lottery check and execution (if ready) triggered successfully',
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    triggerLotteryCheck,
};
// // ... (other imports and functions)
// const { scheduleLotteryManually } = require('../services/lottery.service'); // Import the new service function


// const handleScheduleLotteryManually = async (req, res, next) => {
//     // In a real app, validate groupId format and get adminUserId from authenticated user
//     const { groupId } = req.params;
//     const { adminUserId, durationInHours } = req.body; // Assuming adminUserId and duration come in body for testing

//     // Basic validation (more robust validation library recommended)
//     if (!groupId) {
//          throw new AppError('Group ID is required', 400);
//     }
//     if (!adminUserId) {
//         // This should come from auth middleware in production!
//         console.warn("Warning: Using adminUserId from body (insecure)");
//         throw new AppError('Admin User ID is required', 400);
//     }
//      if (typeof durationInHours !== 'number' || durationInHours <= 0) {
//          throw new AppError('Duration in hours must be a positive number', 400);
//      }


//     try {
//         // The service handles all the business logic and error checks (auth, payments, status)
//         const updatedGroup = await scheduleLotteryManually(groupId, adminUserId, durationInHours);

//         res.status(200).json({
//             status: 'success',
//             message: 'Lottery schedule updated successfully',
//             data: {
//                 groupId: updatedGroup.groupId,
//                 lotteryScheduledAt: updatedGroup.lotteryScheduledAt, // Send the scheduled time back
//                 // You might want to include other relevant group details
//             },
//         });

//     } catch (error) {
//         // Use next(error) to pass to a centralized error handler
//         next(error);
//     }
// };

// module.exports = {
//     // ... other exports
//     handleScheduleLotteryManually,
// };