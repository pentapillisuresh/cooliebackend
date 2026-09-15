const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const {auth} = require('../middleware/auth');
const { isAdmin } = require('../middleware/auth');
const { messaging } = require('../config/firebase');

// Protected – get own profile
router.get('/profile', auth, userController.getProfile);
router.put('/profile', auth, userController.updateProfile);
router.put('/change-password', auth, userController.changePassword);

// Admin only
router.get('/', auth, isAdmin, userController.getAllUsers);
router.get('/:id', auth, isAdmin, userController.getUserById);
router.put('/:id', auth, isAdmin, userController.updateUser);
router.delete('/:id', auth, isAdmin, userController.deleteUser);

router.post('/test-notification', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'FCM token is required',
      });
    }
    if (!messaging) {
      return res.status(503).json({
        success: false,
        message: 'Firebase is not initialized',
      });
    }

    const response = await messaging.send({
      token,

      notification: {
        title: 'Test Notification',
        body: 'Push notification is working! 🚀',
      },

      data: {
        type: 'TEST',
      },
    });
console.log("token responce::",response)
    return res.json({
      success: true,
      messageId: response,
    });
  } catch (error) {
    console.error('❌ Push notification error:', error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;