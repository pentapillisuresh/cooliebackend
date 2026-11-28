const express = require('express');
const router = express.Router();
const { createReferral } = require('../controllers/referralController');

router.post('/track', createReferral);

module.exports = router;