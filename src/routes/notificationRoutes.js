const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { auth, isAdmin } = require('../middleware/auth');;
const { idParamValidator, validate } = require('../utils/validators');

router.use(auth);

// ─── User/Worker ─────────────────────────────────────────────────────
router.get('/', notificationController.getMyNotifications);
router.put('/:id/read', idParamValidator, validate, notificationController.markAsRead);
router.put('/read-all', notificationController.markAllAsRead);
router.delete('/:id', idParamValidator, validate, notificationController.deleteNotification);

// ─── Admin only ──────────────────────────────────────────────────────
// router.post('/', isAdmin, notificationController.sendNotification);

module.exports = router;