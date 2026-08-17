const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { auth, isAdmin } = require('../middleware/auth');;
const { idParamValidator, validate } = require('../utils/validators');

// ─── Public ──────────────────────────────────────────────────────────
router.get('/worker/:workerId', reviewController.getWorkerReviews);

// ─── Authenticated ──────────────────────────────────────────────────
router.use(auth);
router.post('/booking/:bookingId', idParamValidator, validate, reviewController.createReview);
router.get('/my', reviewController.getMyReviews);
router.put('/:id', idParamValidator, validate, reviewController.updateReview);
router.delete('/:id', idParamValidator, validate, reviewController.deleteReview);

// ─── Admin only ──────────────────────────────────────────────────────
router.get('/', isAdmin, reviewController.getAllReviews);

module.exports = router;