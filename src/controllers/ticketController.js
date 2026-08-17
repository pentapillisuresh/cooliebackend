const { Ticket, TicketReply, User } = require('../models');
const { getPagination, getPagingData } = require('../utils/helpers');
const { Op } = require('sequelize');
const { USER_ROLES } = require('../utils/constants');

/**
 * Raise a new ticket (authenticated user/worker)
 */
exports.createTicket = async (req, res, next) => {
  try {
    const { subject, message, category, priority } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ error: 'Subject and message are required' });
    }

    const ticket = await Ticket.create({
      userId: req.user.id,
      subject,
      message,
      category: category || 'general',
      priority: priority || 'medium',
      status: 'open',
    });

    res.status(201).json({ success: true, data: ticket });
  } catch (error) {
    next(error);
  }
};

/**
 * Get tickets for the logged-in user (with pagination and status filter)
 */
exports.getMyTickets = async (req, res, next) => {
  try {
    const { page, limit, status } = req.query;
    const { offset, limit: lim } = getPagination(page, limit);

    const where = { userId: req.user.id };
    if (status) where.status = status;

    const data = await Ticket.findAndCountAll({
      where,
      include: [
        {
          model: TicketReply,
          attributes: ['id', 'message', 'createdAt', 'isInternal'],
          include: [{ model: User, attributes: ['id', 'name', 'role'] }],
        },
      ],
      order: [['createdAt', 'DESC']],
      offset,
      limit: lim,
    });

    const paginated = getPagingData(data, page, lim);
    res.status(200).json({ success: true, data: paginated });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single ticket by ID with replies (author or admin)
 */
exports.getTicketById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const ticket = await Ticket.findByPk(id, {
      include: [
        {
          model: TicketReply,
          include: [{ model: User, attributes: ['id', 'name', 'role'] }],
          order: [['createdAt', 'ASC']],
        },
        { model: User, attributes: ['id', 'name', 'mobile', 'role'] },
      ],
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Authorization: only the ticket owner or admin can view
    if (req.user.role !== USER_ROLES.ADMIN && ticket.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.status(200).json({ success: true, data: ticket });
  } catch (error) {
    next(error);
  }
};

/**
 * Reply to a ticket (authenticated user/worker or admin)
 */
exports.replyToTicket = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { message, isInternal } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Reply message is required' });
    }

    const ticket = await Ticket.findByPk(id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Only the ticket owner or admin can reply
    if (req.user.role !== USER_ROLES.ADMIN && ticket.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // If admin, they can mark reply as internal
    const internal = req.user.role === USER_ROLES.ADMIN && isInternal === true;

    const reply = await TicketReply.create({
      ticketId: ticket.id,
      userId: req.user.id,
      message,
      isInternal: internal,
    });

    // If admin replies, update ticket status to 'in-progress'
    if (req.user.role === USER_ROLES.ADMIN && ticket.status === 'open') {
      await ticket.update({ status: 'in-progress' });
    }

    // If the ticket owner replies to an in-progress ticket, keep it in-progress
    // If the ticket was resolved and the owner replies, set back to in-progress
    if (req.user.role !== USER_ROLES.ADMIN && ticket.status === 'resolved') {
      await ticket.update({ status: 'in-progress' });
    }

    // Fetch the updated ticket with replies to return
    const updatedTicket = await Ticket.findByPk(id, {
      include: [
        {
          model: TicketReply,
          include: [{ model: User, attributes: ['id', 'name', 'role'] }],
        },
      ],
    });

    res.status(201).json({ success: true, data: updatedTicket });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Update ticket status
 */
exports.updateTicketStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, assignedTo } = req.body;

    const ticket = await Ticket.findByPk(id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Only admin can change status
    if (req.user.role !== USER_ROLES.ADMIN) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const updates = { status };
    if (assignedTo) {
      const admin = await User.findByPk(assignedTo);
      if (!admin || admin.role !== USER_ROLES.ADMIN) {
        return res.status(400).json({ error: 'Invalid admin user' });
      }
      updates.assignedTo = assignedTo;
    }

    // If status is resolved or closed, set resolvedAt
    if (status === 'resolved' || status === 'closed') {
      updates.resolvedAt = new Date();
    } else {
      // If reopening, clear resolvedAt
      updates.resolvedAt = null;
    }

    await ticket.update(updates);

    res.status(200).json({ success: true, data: ticket });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Get all tickets (with filters)
 */
exports.getAllTickets = async (req, res, next) => {
  try {
    const { page, limit, status, priority, userId, category, fromDate, toDate } = req.query;
    const { offset, limit: lim } = getPagination(page, limit);

    const where = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (userId) where.userId = userId;
    if (category) where.category = category;
    if (fromDate && toDate) {
      where.createdAt = { [Op.between]: [fromDate, toDate] };
    } else if (fromDate) {
      where.createdAt = { [Op.gte]: fromDate };
    } else if (toDate) {
      where.createdAt = { [Op.lte]: toDate };
    }

    const data = await Ticket.findAndCountAll({
      where,
      include: [
        { model: User, attributes: ['id', 'name', 'mobile', 'role'] },
        {
          model: TicketReply,
          attributes: ['id', 'message', 'createdAt', 'isInternal'],
          include: [{ model: User, attributes: ['id', 'name', 'role'] }],
          separate: true, // avoid duplicate replies in count
          order: [['createdAt', 'ASC']],
        },
      ],
      order: [['createdAt', 'DESC']],
      offset,
      limit: lim,
    });

    const paginated = getPagingData(data, page, lim);
    res.status(200).json({ success: true, data: paginated });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Assign a ticket to an admin (or self)
 */
exports.assignTicket = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { adminId } = req.body;

    const ticket = await Ticket.findByPk(id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    let adminUser;
    if (adminId) {
      adminUser = await User.findByPk(adminId);
      if (!adminUser || adminUser.role !== USER_ROLES.ADMIN) {
        return res.status(400).json({ error: 'Invalid admin user' });
      }
    } else {
      // Assign to self (the logged-in admin)
      if (req.user.role !== USER_ROLES.ADMIN) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      adminUser = req.user;
    }

    await ticket.update({ assignedTo: adminUser.id });

    res.status(200).json({ success: true, data: ticket });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Get ticket statistics (summary counts)
 */
exports.getTicketStats = async (req, res, next) => {
  try {
    const total = await Ticket.count();
    const open = await Ticket.count({ where: { status: 'open' } });
    const inProgress = await Ticket.count({ where: { status: 'in-progress' } });
    const resolved = await Ticket.count({ where: { status: 'resolved' } });
    const closed = await Ticket.count({ where: { status: 'closed' } });

    const byPriority = {
      low: await Ticket.count({ where: { priority: 'low' } }),
      medium: await Ticket.count({ where: { priority: 'medium' } }),
      high: await Ticket.count({ where: { priority: 'high' } }),
      urgent: await Ticket.count({ where: { priority: 'urgent' } }),
    };

    res.status(200).json({
      success: true,
      data: {
        total,
        open,
        inProgress,
        resolved,
        closed,
        byPriority,
      },
    });
  } catch (error) {
    next(error);
  }
};