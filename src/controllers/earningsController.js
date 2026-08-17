const { Worker, Job, Payment, Booking } = require('../models');
const { getPagination, getPagingData } = require('../utils/helpers');
const { Op } = require('sequelize');
const { PAYMENT_STATUS, JOB_STATUS } = require('../utils/constants');

/**
 * Get earnings summary for the authenticated worker
 */
exports.getEarningsSummary = async (req, res, next) => {
  try {
    const worker = await Worker.findOne({ where: { userId: req.user.id } });
    if (!worker) {
      return res.status(404).json({ error: 'Worker profile not found' });
    }

    // Get all completed jobs for this worker
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
      // Amount from the booking totalAmount (or fallback to 0)
      const amount = job.Booking ? parseFloat(job.Booking.totalAmount) || 0 : 0;
      if (payment) {
        totalEarned += amount;
      } else {
        pendingPayment += amount;
      }
      completedJobs++;
    }

    // Get total jobs (all statuses except cancelled)
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