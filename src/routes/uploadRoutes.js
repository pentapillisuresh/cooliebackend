const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const { auth, isAdmin } = require('../middleware/auth');;
const { uploadSingle, uploadMultiple } = require('../middleware/upload');

router.use(auth);

// ─── File uploads ────────────────────────────────────────────────────
router.post('/single', uploadSingle('file'), uploadController.uploadSingleFile);
router.post('/multiple', uploadMultiple('files', 5), uploadController.uploadMultipleFiles);
router.post('/video', uploadSingle('video'), uploadController.uploadVideo);

// ─── File management ────────────────────────────────────────────────
router.delete('/*filePath', uploadController.deleteFile);

module.exports = router;