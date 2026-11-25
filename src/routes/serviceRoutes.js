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
router.get('/:id/schema', idParamValidator, serviceController.getServiceSchema);
router.get('/:id/availability', idParamValidator, serviceController.checkAvailability);

// ─── Admin only ──────────────────────────────────────────────────────
router.post('/', auth, isAdmin, serviceController.createService);
router.put('/:id', auth, isAdmin, idParamValidator, serviceController.updateService);
router.delete('/:id', auth, isAdmin, idParamValidator, serviceController.deleteService);
router.patch('/:id/toggle', auth, isAdmin, idParamValidator, serviceController.toggleServiceStatus);
router.patch('/:id/position',auth,isAdmin,idParamValidator,serviceController.updatePosition);

module.exports = router;