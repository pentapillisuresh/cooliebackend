const { Job, Booking, Worker, User, Service, Category } = require('../models');
const { JOB_STATUS, BOOKING_STATUS } = require('../utils/constants');
const { generateOTP, isOTPExpired, formatResponse } = require('../utils/helpers');
const { Op } = require('sequelize');
const { createNotification } = require('./notificationController');

/**
 * Helper: Get worker from authenticated user
 */
const getWorkerFromUser = async (userId) => {
  const worker = await Worker.findOne({ where: { userId } });
  if (!worker) {
    throw new Error('Worker profile not found');
  }
  return worker;
};

/**
 * Get all jobs assigned to the authenticated worker (with filters)
 */
exports.getMyJobs = async (req, res, next) => {
  try {
    const worker = await getWorkerFromUser(req.user.id);
    const { status, page, limit } = req.query;
    const { offset, limit: lim } = require('../utils/helpers').getPagination(page, limit);

    const where = { workerId: worker.id };
    if (status) where.status = status;

    const data = await Job.findAndCountAll({
      where,
      include: [
        {
          model: Booking,
          include: [
            { model: User, attributes: ['id', 'name', 'mobile'] },
            { model: Service, include: [{ model: Category }] },
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
      offset,
      limit: lim,
    });

    const paginated = require('../utils/helpers').getPagingData(data, page, lim);

    res.status(200).json({
      success: true,
      data: paginated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a specific job by ID with full details
 */
exports.getJobById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const worker = await getWorkerFromUser(req.user.id);

    const job = await Job.findByPk(id, {
      include: [
        {
          model: Booking,
          include: [
            { model: User, attributes: ['id', 'name', 'mobile'] },
            { model: Service, include: [{ model: Category }] },
          ],
        },
        { model: Worker, include: [{ model: User, attributes: ['id', 'name', 'mobile'] }] },
      ],
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Authorization: only the assigned worker or admin
    if (req.user.role !== 'admin' && job.workerId !== worker.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.status(200).json({
      success: true,
      data: job,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Accept a job (worker) – changes status to ARRIVED and generates OTP
 */
exports.acceptJob = async (req, res, next) => {
  try {
    const { id } = req.params;
    const worker = await getWorkerFromUser(req.user.id);

    const job = await Job.findByPk(id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Check authorization
    if (job.workerId !== worker.id) {
      return res.status(403).json({ error: 'This job is not assigned to you' });
    }

    // Can only accept if assigned
    if (job.status !== JOB_STATUS.ASSIGNED) {
      return res.status(400).json({ error: 'Job is not in assigned state' });
    }

    // Generate OTP for mutual confirmation
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await job.update({
      status: JOB_STATUS.ARRIVED,
      startedAt: new Date(),
      confirmationOtp: otp,
      otpExpiry,
    });

    // Update booking status to accepted
    await Booking.update({ status: BOOKING_STATUS.ACCEPTED }, { where: { id: job.bookingId } });

    await createNotification(
      id,
      'Worker Accepted',
      `Your booking #${job.bookingId} has been accepted by the worker.`,
      { bookingId: job.bookingId },
      'booking'
    );
    res.status(200).json({
      success: true,
      data: job,
      // In development, return OTP for testing
      ...(process.env.NODE_ENV === 'development' && { otp }),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark job as arrived at location (worker) – for transport/railway: train arrived
 */
exports.arriveAtLocation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { latitude, longitude } = req.body;
    const worker = await getWorkerFromUser(req.user.id);

    const job = await Job.findByPk(id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.workerId !== worker.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Can mark arrived if assigned or already arrived
    if (![JOB_STATUS.ASSIGNED, JOB_STATUS.ARRIVED].includes(job.status)) {
      return res.status(400).json({ error: 'Job cannot be marked as arrived' });
    }

    await job.update({
      status: JOB_STATUS.ARRIVED,
      workerLatitude: latitude || job.workerLatitude,
      workerLongitude: longitude || job.workerLongitude,
    });

    await createNotification(
      id,
      'Worker Arrived',
      `The worker has arrived for your booking #${job.bookingId}`,
      { bookingId: job.bookingId },
      'booking'
    );
    
    res.status(200).json({
      success: true,
      data: job,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Confirm OTP (mutual confirmation) – worker and passenger
 */
exports.confirmOTP = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { otp } = req.body;
    const worker = await getWorkerFromUser(req.user.id);

    const job = await Job.findByPk(id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.workerId !== worker.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Must be in arrived state
    if (job.status !== JOB_STATUS.ARRIVED) {
      return res.status(400).json({ error: 'Job is not in arrived state' });
    }

    // Check OTP
    if (job.confirmationOtp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    if (isOTPExpired(job.otpExpiry)) {
      return res.status(400).json({ error: 'OTP has expired' });
    }

    // Clear OTP and move to in-progress
    await job.update({
      status: JOB_STATUS.IN_PROGRESS,
      confirmationOtp: null,
      otpExpiry: null,
    });

    // Update booking status
    await Booking.update({ status: BOOKING_STATUS.IN_PROGRESS }, { where: { id: job.bookingId } });

    res.status(200).json({
      success: true,
      message: 'OTP confirmed successfully',
      data: job,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Complete a job (worker)
 */
exports.completeJob = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { afterPhotos, notes } = req.body;
    const worker = await getWorkerFromUser(req.user.id);

    const job = await Job.findByPk(id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.workerId !== worker.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Must be in-progress
    if (job.status !== JOB_STATUS.IN_PROGRESS) {
      return res.status(400).json({ error: 'Job is not in progress' });
    }

    // Update job
    await job.update({
      status: JOB_STATUS.COMPLETED,
      completedAt: new Date(),
      afterPhotos: afterPhotos || job.afterPhotos,
      notes: notes || job.notes,
    });

    // Update booking to payment-pending
    await Booking.update({ status: BOOKING_STATUS.PAYMENT_PENDING }, { where: { id: job.bookingId } });

    // Increment worker's total jobs count
    await worker.increment('totalJobs');

    // (Optional) Calculate rating later

    res.status(200).json({
      success: true,
      data: job,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload before/after photos (using multer middleware)
 * Expects req.uploadedFiles from upload middleware
 */
exports.uploadJobPhotos = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type } = req.query; // 'before' or 'after'
    const worker = await getWorkerFromUser(req.user.id);

    const job = await Job.findByPk(id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.workerId !== worker.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get uploaded file URLs from middleware
    const files = req.uploadedFiles || [];
    if (files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const photoUrls = files.map(f => f.fullUrl);

    // Update appropriate field
    if (type === 'before') {
      job.beforePhotos = [...(job.beforePhotos || []), ...photoUrls];
    } else if (type === 'after') {
      job.afterPhotos = [...(job.afterPhotos || []), ...photoUrls];
    } else {
      return res.status(400).json({ error: 'Invalid type. Use ?type=before or after' });
    }

    await job.save();

    res.status(200).json({
      success: true,
      data: job,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Worker updates their location (for live tracking)
 */
exports.updateLocation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { latitude, longitude } = req.body;
    const worker = await getWorkerFromUser(req.user.id);

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const job = await Job.findByPk(id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.workerId !== worker.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await job.update({
      workerLatitude: latitude,
      workerLongitude: longitude,
    });

    res.status(200).json({
      success: true,
      data: job,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Get all jobs (with filters and pagination)
 */
exports.getAllJobs = async (req, res, next) => {
  try {
    const { page, limit, status, workerId, bookingId, fromDate, toDate } = req.query;
    const { offset, limit: lim } = require('../utils/helpers').getPagination(page, limit);

    const where = {};
    if (status) where.status = status;
    if (workerId) where.workerId = workerId;
    if (bookingId) where.bookingId = bookingId;
    if (fromDate && toDate) {
      where.createdAt = { [Op.between]: [fromDate, toDate] };
    } else if (fromDate) {
      where.createdAt = { [Op.gte]: fromDate };
    } else if (toDate) {
      where.createdAt = { [Op.lte]: toDate };
    }

    const data = await Job.findAndCountAll({
      where,
      include: [
        {
          model: Booking,
          include: [
            { model: User, attributes: ['id', 'name', 'mobile'] },
            { model: Service, include: [{ model: Category }] },
          ],
        },
        { model: Worker, include: [{ model: User, attributes: ['id', 'name', 'mobile'] }] },
      ],
      order: [['createdAt', 'DESC']],
      offset,
      limit: lim,
    });

    const paginated = require('../utils/helpers').getPagingData(data, page, lim);

    res.status(200).json({
      success: true,
      data: paginated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Reassign a job to a different worker
 */
exports.reassignJob = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { workerId } = req.body;

    if (!workerId) {
      return res.status(400).json({ error: 'Worker ID is required' });
    }

    const job = await Job.findByPk(id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Can only reassign if not completed or cancelled
    if ([JOB_STATUS.COMPLETED, JOB_STATUS.CANCELLED].includes(job.status)) {
      return res.status(400).json({ error: 'Cannot reassign a completed or cancelled job' });
    }

    const newWorker = await Worker.findByPk(workerId);
    if (!newWorker || !newWorker.isVerified) {
      return res.status(404).json({ error: 'Verified worker not found' });
    }

    await job.update({
      workerId,
      status: JOB_STATUS.ASSIGNED,
      assignedAt: new Date(),
      startedAt: null,
      completedAt: null,
      confirmationOtp: null,
      otpExpiry: null,
    });

    // Also update booking status back to pending or accepted
    await Booking.update({ status: BOOKING_STATUS.ACCEPTED }, { where: { id: job.bookingId } });

    res.status(200).json({
      success: true,
      data: job,
    });
  } catch (error) {
    next(error);
  }
};

exports.cancelJob = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const worker = await getWorkerFromUser(req.user.id);

    const job = await Job.findByPk(id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    if (job.workerId !== worker.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if ([JOB_STATUS.COMPLETED, JOB_STATUS.CANCELLED].includes(job.status)) {
      return res.status(400).json({ error: 'Job cannot be cancelled' });
    }

    await job.update({
      status: JOB_STATUS.CANCELLED,
      cancellationReason: reason,
      cancelledAt: new Date(),
    });

    // Update booking back to pending
    await Booking.update(
      { status: BOOKING_STATUS.PENDING },
      { where: { id: job.bookingId } }
    );

    res.status(200).json({ success: true, data: job });
  } catch (error) {
    next(error);
  }
};

// ─── NEW: Update worker rating after job completion ──────────────────
exports.updateJobRating = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rating, feedback } = req.body;

    if (!rating || rating < 0 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 0 and 5' });
    }

    const job = await Job.findByPk(id, {
      include: [{ model: Booking }],
    });
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Only the user who booked can rate
    if (job.Booking.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (job.status !== JOB_STATUS.COMPLETED) {
      return res.status(400).json({ error: 'Cannot rate an incomplete job' });
    }

    await job.update({ rating, feedback });

    // Update worker's average rating
    const worker = await Worker.findByPk(job.workerId);
    if (worker) {
      const allReviews = await Job.findAll({
        where: { workerId: worker.id, status: 'completed' },
        attributes: ['rating'],
      });
      const ratings = allReviews.map(j => j.rating).filter(r => r !== null);
      const avgRating = ratings.length > 0
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length
        : 0;
      await worker.update({ rating: avgRating });
    }

    res.status(200).json({ success: true, data: job });
  } catch (error) {
    next(error);
  }
};

// ─── NEW: Get job history (status timeline) ──────────────────────────
exports.getJobHistory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const job = await Job.findByPk(id, {
      include: [{ model: Booking }],
    });
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    const worker = await getWorkerFromUser(req.user.id);
    if (req.user.role !== 'admin' && job.workerId !== worker.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Build history from job attributes and created/updated timestamps
    const history = [
      { status: JOB_STATUS.ASSIGNED, timestamp: job.assignedAt },
    ];
    if (job.startedAt) {
      history.push({ status: JOB_STATUS.ARRIVED, timestamp: job.startedAt });
    }
    if (job.completedAt) {
      history.push({ status: JOB_STATUS.COMPLETED, timestamp: job.completedAt });
    }
    if (job.status === JOB_STATUS.CANCELLED && job.cancelledAt) {
      history.push({ status: JOB_STATUS.CANCELLED, timestamp: job.cancelledAt });
    }
    res.status(200).json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
};