const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');
// const { authenticate } = require('../middleware/auth');

// router.use(authenticate); // all coupon routes require login

router.post('/validate', couponController.validateCoupon);
router.post('/apply', couponController.applyCoupon);

module.exports = router;