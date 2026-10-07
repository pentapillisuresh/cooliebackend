const { Op } = require('sequelize');
const { Worker, User, WithdrawalRequest } = require('../models');

// ── POST /api/withdrawals ───────────────────────────────────────────
exports.createWithdrawal = async (req, res, next) => {
  try {
    const { amount, bankAccountName, bankAccountNumber, bankIfsc, upiId, notes } = req.body;

    const worker = await Worker.findOne({ where: { userId: req.user.id } });
    if (!worker) return res.status(404).json({ error: 'Worker profile not found' });

    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt < 100) {
      return res.status(400).json({ error: 'Minimum withdrawal amount is ₹100' });
    }

    const balance = parseFloat(user.wallet) || 0;
    if (amt > balance) {
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }

    // Block a second pending request so admins don't double-pay
    const existingPending = await WithdrawalRequest.findOne({
      where: { workerId: worker.id, status: 'pending' },
    });
    if (existingPending) {
      return res.status(409).json({
        error: 'You already have a pending withdrawal request',
        requestId: existingPending.id,
      });
    }

    // Require payout details on file
    if (!upiId && !(bankAccountNumber && bankIfsc && bankAccountName)) {
      return res.status(400).json({
        error: 'Provide UPI ID or full bank account details',
      });
    }

    // Move the balance out of the wallet immediately so it can't be
    // double-spent. Refund on rejection.
    await user.update({ wallet: balance - amt });

    const request = await WithdrawalRequest.create({
      workerId: worker.id,
      userId: req.user.id,
      amount: amt,
      bankAccountName: bankAccountName || null,
      bankAccountNumber: bankAccountNumber || null,
      bankIfsc: bankIfsc || null,
      upiId: upiId || null,
      notes: notes || null,
      status: 'pending',
    });

    return res.status(201).json({ success: true, data: request });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/withdrawals ────────────────────────────────────────────
exports.listWithdrawals = async (req, res, next) => {
  try {
    const worker = await Worker.findOne({ where: { userId: req.user.id } });
    if (!worker) return res.status(404).json({ error: 'Worker profile not found' });

    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const offset = (page - 1) * limit;

    const { count, rows } = await WithdrawalRequest.findAndCountAll({
      where: { workerId: worker.id },
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return res.json({
      success: true,
      data: {
        totalItems: count,
        items: rows,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        itemsPerPage: limit,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/withdrawals/:id ────────────────────────────────────────
exports.getWithdrawal = async (req, res, next) => {
  try {
    const worker = await Worker.findOne({ where: { userId: req.user.id } });
    if (!worker) return res.status(404).json({ error: 'Worker profile not found' });

    const request = await WithdrawalRequest.findOne({
      where: { id: req.params.id, workerId: worker.id },
    });
    if (!request) return res.status(404).json({ error: 'Withdrawal not found' });

    return res.json({ success: true, data: request });
  } catch (err) {
    next(err);
  }
};

// ── (Admin) PATCH /api/withdrawals/:id ──────────────────────────────
// status: 'approved' | 'rejected' | 'completed'
exports.updateWithdrawalStatus = async (req, res, next) => {
  try {
    const { status, transactionRef, rejectionReason } = req.body;
    if (!['approved', 'rejected', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const request = await WithdrawalRequest.findByPk(req.params.id);
    if (!request) return res.status(404).json({ error: 'Not found' });

    if (request.status === 'completed' || request.status === 'rejected') {
      return res.status(409).json({ error: 'Already finalized' });
    }

    if (status === 'rejected') {
      // Refund the wallet
      const user = await User.findByPk(request.userId);
      if (user) {
        const balance = parseFloat(user.wallet) || 0;
        await user.update({ wallet: balance + parseFloat(request.amount) });
      }
    }

    await request.update({
      status,
      transactionRef: transactionRef || request.transactionRef,
      rejectionReason: rejectionReason || request.rejectionReason,
      processedAt: new Date(),
      processedBy: req.user?.id || null,
    });

    return res.json({ success: true, data: request });
  } catch (err) {
    next(err);
  }
};