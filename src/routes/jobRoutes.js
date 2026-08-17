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

// ─── Worker routes ──────────────────────────────────────────────────
router.get('/my', jobController.getMyJobs);
router.get('/:id', idParamValidator, validate, jobController.getJobById);
router.get('/:id/history', idParamValidator, validate, jobController.getJobHistory);
router.put('/:id/accept', idParamValidator, validate, jobController.acceptJob);
router.put('/:id/arrive', idParamValidator, validate, jobController.arriveAtLocation);
router.post('/:id/confirm-otp', idParamValidator, confirmOTPValidator, validate, jobController.confirmOTP);
router.put('/:id/complete', idParamValidator, completeJobValidator, validate, jobController.completeJob);
router.put('/:id/cancel', idParamValidator, validate, jobController.cancelJob);
router.post('/:id/photos', idParamValidator, uploadMultiple('photos', 5), jobController.uploadJobPhotos);
router.put('/:id/location', idParamValidator, validate, jobController.updateLocation);
router.put('/:id/rating', idParamValidator, validate, jobController.updateJobRating);

// ─── Admin only ──────────────────────────────────────────────────────
router.get('/', isAdmin, jobController.getAllJobs);
router.put('/:id/reassign', isAdmin, idParamValidator, validate, jobController.reassignJob);

module.exports = router;