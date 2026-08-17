const express = require('express');
const router = express.Router();
const earningsController = require('../controllers/earningsController');
const { auth, isAdmin } = require('../middleware/auth');;
const { idParamValidator, validate } = require('../utils/validators');

router.use(auth);

// ─── Worker ──────────────────────────────────────────────────────────
router.get('/summary', earningsController.getEarningsSummary);
router.get('/history', earningsController.getEarningsHistory);

// ─── Admin only ──────────────────────────────────────────────────────
router.get('/admin/:workerId/summary', isAdmin, idParamValidator, validate, earningsController.getWorkerEarningsSummary);

module.exports = router;