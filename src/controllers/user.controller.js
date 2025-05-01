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

module.exports = {
    createUser,
    getUser,
    getAllUsers
};