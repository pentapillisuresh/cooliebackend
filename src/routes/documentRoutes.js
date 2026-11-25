const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const { auth, isAdmin } = require('../middleware/auth');;
const { uploadSingle } = require('../middleware/upload');
const { idParamValidator, validate } = require('../utils/validators');

router.use(auth);

// ─── Worker ──────────────────────────────────────────────────────────
router.post('/', uploadSingle('file'), documentController.uploadDocument);
router.put('/:id', uploadSingle('file'), documentController.updateDocument);
router.get('/my', documentController.getMyDocuments);
router.get('/:id', idParamValidator,  documentController.getDocumentById);
router.delete('/:id', idParamValidator,  documentController.deleteDocument);

// ─── Admin only ──────────────────────────────────────────────────────
router.get('/', isAdmin, documentController.getAllDocuments);
router.patch('/:id/verify', isAdmin, idParamValidator,  documentController.verifyDocument);

module.exports = router;