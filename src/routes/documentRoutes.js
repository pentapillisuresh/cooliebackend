const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const { auth, isAdmin } = require('../middleware/auth');;
const { uploadSingle } = require('../middleware/upload');
const { idParamValidator, validate } = require('../utils/validators');

router.use(auth);

// ─── Worker ──────────────────────────────────────────────────────────
router.post('/', uploadSingle('file'), documentController.uploadDocument);
router.get('/my', documentController.getMyDocuments);
router.get('/:id', idParamValidator, validate, documentController.getDocumentById);
router.delete('/:id', idParamValidator, validate, documentController.deleteDocument);

// ─── Admin only ──────────────────────────────────────────────────────
router.get('/', isAdmin, documentController.getAllDocuments);
router.patch('/:id/verify', isAdmin, idParamValidator, validate, documentController.verifyDocument);

module.exports = router;