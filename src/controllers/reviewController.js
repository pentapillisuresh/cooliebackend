const { Review, Booking, Worker, User, Job } = require('../models');
const { BOOKING_STATUS } = require('../utils/constants');
const { getPagination, getPagingData } = require('../utils/helpers');

/**
 * Create a review for a completed booking
 */
exports.createReview = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const { rating, comment, images } = req.body;

    if (!rating || rating < 0 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 0 and 5' });
    }

    // Verify booking exists and belongs to the user
    const booking = await Booking.findByPk(bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    if (booking.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Only allow review if booking is completed or payment-pending (i.e., service done)
    if (![BOOKING_STATUS.COMPLETED, BOOKING_STATUS.PAYMENT_PENDING].includes(booking.status)) {
      return res.status(400).json({ error: 'Cannot review a booking that is not completed' });
    }

    // Check if review already exists
    const existing = await Review.findOne({ where: { bookingId } });
    if (existing) {
      return res.status(400).json({ error: 'Review already exists for this booking' });
    }

    // Get the worker from the job
    const job = await Job.findOne({ where: { bookingId } });
    if (!job || !job.workerId) {
      return res.status(400).json({ error: 'No worker assigned to this booking' });
    }

    const review = await Review.create({
      bookingId,
      userId: req.user.id,
      workerId: job.workerId,
      rating,
      comment,
      images: images || [],
    });

    // Update worker's average rating
    const worker = await Worker.findByPk(job.workerId);
    if (worker) {
      const allReviews = await Review.findAll({ where: { workerId: worker.id } });
      const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
      const avgRating = totalRating / allReviews.length;
      await worker.update({ rating: avgRating });
    }

    res.status(201).json({
      success: true,
      data: review,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all reviews for the authenticated user (as reviewer)
 */
exports.getMyReviews = async (req, res, next) => {
  try {
    const reviews = await Review.findAll({
      where: { userId: req.user.id },
      include: [
        { model: Booking, include: [{ model: Service }] },
        { model: Worker, include: [{ model: User, attributes: ['id', 'name', 'mobile'] }] },
      ],
      order: [['createdAt', 'DESC']],
    });
    res.status(200).json({
      success: true,
      data: reviews,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all reviews for a specific worker (public)
 */
exports.getWorkerReviews = async (req, res, next) => {
  try {
    const { workerId } = req.params;
    const { page, limit } = req.query;
    const { offset, limit: lim } = getPagination(page, limit);

    const worker = await Worker.findByPk(workerId);
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' });
    }

    const data = await Review.findAndCountAll({
      where: { workerId },
      include: [
        { model: User, attributes: ['id', 'name'] },
        { model: Booking, include: [{ model: Service }] },
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
 * Admin: Get all reviews (with filters)
 */
exports.getAllReviews = async (req, res, next) => {
  try {
    const { page, limit, workerId, userId, rating } = req.query;
    const { offset, limit: lim } = getPagination(page, limit);

    const where = {};
    if (workerId) where.workerId = workerId;
    if (userId) where.userId = userId;
    if (rating) where.rating = rating;

    const data = await Review.findAndCountAll({
      where,
      include: [
        { model: User, attributes: ['id', 'name'] },
        { model: Worker, include: [{ model: User, attributes: ['id', 'name', 'mobile'] }] },
        { model: Booking, include: [{ model: Service }] },
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
 * Update a review (only the user who created it can update)
 */
exports.updateReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rating, comment, images } = req.body;

    const review = await Review.findByPk(id);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    if (review.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Only allow updates if not too old? (optional)
    await review.update({ rating, comment, images });

    // Recalculate worker average rating if rating changed
    if (rating !== undefined) {
      const worker = await Worker.findByPk(review.workerId);
      if (worker) {
        const allReviews = await Review.findAll({ where: { workerId: worker.id } });
        const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
        const avgRating = totalRating / allReviews.length;
        await worker.update({ rating: avgRating });
      }
    }

    res.status(200).json({
      success: true,
      data: review,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a review (user or admin)
 */
exports.deleteReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const review = await Review.findByPk(id);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    if (req.user.role !== 'admin' && review.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    await review.destroy();
    // Recalculate worker rating after deletion
    const worker = await Worker.findByPk(review.workerId);
    if (worker) {
      const allReviews = await Review.findAll({ where: { workerId: worker.id } });
      const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
      const avgRating = allReviews.length > 0 ? totalRating / allReviews.length : 0;
      await worker.update({ rating: avgRating });
    }
    res.status(200).json({
      success: true,
      message: 'Review deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};