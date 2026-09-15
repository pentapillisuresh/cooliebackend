const { Promotion, User, Booking, sequelize } = require('../models');
const { getPagination, getPagingData } = require('../utils/helpers');
const { Op } = require('sequelize');

// ─── Public ──────────────────────────────────────────────────────

/** Get active promotions (filtered by user/worker role) */
exports.getActivePromotions = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const { offset, limit: lim } = getPagination(page, limit);

    const where = {
      isActive: true,
      startDate: { [Op.lte]: new Date() },
      endDate: { [Op.gte]: new Date() },
    };

    if (req.user) {
      const role = req.user.role === 'worker' ? 'worker' : 'user';
      where[Op.or] = [
        { applicableTo: 'all' },
        { applicableTo: role },
      ];
    } else {
      where.applicableTo = 'all';
    }

    const data = await Promotion.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      offset,
      limit: lim,
    });

    const paginated = getPagingData(data, page, lim);
    res.status(200).json({ success: true, data: paginated });
  } catch (error) { next(error); }
};

/** Get a single active promotion by ID */
exports.getPromotionById = async (req, res, next) => {
  try {
    const promotion = await Promotion.findOne({
      where: {
        id: req.params.id,
        isActive: true,
        startDate: { [Op.lte]: new Date() },
        endDate: { [Op.gte]: new Date() },
      },
    });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found or expired' });
    res.status(200).json({ success: true, data: promotion });
  } catch (error) { next(error); }
};

// ─── Coupon Validation & Application ──────────────────────────

/**
 * POST /api/promotions/validate
 * Check if a promotion code is valid for the logged‑in user.
 * Body: { code }
 */
exports.validatePromotion = async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Promotion code required' });

    const promotion = await Promotion.findOne({ where: { code: code.toUpperCase() } });
    if (!promotion) {
      console.log("coupon::",promotion)
      return res.status(404).json({ error: 'Invalid promotion code' });}

    // 1. Check active
    if (!promotion.isActive) {
      return res.status(400).json({ error: 'Promotion is inactive' });
    }

    // 2. Check expiry
    const now = new Date();
    if (new Date(promotion.endDate) < now) {
      return res.status(400).json({ error: 'Promotion has expired' });
    }
    if (new Date(promotion.startDate) > now) {
      return res.status(400).json({ error: 'Promotion has not started yet' });
    }

    // 3. Check max uses (if limited)
    if (promotion.usedCount >= promotion.maxUses) {
      return res.status(400).json({ error: 'Promotion usage limit reached' });
    }

    // 4. Check eligibility
    const user = req.user;
    const isEligible = promotion.eligibleUsers.includes('All') ||
                       promotion.eligibleUsers.includes(user.id);
    if (!isEligible) {
      return res.status(403).json({ error: 'You are not eligible for this promotion' });
    }

    // 5. Check if user already used it
    const alreadyUsed = promotion.couponUsedUsers.some((u) => u.userId === user.id);
    if (alreadyUsed) {
      return res.status(409).json({ error: 'You have already used this promotion' });
    }

    // All valid – return promotion details
    res.status(200).json({
      success: true,
      data: {
        id: promotion.id,
        code: promotion.code,
        title: promotion.title,
        discountType: promotion.discountType,
        discountValue: promotion.discountValue,
      },
      message: 'Promotion is valid',
    });
  } catch (error) {
    console.error('Validate promotion error:', error);
    next(error);
  }
};

/**
 * POST /api/promotions/apply
 * Apply a promotion to a booking (marks as used for the user).
 * Body: { code, bookingId }
 */
exports.applyPromotion = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { code, bookingId } = req.body;
    if (!code || !bookingId) {
      return res.status(400).json({ error: 'Promotion code and booking ID are required' });
    }

    const user = req.user;

    // Find promotion
    const promotion = await Promotion.findOne({
      where: { code: code.toUpperCase() },
      transaction: t,
      lock: t.LOCK.UPDATE, // prevent race conditions
    });
    if (!promotion) return res.status(404).json({ error: 'Invalid promotion code' });

    // Re‑validate all conditions
    if (!promotion.isActive) return res.status(400).json({ error: 'Promotion is inactive' });
    const now = new Date();
    if (new Date(promotion.endDate) < now) return res.status(400).json({ error: 'Promotion expired' });
    if (new Date(promotion.startDate) > now) return res.status(400).json({ error: 'Promotion not started' });
    if (promotion.usedCount >= promotion.maxUses) return res.status(400).json({ error: 'Usage limit reached' });
    const isEligible = promotion.eligibleUsers.includes('All') ||
                       promotion.eligibleUsers.includes(user.id);
    if (!isEligible) return res.status(403).json({ error: 'You are not eligible' });
    const alreadyUsed = promotion.couponUsedUsers.some((u) => u.userId === user.id);
    if (alreadyUsed) return res.status(409).json({ error: 'Already used this promotion' });

    // Verify booking exists and belongs to user
    const booking = await Booking.findOne({
      where: { id: bookingId, userId: user.id },
      transaction: t,
    });
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Update promotion: add user to used list, increment count
    const updatedUsers = [
      ...promotion.couponUsedUsers,
      { userId: user.id, phoneNumber: user.mobile, name: user.name },
    ];
    await promotion.update({
      couponUsedUsers: updatedUsers,
      usedCount: promotion.usedCount + 1,
    }, { transaction: t });

    // Optionally, you could apply the discount to the booking total here
    // For example, recalculate and update booking.totalAmount

    await t.commit();

    res.status(200).json({
      success: true,
      data: {
        promotionId: promotion.id,
        title: promotion.title,
        discountType: promotion.discountType,
        discountValue: promotion.discountValue,
      },
      message: 'Promotion applied successfully',
    });
  } catch (error) {
    await t.rollback();
    console.error('Apply promotion error:', error);
    next(error);
  }
};

// ─── Admin ──────────────────────────────────────────────────────

/** Create a promotion (admin) */
exports.createPromotion = async (req, res, next) => {
  try {
    const {
      code,
      title,
      description,
      image,
      discountType,
      discountValue,
      startDate,
      endDate,
      applicableTo,
      applicableServiceIds,
      eligibleUsers,
      maxUses,
    } = req.body;

    // Check if code already exists
    const existing = await Promotion.findOne({ where: { code: code.toUpperCase() } });
    if (existing) return res.status(409).json({ error: 'Promotion code already exists' });

    const promotion = await Promotion.create({
      code: code.toUpperCase(),
      title,
      description,
      image,
      discountType: discountType || 'percentage',
      discountValue,
      startDate,
      endDate,
      applicableTo: applicableTo || 'all',
      applicableServiceIds: applicableServiceIds || null,
      eligibleUsers: eligibleUsers || ['All'],
      maxUses: maxUses || null,
      isActive: true,
      createdBy: req.user.id,
    });
    res.status(201).json({ success: true, data: promotion });
  } catch (error) { next(error); }
};

/** Update a promotion (admin) */
exports.updatePromotion = async (req, res, next) => {
  try {
    const promotion = await Promotion.findByPk(req.params.id);
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    await promotion.update(req.body);
    res.status(200).json({ success: true, data: promotion });
  } catch (error) { next(error); }
};

/** Delete (soft delete) a promotion (admin) */
exports.deletePromotion = async (req, res, next) => {
  try {
    const promotion = await Promotion.findByPk(req.params.id);
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    await promotion.destroy();
    res.status(200).json({ success: true, message: 'Promotion deleted' });
  } catch (error) { next(error); }
};

/** Admin: get all promotions (with filters) */
exports.getAllPromotions = async (req, res, next) => {
  try {
    const { page, limit, isActive, fromDate, toDate } = req.query;
    const { offset, limit: lim } = getPagination(page, limit);
    const where = {};
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (fromDate && toDate) {
      where.createdAt = { [Op.between]: [fromDate, toDate] };
    }
    const data = await Promotion.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      offset,
      limit: lim,
    });
    const paginated = getPagingData(data, page, lim);
    res.status(200).json({ success: true, data: paginated });
  } catch (error) { next(error); }
};