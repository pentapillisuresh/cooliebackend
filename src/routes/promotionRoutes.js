const express = require('express');
const router = express.Router();
const promotionController = require('../controllers/promotionController');
const { isAdmin, auth} = require('../middleware/auth');
const { idParamValidator, validate } = require('../utils/validators');

// ─── Public (no authentication required) ──────────────────────
router.get('/', promotionController.getActivePromotions);
router.get('/:id', idParamValidator, validate, promotionController.getPromotionById);

// ─── Admin only ──────────────────────────────────────────────
router.post('/', auth, isAdmin, promotionController.createPromotion);
router.put('/:id', auth, isAdmin, idParamValidator, validate, promotionController.updatePromotion);
router.delete('/:id', auth, isAdmin, idParamValidator, validate, promotionController.deletePromotion);
router.get('/admin/all', auth, isAdmin, promotionController.getAllPromotions);

module.exports = router;