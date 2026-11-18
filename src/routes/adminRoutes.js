const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/adminDashboardController');
const { auth, isAdmin } = require('../middleware/auth');

// ── Dashboard Route ──
router.get('/dashboard', auth, isAdmin, dashboardController.getDashboardStats);

module.exports = router;