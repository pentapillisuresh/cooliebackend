const { Booking, Service, User, Worker, Job, Payment, Category, Address } = require('../models');
const { BOOKING_STATUS, PAYMENT_STATUS, JOB_STATUS } = require('../utils/constants');
const { generateRandomString, formatResponse, getPagination, getPagingData } = require('../utils/helpers');
const { Op } = require('sequelize');
const { createNotification } = require('./notificationController');
const { assignWorkerToBooking } = require('../utils/workerAssignment');

/**
 * Create a new booking
 */
exports.createBooking = async (req, res, next) => {
  try {
    const {
      serviceId,
      details,
      address,
      addressId,
      latitude,
      longitude,
      scheduledDate,
      scheduledTime,
      estimatedArrival,
      specialInstructions,
      servicePrice,
      GST,
      convenianceCharges,
      discountAmount,
      totalAmount,
      groupId, // optional: for group bookings
    } = req.body;

    let finalAddress = address;
    let finalLat = latitude;
    let finalLng = longitude;

    // Validate service exists
    const service = await Service.findByPk(serviceId);
    if (!service) {
      return res.status(400).json({ error: 'Invalid service' });
    }


    if (addressId && (!address || !latitude || !longitude)) {
      const saved = await Address.findOne({
        where: { id: addressId, userId: req.user.id },
      });
      if (saved) {
        finalAddress = saved.addressLine;
        finalLat = saved.latitude;
        finalLng = saved.longitude;
      }
    }
    // Calculate total amount if not provided
    let finalAmount = totalAmount || service.basePrice || 0;

    // Create booking
    const booking = await Booking.create({
      userId: req.user.id,
      serviceId,
      details: details || {},
      addressId: addressId || null,
      address: finalAddress,
      latitude: finalLat,
      longitude: finalLng,
      scheduledDate,
      scheduledTime,
      estimatedArrival,
      specialInstructions,
      servicePrice,
      GST,
      convenianceCharges,
      discountAmount,
      totalAmount: finalAmount,
      groupId: groupId || null,
      status: BOOKING_STATUS.PENDING,
      paymentStatus: PAYMENT_STATUS.PENDING,
    });
    const location = { latitude, longitude }
    try {
      const service = await Service.findByPk(serviceId, { include: [{ model: Category }] });
      console.log("serviceId::", serviceId)
      const job = await assignWorkerToBooking(booking, service, location);
      if (job) {
        console.log(`✅ Worker ${job.workerId} auto-assigned to booking ${booking.id}`);
      } else {
        console.log(`⚠️ No available worker for booking ${booking.id}`);
      }
    } catch (error) {
      console.error('Auto-assignment error:', error);
    }

    // (could be added here)

    res.status(201).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    console.error('❌ Booking creation error:');
    console.error('Message:', error.message);
    console.error('Name:', error.name);
    console.error('SQL:', error.sql);
    console.error('Original error:', error.original);
    console.error('Parent error:', error.parent);
    console.error('Stack:', error.stack);

    next(error);
  }
};

/**
 * Get all bookings for the authenticated user (with pagination)
 */
exports.getMyBookings = async (req, res, next) => {
  try {
    const { page, limit, status } = req.query;
    const { offset, limit: lim } = getPagination(page, limit);

    const where = { userId: req.user.id };
    if (status) {
      where.status = status;
    }

    const data = await Booking.findAndCountAll({
      where,
      include: [
        { model: Service, include: [{ model: Category }] },
        { model: Job, include: [{ model: Worker, include: [{ model: User, attributes: ['id', 'name', 'mobile'] }] }] },
        { model: Payment },
      ],
      order: [['scheduledDate', 'DESC'], ['scheduledTime', 'DESC']],
      offset,
      limit: lim,
    });

    const paginated = getPagingData(data, page, lim);

    res.status(200).json({
      success: true,
      data: paginated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single booking by ID (with full details)
 */
exports.getBookingById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findByPk(id, {
      include: [
        { model: Service, include: [{ model: Category }] },
        {
          model: Job,
          include: [
            {
              model: Worker,
              include: [{ model: User, attributes: ['id', 'name', 'mobile'] }],
            },
          ],
        },
        { model: Payment },
        { model: User, attributes: ['id', 'name', 'mobile'] },
      ],
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Authorization: only owner or admin
    if (req.user.role !== 'admin' && booking.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a booking (only if pending or postponed)
 */
exports.updateBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const booking = await Booking.findByPk(id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Authorization
    if (req.user.role !== 'admin' && booking.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Can only update if pending or postponed
    if (![BOOKING_STATUS.PENDING, BOOKING_STATUS.POSTPONED].includes(booking.status)) {
      return res.status(400).json({ error: 'Booking cannot be modified in its current state' });
    }

    // Prevent changing status via this endpoint (use dedicated endpoints)
    delete updates.status;

    await booking.update(updates);

    res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel a booking (soft delete) – only if not started/completed
 */
exports.cancelBooking = async (req, res, next) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findByPk(id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Authorization
    if (req.user.role !== 'admin' && booking.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Cannot cancel if already in progress, completed, or payment pending
    if ([
      BOOKING_STATUS.IN_PROGRESS,
      BOOKING_STATUS.COMPLETED,
      BOOKING_STATUS.PAYMENT_PENDING,
    ].includes(booking.status)) {
      return res.status(400).json({ error: 'Cannot cancel a booking that is already in progress or completed' });
    }

    // Cancel the booking
    await booking.update({ status: BOOKING_STATUS.CANCELLED });

    // Also cancel the associated job if exists and not completed
    const job = await Job.findOne({ where: { bookingId: booking.id } });
    if (job && ![JOB_STATUS.COMPLETED, JOB_STATUS.CANCELLED].includes(job.status)) {
      await job.update({ status: JOB_STATUS.CANCELLED });
    }

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Assign a worker to a booking (creates a job)
 */
exports.assignWorker = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { workerId } = req.body;

    if (!workerId) {
      return res.status(400).json({ error: 'Worker ID is required' });
    }

    // Check booking exists and is pending
    const booking = await Booking.findByPk(id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.status !== BOOKING_STATUS.PENDING) {
      return res.status(400).json({ error: 'Booking is not in pending state' });
    }

    // Check worker exists and is verified
    const worker = await Worker.findOne({ where: { id: workerId, isVerified: true } });
    if (!worker) {
      return res.status(404).json({ error: 'Verified worker not found' });
    }

    // Check if job already exists
    const existingJob = await Job.findOne({ where: { bookingId: booking.id } });
    if (existingJob) {
      return res.status(400).json({ error: 'A job is already assigned to this booking' });
    }

    // Create job
    const job = await Job.create({
      bookingId: booking.id,
      workerId: worker.id,
      status: JOB_STATUS.ASSIGNED,
      assignedAt: new Date(),
    });

    await createNotification(
      worker.userId,
      'New Job Assigned',
      `You have been assigned a new job for booking #${booking.id}.`,
      {
        bookingId: booking.id,
        jobId: job.id,
        type: 'job_assigned',
      },
      'job'
    );

    // Update booking status to accepted
    await booking.update({ status: BOOKING_STATUS.ACCEPTED });

    // (Optional) Send push notification to worker

    res.status(201).json({
      success: true,
      data: job,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Get all bookings (with filters and pagination)
 */
exports.getAllBookings = async (req, res, next) => {
  try {
    const { page, limit, status, userId, serviceId, fromDate, toDate } = req.query;
    const { offset, limit: lim } = getPagination(page, limit);

    const where = {};
    if (status) where.status = status;
    if (userId) where.userId = userId;
    if (serviceId) where.serviceId = serviceId;
    if (fromDate && toDate) {
      where.scheduledDate = { [Op.between]: [fromDate, toDate] };
    } else if (fromDate) {
      where.scheduledDate = { [Op.gte]: fromDate };
    } else if (toDate) {
      where.scheduledDate = { [Op.lte]: toDate };
    }

    const data = await Booking.findAndCountAll({
      where,
      include: [
        { model: User, attributes: ['id', 'name', 'mobile'] },
        { model: Service, include: [{ model: Category }] },
        { model: Job, include: [{ model: Worker, include: [{ model: User, attributes: ['id', 'name', 'mobile'] }] }] },
        { model: Payment },
      ],
      order: [['createdAt', 'DESC']],
      offset,
      limit: lim,
    });

    const paginated = getPagingData(data, page, lim);

    res.status(200).json({
      success: true,
      data: paginated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * User: Add/update group for a booking (for group bookings)
 */
exports.updateGroup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { groupId } = req.body;

    if (!groupId) {
      return res.status(400).json({ error: 'Group ID is required' });
    }

    const booking = await Booking.findByPk(id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (booking.status !== BOOKING_STATUS.PENDING) {
      return res.status(400).json({ error: 'Can only update group for pending bookings' });
    }

    await booking.update({ groupId });

    res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};

exports.cancelBookingWithReason = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason, reasonDetails } = req.body;

    const booking = await Booking.findByPk(id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (req.user.role !== 'admin' && booking.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if ([
      BOOKING_STATUS.IN_PROGRESS,
      BOOKING_STATUS.COMPLETED,
      BOOKING_STATUS.PAYMENT_PENDING,
    ].includes(booking.status)) {
      return res.status(400).json({ error: 'Cannot cancel a booking in progress or completed' });
    }

    await booking.update({
      status: BOOKING_STATUS.CANCELLED,
      cancellationReason: reason,
      cancelledAt: new Date(),
    });

    const job = await Job.findOne({ where: { bookingId: booking.id } });
    if (job && ![JOB_STATUS.COMPLETED, JOB_STATUS.CANCELLED].includes(job.status)) {
      await job.update({ status: JOB_STATUS.CANCELLED });
    }

    res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};

// ─── NEW: Get booking status timeline ─────────────────────────────────
exports.getBookingTimeline = async (req, res, next) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findByPk(id, {
      include: [
        { model: Job },
        { model: Payment },
        { model: Review },
      ],
    });
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    if (req.user.role !== 'admin' && booking.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Build timeline
    const timeline = [
      { event: 'Booking Created', timestamp: booking.createdAt, status: 'pending' },
    ];
    if (booking.status === 'accepted' || booking.status === 'in-progress') {
      const job = booking.Job;
      if (job) {
        timeline.push({ event: 'Worker Assigned', timestamp: job.assignedAt, status: 'assigned' });
        if (job.startedAt) {
          timeline.push({ event: 'Worker Started', timestamp: job.startedAt, status: 'in-progress' });
        }
      }
    }
    if (booking.status === 'completed' || booking.status === 'payment-pending') {
      const job = booking.Job;
      if (job && job.completedAt) {
        timeline.push({ event: 'Work Completed', timestamp: job.completedAt, status: 'completed' });
      }
    }
    if (booking.Payment && booking.Payment.status === 'paid') {
      timeline.push({ event: 'Payment Completed', timestamp: booking.Payment.paidAt, status: 'paid' });
    }
    if (booking.Review) {
      timeline.push({ event: 'Review Submitted', timestamp: booking.Review.createdAt, status: 'reviewed' });
    }
    if (booking.status === 'cancelled') {
      timeline.push({ event: 'Booking Cancelled', timestamp: booking.updatedAt, status: 'cancelled' });
    }
    res.status(200).json({ success: true, data: timeline });
  } catch (error) {
    next(error);
  }
};

// ─── NEW: Admin reassign worker ───────────────────────────────────────
exports.reassignWorker = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { workerId } = req.body;

    if (!workerId) {
      return res.status(400).json({ error: 'Worker ID is required' });
    }

    const booking = await Booking.findByPk(id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.status === BOOKING_STATUS.COMPLETED ||
      booking.status === BOOKING_STATUS.PAYMENT_PENDING ||
      booking.status === BOOKING_STATUS.CANCELLED) {
      return res.status(400).json({ error: 'Cannot reassign a completed or cancelled booking' });
    }

    const worker = await Worker.findOne({ where: { id: workerId, isVerified: true } });
    if (!worker) {
      return res.status(404).json({ error: 'Verified worker not found' });
    }

    let job = await Job.findOne({ where: { bookingId: booking.id } });
    if (job) {
      await job.update({
        workerId: worker.id,
        status: JOB_STATUS.ASSIGNED,
        assignedAt: new Date(),
        startedAt: null,
        completedAt: null,
        confirmationOtp: null,
        otpExpiry: null,
      });
    } else {
      job = await Job.create({
        bookingId: booking.id,
        workerId: worker.id,
        status: JOB_STATUS.ASSIGNED,
        assignedAt: new Date(),
      });

      await createNotification(
        worker.userId,
        'New Job Assigned',
        `You have been assigned a new job for booking #${booking.id}.`,
        {
          bookingId: booking.id,
          jobId: job.id,
          type: 'job_assigned',
        },
        'job'
      );

    }

    await booking.update({ status: BOOKING_STATUS.ACCEPTED });

    res.status(200).json({ success: true, data: { booking, job } });
  } catch (error) {
    next(error);
  }
};