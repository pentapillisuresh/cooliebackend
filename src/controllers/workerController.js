const { Worker, User, Document, BankDetail, Job, Booking, Review } = require('../models');
const { getPagination, getPagingData } = require('../utils/helpers');
const { Op } = require('sequelize');

// ─── Worker Registration & Profile ──────────────────────────────────

/**
 * Register as a worker (Kooli)
 */
exports.registerWorker = async (req, res, next) => {
  try {
    const { profession, experience, description, latitude, longitude } = req.body;
    const existing = await Worker.findOne({ where: { userId: req.user.id } });
    if (existing) {
      return res.status(400).json({ error: 'Worker profile already exists' });
    }
    const worker = await Worker.create({
      userId: req.user.id,
      profession,
      experience,
      description,
      latitude,
      longitude,
      isVerified: false,
      isAvailable: true,
      rating: 0,
      totalJobs: 0,
    });
    res.status(201).json({ success: true, data: worker });
  } catch (error) {
    next(error);
  }
};

/**
 * Get worker profile for the authenticated user
 */
exports.getMyProfile = async (req, res, next) => {
  try {
    const worker = await Worker.findOne({
      where: { userId: req.user.id },
      include: [
        { model: Document },
        { model: BankDetail },
        { model: User, attributes: ['id', 'name', 'mobile'] },
      ],
    });
    if (!worker) {
      return res.status(404).json({ error: 'Worker profile not found' });
    }
    res.status(200).json({ success: true, data: worker });
  } catch (error) {
    next(error);
  }
};

/**
 * Get worker profile by ID (public)
 */
exports.getWorkerById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const worker = await Worker.findByPk(id, {
      include: [
        { model: User, attributes: ['id', 'name', 'mobile'] },
        { model: Document, where: { isVerified: true }, required: false },
        { model: BankDetail, attributes: { exclude: ['accountNumber', 'ifscCode'] } }, // hide sensitive info
      ],
    });
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' });
    }
    res.status(200).json({ success: true, data: worker });
  } catch (error) {
    next(error);
  }
};

/**
 * Update worker profile
 */
exports.updateWorkerProfile = async (req, res, next) => {
  try {
    const worker = await Worker.findOne({ where: { userId: req.user.id } });
    if (!worker) {
      return res.status(404).json({ error: 'Worker profile not found' });
    }
    await worker.update(req.body);
    res.status(200).json({ success: true, data: worker });
  } catch (error) {
    next(error);
  }
};

// ─── Worker Location & Availability ──────────────────────────────────

/**
 * Update worker's current location (for live tracking)
 */
exports.updateLocation = async (req, res, next) => {
  try {
    const { latitude, longitude } = req.body;
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }
    const worker = await Worker.findOne({ where: { userId: req.user.id } });
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' });
    }
    await worker.update({ latitude, longitude });
    res.status(200).json({ success: true, data: worker });
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle worker availability (available / busy)
 */
exports.toggleAvailability = async (req, res, next) => {
  try {
    const worker = await Worker.findOne({ where: { userId: req.user.id } });
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' });
    }
    await worker.update({ isAvailable: !worker.isAvailable });
    res.status(200).json({
      success: true,
      data: { isAvailable: worker.isAvailable },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Worker Statistics ───────────────────────────────────────────────

/**
 * Get worker's dashboard statistics (total jobs, earnings, rating, etc.)
 */
exports.getWorkerStats = async (req, res, next) => {
  try {
    const worker = await Worker.findOne({ where: { userId: req.user.id } });
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' });
    }
    // Get completed jobs count and earnings
    const jobs = await Job.findAll({
      where: { workerId: worker.id, status: 'completed' },
      include: [{ model: Booking }],
    });
    let totalEarned = 0;
    let pendingPayment = 0;
    for (const job of jobs) {
      const payment = await Payment.findOne({
        where: { bookingId: job.bookingId, status: 'paid' },
      });
      const amount = job.Booking ? parseFloat(job.Booking.totalAmount) : 0;
      if (payment) {
        totalEarned += amount;
      } else {
        pendingPayment += amount;
      }
    }
    // Get reviews
    const reviews = await Review.findAll({ where: { workerId: worker.id } });
    const averageRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

    res.status(200).json({
      success: true,
      data: {
        totalJobs: worker.totalJobs,
        totalEarned,
        pendingPayment,
        rating: worker.rating || averageRating,
        reviewsCount: reviews.length,
        isVerified: worker.isVerified,
        isAvailable: worker.isAvailable,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Bank Details ────────────────────────────────────────────────────

/**
 * Add or update worker's bank details
 */
exports.addBankDetails = async (req, res, next) => {
  try {
    const { accountHolderName, accountNumber, ifscCode, bankName, branchName, upiId } = req.body;
    const worker = await Worker.findOne({ where: { userId: req.user.id } });
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' });
    }
    let bankDetail = await BankDetail.findOne({ where: { workerId: worker.id } });
    if (bankDetail) {
      await bankDetail.update({ accountHolderName, accountNumber, ifscCode, bankName, branchName, upiId });
    } else {
      bankDetail = await BankDetail.create({
        workerId: worker.id,
        accountHolderName,
        accountNumber,
        ifscCode,
        bankName,
        branchName,
        upiId,
      });
    }
    res.status(200).json({ success: true, data: bankDetail });
  } catch (error) {
    next(error);
  }
};

/**
 * Get worker's bank details
 */
exports.getBankDetails = async (req, res, next) => {
  try {
    const worker = await Worker.findOne({ where: { userId: req.user.id } });
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' });
    }
    const bankDetail = await BankDetail.findOne({ where: { workerId: worker.id } });
    res.status(200).json({ success: true, data: bankDetail });
  } catch (error) {
    next(error);
  }
};

// ─── Admin Only ──────────────────────────────────────────────────────

/**
 * Admin: Get all workers with filters (profession, verified, availability, search)
 */
exports.getAllWorkers = async (req, res, next) => {
  try {
    const { page, limit, profession, isVerified, isAvailable, search } = req.query;
    const { offset, limit: lim } = getPagination(page, limit);

    const where = {};
    if (profession) where.profession = profession;
    if (isVerified !== undefined) where.isVerified = isVerified === 'true';
    if (isAvailable !== undefined) where.isAvailable = isAvailable === 'true';
    if (search) {
      where[Op.or] = [
        { profession: { [Op.like]: `%${search}%` } },
        { '$User.name$': { [Op.like]: `%${search}%` } },
        { '$User.mobile$': { [Op.like]: `%${search}%` } },
      ];
    }

    const data = await Worker.findAndCountAll({
      where,
      include: [
        { model: User, attributes: ['id', 'name', 'mobile'] },
        { model: BankDetail },
        { model: Document, where: { isVerified: true }, required: false },
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
 * Admin: Get workers by profession (list of distinct professions)
 */
exports.getProfessions = async (req, res, next) => {
  try {
    const professions = await Worker.findAll({
      attributes: ['profession'],
      group: ['profession'],
      raw: true,
    });
    const list = professions.map(p => p.profession).filter(Boolean);
    res.status(200).json({ success: true, data: list });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Verify a worker (set isVerified = true)
 */
exports.verifyWorker = async (req, res, next) => {
  try {
    const { id } = req.params;
    const worker = await Worker.findByPk(id);
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' });
    }
    await worker.update({ isVerified: true });
    res.status(200).json({ success: true, data: worker });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Verify worker's bank details
 */
exports.verifyBankDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const bankDetail = await BankDetail.findOne({ where: { workerId: id } });
    if (!bankDetail) {
      return res.status(404).json({ error: 'Bank details not found' });
    }
    await bankDetail.update({ isVerified: true });
    res.status(200).json({ success: true, data: bankDetail });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Delete (soft delete) a worker
 */
exports.deleteWorker = async (req, res, next) => {
  try {
    const { id } = req.params;
    const worker = await Worker.findByPk(id);
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' });
    }
    await worker.destroy();
    res.status(200).json({ success: true, message: 'Worker deleted' });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Get a worker with full details (including documents, jobs, reviews)
 */
exports.getWorkerFullDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const worker = await Worker.findByPk(id, {
      include: [
        { model: User, attributes: ['id', 'name', 'mobile', 'email'] },
        { model: Document },
        { model: BankDetail },
        {
          model: Job,
          include: [
            { model: Booking, include: [{ model: Payment }] },
          ],
        },
        { model: Review, include: [{ model: User, attributes: ['id', 'name'] }] },
      ],
    });
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' });
    }
    res.status(200).json({ success: true, data: worker });
  } catch (error) {
    next(error);
  }
};