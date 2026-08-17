const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { auth, isAdmin } = require('../middleware/auth');;
const { idParamValidator, validate } = require('../utils/validators');

// ─── Public routes ──────────────────────────────────────────────────
router.get('/', categoryController.getAllCategories);
router.get('/with-count', categoryController.getAllCategoriesWithCount);
router.get('/:id', idParamValidator, categoryController.getCategoryById);
router.get('/slug/:slug', categoryController.getCategoryWithSchema);

// ─── Admin only ──────────────────────────────────────────────────────
router.post('/', auth, isAdmin, categoryController.createCategory);
router.put('/:id', auth, isAdmin, idParamValidator, validate, categoryController.updateCategory);
router.delete('/:id', auth, isAdmin, idParamValidator, validate, categoryController.deleteCategory);
router.patch('/bulk-sort', auth, isAdmin, categoryController.bulkUpdateSortOrder);

module.exports = router;