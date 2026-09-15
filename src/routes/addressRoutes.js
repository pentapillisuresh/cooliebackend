const express = require('express');
const router = express.Router();
const addressController = require('../controllers/addressController');
const { auth } = require('../middleware/auth');
const { idParamValidator, validate } = require('../utils/validators');

router.use(auth);

// List / create
router.get('/', addressController.getMyAddresses);
router.post('/', addressController.createAddress);

// Single address operations
router.get('/:id', idParamValidator, validate, addressController.getAddressById);
router.put('/:id', idParamValidator, validate, addressController.updateAddress);
router.delete('/:id', idParamValidator, validate, addressController.deleteAddress);
router.patch('/:id/default', idParamValidator, validate, addressController.setDefaultAddress);

module.exports = router;