const express = require('express');
const router = express.Router();
const {auth,isAdmin} = require('../middleware/auth');          // your JWT middleware
const withdrawController = require('../controllers/withdrawalController');

router.use(auth);

router.post('/', withdrawController.createWithdrawal);
router.get('/',  withdrawController.listWithdrawals);
router.get('/:id', withdrawController.getWithdrawal);

// admin-only
router.patch('/:id', isAdmin, withdrawController.updateWithdrawalStatus);

module.exports = router;