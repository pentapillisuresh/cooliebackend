const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const {auth} = require('../middleware/auth');
const { isAdmin } = require('../middleware/auth');

// Protected – get own profile
router.get('/profile', auth, userController.getProfile);
router.put('/profile', auth, userController.updateProfile);
router.put('/change-password', auth, userController.changePassword);

// Admin only
router.get('/', auth, isAdmin, userController.getAllUsers);
router.get('/:id', auth, isAdmin, userController.getUserById);
router.put('/:id', auth, isAdmin, userController.updateUser);
router.delete('/:id', auth, isAdmin, userController.deleteUser);

module.exports = router;