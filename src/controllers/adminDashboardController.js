const { Op, fn, col, literal } = require('sequelize');
const { User, Worker, Booking, Job, sequelize } = require('../models');
const { BOOKING_STATUS, JOB_STATUS } = require('../utils/constants');

exports.getDashboardStats = async (req, res, next) => {
  try {
    // ─── 1. Top Level Counts ───────────────────────────────────────
    const totalUsers = await User.count({ where: { role: 'customer' } });
    const totalWorkers = await Worker.count();
    const totalBookings = await Booking.count();

    // ─── 2. Revenue ────────────────────────────────────────────────
    const revenueResult = await Booking.findOne({
      attributes: [[fn('SUM', col('totalAmount')), 'totalRevenue']],
      where: { paymentStatus: 'paid' }, // Assuming 'paid' is the success status
      raw: true,
    });
    const totalRevenue = parseFloat(revenueResult?.totalRevenue) || 0;

    // ─── 3. Status-Based Counts (Total) ────────────────────────────
    const pendingBookings = await Booking.count({
      where: { status: { [Op.in]: ['pending', 'confirmed', 'assigned', 'accepted'] } },
    });
    const completedBookings = await Booking.count({
      where: { status: 'completed' },
    });
    const cancelledBookings = await Booking.count({
      where: { status: 'cancelled' },
    });

    // ─── 4. Today's Bookings ───────────────────────────────────────
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const todaysBookings = await Booking.count({
      where: {
        createdAt: { [Op.between]: [startOfDay, endOfDay] },
      },
    });

    // ─── 5. Revenue Overview (Last 6 Months) ───────────────────────
    // Note: This query is MySQL specific. For Postgres, use DATE_TRUNC
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const revenueOverview = await Booking.findAll({
      attributes: [
        [fn('DATE_FORMAT', col('createdAt'), '%Y-%m'), 'month'],
        [fn('SUM', col('totalAmount')), 'revenue'],
      ],
      where: {
        paymentStatus: 'paid',
        createdAt: { [Op.gte]: sixMonthsAgo },
      },
      group: [literal("DATE_FORMAT(createdAt, '%Y-%m')")],
      order: [[literal("DATE_FORMAT(createdAt, '%Y-%m')"), 'ASC']],
      raw: true,
    });

    // ─── 6. Booking Trends (Last 7 Days) ──────────────────────────
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const bookingTrends = await Booking.findAll({
      attributes: [
        [fn('DATE', col('createdAt')), 'date'],
        [fn('COUNT', col('id')), 'count'],
      ],
      where: {
        createdAt: { [Op.gte]: sevenDaysAgo },
      },
      group: [literal('DATE(createdAt)')],
      order: [[literal('DATE(createdAt)'), 'ASC']],
      raw: true,
    });

    // ─── 7. Recent Bookings (for the table at the bottom) ─────────
    const recentBookings = await Booking.findAll({
      limit: 5,
      order: [['createdAt', 'DESC']],
      include: [
        { model: User, as: 'User', attributes: ['name', 'mobile'] },
        { model: Job, attributes: ['status', 'workerId'] }, // Adjust alias if needed
      ],
    });

    // ─── Response ──────────────────────────────────────────────────
    return res.status(200).json({
      success: true,
      data: {
        cards: {
          totalUsers,
          totalWorkers,
          totalBookings,
          totalRevenue,
          todaysBookings,
          pendingBookings,
          completedBookings,
          cancelledBookings,
        },
        charts: {
          revenueOverview,
          bookingTrends,
        },
        recentBookings,
      },
    });
  } catch (error) {
    console.error('Admin Dashboard Error:', error);
    next(error);
  }
};