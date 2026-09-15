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
router.post('/', createBookingValidator,createBookingValidator, bookingController.createBooking);
router.get('/my', bookingController.getMyBookings);
router.get('/:id', idParamValidator, bookingController.getBookingById);
router.put('/:id', idParamValidator, updateBookingValidator, bookingController.updateBooking);
router.put('/:id/cancel', idParamValidator, bookingController.cancelBookingWithReason);
router.put('/:id/group', idParamValidator, bookingController.updateGroup);
router.get('/:id/timeline', idParamValidator, bookingController.getBookingTimeline);

// ─── Admin only ──────────────────────────────────────────────────────
router.get('/', isAdmin, bookingController.getAllBookings);
router.post('/:id/assign', isAdmin, idParamValidator, bookingController.assignWorker);
router.put('/:id/reassign', isAdmin, idParamValidator, bookingController.reassignWorker);

module.exports = router;