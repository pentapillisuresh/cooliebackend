const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { auth, isAdmin } = require('../middleware/auth');
const { registerValidator, loginValidator, validate } = require('../utils/validators');

// ─── Public routes ──────────────────────────────────────────────────
router.post('/register', registerValidator,  authController.register);
router.post('/login', loginValidator,  authController.login);
router.post('/send-otp', authController.sendOTP);
router.post('/verify-otp', authController.verifyOTP);
router.post('/resend-otp', authController.resendOTP);

// ─── Protected routes ──────────────────────────────────────────────
router.get('/profile', auth, authController.getProfile);
router.post('/logout', auth, authController.logout);
router.post('/device-token', auth, authController.registerDeviceToken);

// Add this route (requires auth)
// router.post('/device-token', auth, authController.registerDeviceToken);

module.exports = router;