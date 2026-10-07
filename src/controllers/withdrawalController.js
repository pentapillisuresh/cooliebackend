// controllers/withdrawalController.js
const { Op, fn, col } = require('sequelize');
const { Worker, Job, Booking, Payment, WithdrawalRequest } = require('../models');
const { JOB_STATUS, PAYMENT_STATUS } = require('../utils/constants');

/**
 * Available wallet balance for a worker.
 *
 *   earned    = SUM(Payment.amount) for payments on this worker's jobs
 *   withdrawn = SUM(WithdrawalRequest.amount) where status in
 *               (pending, approved, completed)   // rejected = refunded
 *   balance   = earned - withdrawn
 */
const getWorkerBalance = async (workerId) => {
    // 1. Which bookings belong to this worker?
    const jobs = await Job.findAll({
        where: { workerId },
        attributes: ['bookingId'],
        raw: true,
    });
    const bookingIds = jobs.map((j) => j.bookingId).filter(Boolean);

    let earned = 0;
    if (bookingIds.length) {
        const paymentTotal = await Payment.findOne({
            attributes: [[fn('SUM', col('amount')), 'total']],
            where: {
                bookingId: { [Op.in]: bookingIds },
                status: { [Op.in]: [PAYMENT_STATUS.PAID, 'success'] },
            },
            raw: true,
        });
        earned = parseFloat(paymentTotal?.total) || 0;
    }

    // 2. Sum withdrawals that have already left the wallet
    const withdrawalTotal = await WithdrawalRequest.findOne({
        attributes: [[fn('SUM', col('amount')), 'total']],
        where: {
            workerId,
            status: { [Op.in]: ['pending', 'approved', 'completed'] },
        },
        raw: true,
    });
    const withdrawn = parseFloat(withdrawalTotal?.total) || 0;

    return Math.max(0, earned - withdrawn);
};

module.exports.getWorkerBalance = getWorkerBalance;

// ── POST /api/withdrawals ───────────────────────────────────────────
exports.createWithdrawal = async (req, res, next) => {
    try {
        const { amount, bankAccountName, bankAccountNumber, bankIfsc, upiId, notes } = req.body;

        const worker = await Worker.findOne({ where: { userId: req.user.id } });
        if (!worker) return res.status(404).json({ error: 'Worker profile not found' });

        const amt = parseFloat(amount);
        if (!Number.isFinite(amt) || amt < 100) {
            return res.status(400).json({ error: 'Minimum withdrawal amount is ₹100' });
        }

        // ✅ compute balance instead of reading user.wallet
        const balance = await getWorkerBalance(worker.id);
        if (amt > balance) {
            return res.status(400).json({
                error: 'Insufficient wallet balance',
                available: balance,
            });
        }

        // Block concurrent pending requests
        const existingPending = await WithdrawalRequest.findOne({
            where: { workerId: worker.id, status: 'pending' },
        });
        if (existingPending) {
            return res.status(409).json({
                error: 'You already have a pending withdrawal request',
                requestId: existingPending.id,
            });
        }

        if (!upiId && !(bankAccountNumber && bankIfsc && bankAccountName)) {
            return res.status(400).json({ error: 'Provide UPI ID or full bank account details' });
        }

        // ✅ No user.update({ wallet }) anymore — the balance is derived.
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

        return res.status(201).json({
            success: true,
            data: { request, balance: balance - amt },
        });
    } catch (err) {
        next(err);
    }
};
// ── GET /api/withdrawals ────────────────────────────────────────────
exports.listWithdrawals = async (req, res, next) => {
    try {
        const worker = await Worker.findOne({ where: { userId: req.user.id } });
        if (!worker) return res.status(404).json({ error: 'Worker profile not found' });

        const page = Math.max(1, parseInt(req.query.page) || 1);
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