const express = require('express');
const router = express.Router();
const faqController = require('../controllers/faqController');
const { auth, isAdmin } = require('../middleware/auth');;
const { idParamValidator, validate } = require('../utils/validators');

// ─── Public ──────────────────────────────────────────────────────────
router.get('/', faqController.getFAQs);
router.get('/:id', idParamValidator,  faqController.getFAQById);

// ─── Admin only ──────────────────────────────────────────────────────
router.post('/', auth, isAdmin, faqController.createFAQ);
router.put('/:id', auth, isAdmin, idParamValidator,  faqController.updateFAQ);
router.delete('/:id', auth, isAdmin, idParamValidator,  faqController.deleteFAQ);

module.exports = router;