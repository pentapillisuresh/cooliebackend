const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');
const { auth, isAdmin } = require('../middleware/auth');;
const { uploadMultiple } = require('../middleware/upload');
const {
  confirmOTPValidator,
  completeJobValidator,
  idParamValidator,
  validate,
} = require('../utils/validators');

router.use(auth);

router.put('/:id/cancel', idParamValidator, jobController.cancelJob);
router.get('/:id', idParamValidator, jobController.getJobById);
// ─── User routes ──────────────────────────────────────────────────
router.put('/:id/arrive', idParamValidator, jobController.arriveAtLocation);
router.put('/:id/complete', idParamValidator, completeJobValidator, jobController.completeJob);
router.put('/:id/rating', idParamValidator, jobController.updateJobRating);

// ─── Worker routes ──────────────────────────────────────────────────
router.get('/my', jobController.getMyJobs);
router.get('/:id/history', idParamValidator, jobController.getJobHistory);
router.put('/:id/accept', idParamValidator, jobController.acceptJob);
router.post('/:id/confirm-otp', idParamValidator, confirmOTPValidator, jobController.confirmOTP);
router.post('/:id/photos', idParamValidator, uploadMultiple('photos', 5), jobController.uploadJobPhotos);
router.put('/:id/location', idParamValidator, jobController.updateLocation);

// ─── Admin only ──────────────────────────────────────────────────────
router.get('/', isAdmin, jobController.getAllJobs);
router.put('/:id/reassign', isAdmin, idParamValidator, jobController.reassignJob);

module.exports = router;