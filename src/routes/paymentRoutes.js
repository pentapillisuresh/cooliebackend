const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { auth, isAdmin } = require('../middleware/auth');;
const { idParamValidator, validate } = require('../utils/validators');

// ─── Webhook (public) ──────────────────────────────────────────────
router.post('/webhook', paymentController.handleWebhook);

// ─── Authenticated routes ──────────────────────────────────────────
router.use(auth);

// User routes
router.post('/booking/:bookingId/order', idParamValidator, validate, paymentController.createRazorpayOrder);
router.post('/booking/:bookingId/verify', idParamValidator, validate, paymentController.verifyPayment);
router.get('/booking/:bookingId/status', idParamValidator, validate, paymentController.getPaymentStatus);
router.get('/history', paymentController.getPaymentHistory);
router.get('/methods', paymentController.getPaymentMethods);

// Admin routes
router.get('/report', isAdmin, paymentController.getPaymentReport);
router.post('/booking/:bookingId/refund', isAdmin, idParamValidator, validate, paymentController.initiateRefund);

module.exports = router;