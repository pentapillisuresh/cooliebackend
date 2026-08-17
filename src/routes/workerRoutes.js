const express = require('express');
const router = express.Router();
const workerController = require('../controllers/workerController');
const { auth, isAdmin } = require('../middleware/auth');;
const { idParamValidator, validate } = require('../utils/validators');

// ─── Public routes ───────────────────────────────────────────────────
router.get('/professions', workerController.getProfessions);
router.get('/:id', workerController.getWorkerById);

// ─── Authenticated routes ───────────────────────────────────────────
router.use(auth);

// Worker profile
router.post('/register', workerController.registerWorker);
router.get('/profile/me', workerController.getMyProfile);
router.put('/profile', workerController.updateWorkerProfile);

// Location & availability
router.put('/location', workerController.updateLocation);
router.patch('/availability', workerController.toggleAvailability);

// Statistics
router.get('/stats', workerController.getWorkerStats);

// Bank details
router.post('/bank', workerController.addBankDetails);
router.get('/bank', workerController.getBankDetails);

// ─── Admin only ──────────────────────────────────────────────────────
router.get('/', isAdmin, workerController.getAllWorkers);
router.get('/admin/:id/full', isAdmin, idParamValidator, validate, workerController.getWorkerFullDetails);
router.put('/:id/verify', isAdmin, idParamValidator, validate, workerController.verifyWorker);
router.put('/:id/bank/verify', isAdmin, idParamValidator, validate, workerController.verifyBankDetails);
router.delete('/:id', isAdmin, idParamValidator, validate, workerController.deleteWorker);

module.exports = router;