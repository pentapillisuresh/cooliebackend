const express = require('express');
const router = express.Router();
const {auth} = require('../middleware/auth');
const ctrl = require('../controllers/cartController');

router.use(auth);

router.get('/', ctrl.getCart);
router.patch('/', ctrl.updateCart);
router.delete('/', ctrl.clearCart);

router.post('/items', ctrl.addItem);
router.put('/items/:itemId', ctrl.updateItem);
router.delete('/items/:itemId', ctrl.removeItem);

router.post('/checkout', ctrl.checkout);

module.exports = router;