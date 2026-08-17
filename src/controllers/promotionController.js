const { Promotion } = require('../models');
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

    // If user is logged in, filter by applicableTo (optional)
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

// ─── Admin ──────────────────────────────────────────────────────

/** Create a promotion (admin) */
exports.createPromotion = async (req, res, next) => {
  try {
    const { title, description, image, discountType, discountValue, startDate, endDate, applicableTo, applicableServiceIds } = req.body;
    const promotion = await Promotion.create({
      title,
      description,
      image,
      discountType: discountType || 'percentage',
      discountValue,
      startDate,
      endDate,
      applicableTo: applicableTo || 'all',
      applicableServiceIds: applicableServiceIds || null,
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