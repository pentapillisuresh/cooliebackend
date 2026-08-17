const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const { auth, isAdmin } = require('../middleware/auth');;
const { idParamValidator, validate } = require('../utils/validators');

// ─── Public routes ──────────────────────────────────────────────────
router.get('/', serviceController.getAllServices);
router.get('/category/:slug', serviceController.getServicesByCategorySlug);
router.get('/top', serviceController.getTopServices); // NEW: top services
router.get('/:id', idParamValidator, serviceController.getServiceById);
router.get('/:id/schema', idParamValidator, validate, serviceController.getServiceSchema);
router.get('/:id/availability', idParamValidator, validate, serviceController.checkAvailability);

// ─── Admin only ──────────────────────────────────────────────────────
router.post('/', auth, isAdmin, serviceController.createService);
router.put('/:id', auth, isAdmin, idParamValidator, validate, serviceController.updateService);
router.delete('/:id', auth, isAdmin, idParamValidator, validate, serviceController.deleteService);
router.patch('/:id/toggle', auth, isAdmin, idParamValidator, validate, serviceController.toggleServiceStatus);

module.exports = router;