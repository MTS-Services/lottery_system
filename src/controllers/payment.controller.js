const paymentService = require('../services/payment.service');
const AppError = require('../utils/errors');

const recordPayment = async (req, res, next) => {
    try {
        const { userId, groupId, amount, transactionId, status, paymentDate } = req.body;

        if (!userId) {
            throw new AppError('User ID is required (Insecure - Should come from auth)', 400);
        }

        const result = await paymentService.recordPayment({ userId, groupId, amount, transactionId, status, paymentDate });

        res.status(201).json({
            status: 'success',
            message: 'Payment recorded successfully',
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

/*const getAllPaymentsByUserId = async (userId) => {
    if (!userId) {
      throw new AppError('User ID is required', 400);
    }
  
    // First, get the user's role
    const user = await prisma.user.findUnique({
      where: { userId },
      select: { role: true },
    });
  
    if (!user) {
      throw new AppError('User not found', 404);
    }
  
    let payments;
  
    if (user.role === 'ADMIN') {
      // Admin: fetch all payments for groups they admin
      payments = await prisma.payment.findMany({
        where: {
          group: {
            adminUserId: userId,
          },
        },
        include: {
          user: true,
          group: true,
          membership: true,
        },
      });
    } else {
      // Member: only fetch their own payments
      payments = await prisma.payment.findMany({
        where: { userId },
        include: {
          group: true,
          membership: true,
        },
      });
    }
  
    if (payments.length === 0) {
      throw new AppError('No payments found', 404);
    }
  
    return payments;
  }; */

const getAllPaymentsByUserId = async (req, res, next) => {
    try {
        const userId = req.params.userId; // Assuming route is /payments/:userId

        if (!userId) {
            throw new AppError('User ID is required', 400);
        }

        const payments = await paymentService.getAllPaymentsByUserId(userId);

        res.status(200).json({
            status: 'success',
            data: {
                payments,
            },
        });
    } catch (error) {
        next(error);
    }
}
  

module.exports = {
    recordPayment,
    getAllPaymentsByUserId,
};
