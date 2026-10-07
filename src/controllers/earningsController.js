const { Worker, Job, Payment, Booking } = require('../models');
const { getPagination, getPagingData } = require('../utils/helpers');
const { PAYMENT_STATUS, JOB_STATUS } = require('../utils/constants');
const { Op, fn, col, literal } = require('sequelize');

// Helper to get period start
const startOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const startOfWeek = (d = new Date()) => {
  // Monday as start of week
  const x = new Date(d);
  const day = x.getDay(); // 0=Sun
  const diff = (day + 6) % 7; // days since Monday
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
};

const startOfMonth = (d = new Date()) => {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
};
/**
 * Get earnings summary for the authenticated worker
 */
exports.getEarningsSummary = async (req, res, next) => {
  try {
    const worker = await Worker.findOne({ where: { userId: req.user.id } });
    if (!worker) return res.status(404).json({ error: 'Worker profile not found' });

    // All completed jobs for this worker
    const jobs = await Job.findAll({
      where: { workerId: worker.id, status: JOB_STATUS.COMPLETED },
      include: [{ model: Booking }],
      order: [['completedAt', 'DESC']],
    });

    // Total jobs (non-cancelled)
    const totalJobs = await Job.count({
      where: { workerId: worker.id, status: { [Op.ne]: JOB_STATUS.CANCELLED } },
    });

    // Batch fetch payments for all these bookings
    const bookingIds = jobs.map(j => j.bookingId).filter(Boolean);
    const payments = bookingIds.length
      ? await Payment.findAll({
          where: {
            bookingId: { [Op.in]: bookingIds },
            status: { [Op.in]: ['paid', 'success'] },
          },
        })
      : [];

    const paidBookingIds = new Set(payments.map(p => p.bookingId));

    // Time boundaries
    const now = new Date();
    const dayStart = startOfDay(now);
    const weekStart = startOfWeek(now);
    const monthStart = startOfMonth(now);

    const emptyBucket = () => ({
      totalEarned: 0,
      pendingPayment: 0,
      completedJobs: 0,
    });

    const buckets = {
      day: emptyBucket(),
      week: emptyBucket(),
      month: emptyBucket(),
      allTime: emptyBucket(),
    };

    for (const job of jobs) {
      const completedAt = job.completedAt || job.updatedAt || job.createdAt;
      const amount = parseFloat(job.Booking?.totalAmount) || 0;
      const isPaid = paidBookingIds.has(job.bookingId);

      const apply = (b) => {
        b.completedJobs += 1;
        if (isPaid) b.totalEarned += amount;
        else b.pendingPayment += amount;
      };

      apply(buckets.allTime);
      if (completedAt >= monthStart) apply(buckets.month);
      if (completedAt >= weekStart) apply(buckets.week);
      if (completedAt >= dayStart) apply(buckets.day);
    }

    // Round to 2 decimals
    const round = (n) => Math.round(n * 100) / 100;
    for (const k of Object.keys(buckets)) {
      buckets[k].totalEarned = round(buckets[k].totalEarned);
      buckets[k].pendingPayment = round(buckets[k].pendingPayment);
    }

    res.status(200).json({
      success: true,
      data: {
        periods: buckets,
        totalJobs,
        // Backward-compat flat fields (all-time)
        totalEarned: buckets.allTime.totalEarned,
        pendingPayment: buckets.allTime.pendingPayment,
        completedJobs: buckets.allTime.completedJobs,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get detailed earnings history with pagination and date filters
 */
exports.getEarningsHistory = async (req, res, next) => {
  try {
    const { page, limit, fromDate, toDate } = req.query;
    const { offset, limit: lim } = getPagination(page, limit);
    console.log("user::",req.user.id)
    const worker = await Worker.findOne({ where: { userId: req.user.id } });
    if (!worker) {
      return res.status(404).json({ error: 'Worker profile not found' });
    }

    const where = { workerId: worker.id, status: JOB_STATUS.COMPLETED };
    if (fromDate && toDate) {
      where.completedAt = { [Op.between]: [new Date(fromDate), new Date(toDate)] };
    } else if (fromDate) {
      where.completedAt = { [Op.gte]: new Date(fromDate) };
    } else if (toDate) {
      where.completedAt = { [Op.lte]: new Date(toDate) };
    }

    const data = await Job.findAndCountAll({
      where,
      include: [
        {
          model: Booking,
          include: [
            { model: Payment },
          ],
        },
      ],
      order: [['completedAt', 'DESC']],
      offset,
      limit: lim,
    });

    // Process each job to add payment status and amount
    const items = data.rows.map(job => {
      const payment = job.Booking?.Payment;
      const amount = job.Booking ? parseFloat(job.Booking.totalAmount) || 0 : 0;
      return {
        jobId: job.id,
        bookingId: job.bookingId,
        amount,
        completedAt: job.completedAt,
        paymentStatus: payment ? payment.status : 'pending',
        paymentId: payment ? payment.id : null,
        serviceName: job.Booking?.Service?.name || 'Unknown service',
      };
    });

    const paginated = {
      totalItems: data.count,
      items,
      totalPages: Math.ceil(data.count / lim),
      currentPage: parseInt(page) || 1,
      itemsPerPage: lim,
    };

    res.status(200).json({ success: true, data: paginated });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Get earnings summary for a specific worker
 */
exports.getWorkerEarningsSummary = async (req, res, next) => {
  try {
    const { workerId } = req.params;
    const worker = await Worker.findByPk(workerId);
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' });
    }

    // Re-use the same logic as the worker's own summary but for a specific worker
    const jobs = await Job.findAll({
      where: { workerId: worker.id, status: JOB_STATUS.COMPLETED },
      include: [{ model: Booking }],
    });

    let totalEarned = 0;
    let pendingPayment = 0;
    let completedJobs = 0;

    for (const job of jobs) {
      const payment = await Payment.findOne({
        where: { bookingId: job.bookingId, status: PAYMENT_STATUS.PAID },
      });
      const amount = job.Booking ? parseFloat(job.Booking.totalAmount) || 0 : 0;
      if (payment) {
        totalEarned += amount;
      } else {
        pendingPayment += amount;
      }
      completedJobs++;
    }

    const totalJobs = await Job.count({
      where: { workerId: worker.id, status: { [Op.ne]: JOB_STATUS.CANCELLED } },
    });

    res.status(200).json({
      success: true,
      data: {
        totalEarned,
        pendingPayment,
        completedJobs,
        totalJobs,
        worker: {
          id: worker.id,
          profession: worker.profession,
          name: (await worker.getUser())?.name || 'Unknown',
        },
      },
    });
  } catch (error) {
    next(error);
  }
};