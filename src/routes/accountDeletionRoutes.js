const express = require('express');
const ctrl = require('../controllers/accountDeletionController');

const router = express.Router();

router.post('/send-otp', ctrl.sendOtp);
router.post('/verify-otp', ctrl.verifyOtp);
router.post('/confirm', ctrl.confirmDeletion);

module.exports = router;