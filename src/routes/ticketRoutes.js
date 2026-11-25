const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const { auth, isAdmin } = require('../middleware/auth');;
const { idParamValidator, validate } = require('../utils/validators');

router.use(auth);

// ─── User/Worker ─────────────────────────────────────────────────────
router.post('/', ticketController.createTicket);
router.get('/my', ticketController.getMyTickets);
router.get('/:id', idParamValidator,  ticketController.getTicketById);
router.post('/:id/reply', idParamValidator,  ticketController.replyToTicket);

// ─── Admin only ──────────────────────────────────────────────────────
router.get('/', isAdmin, ticketController.getAllTickets);
router.put('/:id/status', isAdmin, idParamValidator,  ticketController.updateTicketStatus);

module.exports = router;