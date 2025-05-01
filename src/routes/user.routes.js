const express = require('express');
const userController = require('../controllers/user.controller');

const router = express.Router();

router.post('/create', userController.createUser);
router.get('/:id', userController.getUser); // Example get user route
router.get('/', userController.getAllUsers); // Example get all users route

module.exports = router;