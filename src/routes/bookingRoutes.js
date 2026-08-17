const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { auth, isAdmin } = require('../middleware/auth');;
const {
  createBookingValidator,
  updateBookingValidator,
  idParamValidator,
  validate,
} = require('../utils/validators');

router.use(auth);

// ─── User routes ────────────────────────────────────────────────────
router.post('/', createBookingValidator, validate, bookingController.createBooking);
router.get('/my', bookingController.getMyBookings);
router.get('/:id', idParamValidator, validate, bookingController.getBookingById);
router.put('/:id', idParamValidator, updateBookingValidator, validate, bookingController.updateBooking);
router.put('/:id/cancel', idParamValidator, validate, bookingController.cancelBookingWithReason);
router.put('/:id/group', idParamValidator, validate, bookingController.updateGroup);
router.get('/:id/timeline', idParamValidator, validate, bookingController.getBookingTimeline);

// ─── Admin only ──────────────────────────────────────────────────────
router.get('/', isAdmin, bookingController.getAllBookings);
router.post('/:id/assign', isAdmin, idParamValidator, validate, bookingController.assignWorker);
router.put('/:id/reassign', isAdmin, idParamValidator, validate, bookingController.reassignWorker);

module.exports = router;