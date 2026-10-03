const express = require('express');

const router = express.Router();

const workerController = require('../controllers/workerController');

const {
  auth,
  isAdmin,
} = require('../middleware/auth');

const {
  idParamValidator,
  validate,
} = require('../utils/validators');


// ============================================================
// PUBLIC ROUTES
// ============================================================

router.get(
  '/professions',
  workerController.getProfessions
);


// ============================================================
// AUTHENTICATION
// ============================================================

router.use(auth);


// ============================================================
// WORKER PROFILE
// ============================================================

router.post(
  '/register',
  workerController.registerWorker
);

router.get(
  '/profile/me',
  workerController.getMyProfile
);

router.put(
  '/profile',
  workerController.updateWorkerProfile
);


// ============================================================
// LOCATION & AVAILABILITY
// ============================================================

router.put(
  '/location',
  workerController.updateLocation
);

router.patch(
  '/availability',
  workerController.toggleAvailability
);


// ============================================================
// WORKER STATISTICS
// IMPORTANT: before /:id
// ============================================================

router.get(
  '/user/stats',
  workerController.getWorkerStats
);


// ============================================================
// BANK DETAILS
// ============================================================

router.post(
  '/bank',
  workerController.addBankDetails
);

router.get(
  '/bank',
  workerController.getBankDetails
);


// ============================================================
// ADMIN - ALL WORKERS
// ============================================================

router.get(
  '/',
  isAdmin,
  workerController.getAllWorkers
);


// ============================================================
// ADMIN - FULL WORKER DETAILS
// IMPORTANT: BEFORE /:id
// ============================================================

router.get(
  '/admin/:id/full',
  isAdmin,
  workerController.getWorkerFullDetails
);


// ============================================================
// ADMIN - VERIFY WORKER
// ============================================================

router.put(
  '/:id/verify',
  isAdmin,
  workerController.verifyWorker
);


// ============================================================
// ADMIN - VERIFY BANK DETAILS
// ============================================================

router.put(
  '/:id/bank/verify',
  isAdmin,
  workerController.verifyBankDetails
);


// ============================================================
// ADMIN - DELETE WORKER
// ============================================================

router.delete(
  '/:id',
  isAdmin,
  workerController.deleteWorker
);


// ============================================================
// DYNAMIC WORKER
// MUST BE LAST
// ============================================================

router.get(
  '/:id',
  workerController.getWorkerById
);


module.exports = router;