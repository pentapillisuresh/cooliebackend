const { Coupon, User } = require('../models');
const { Op } = require('sequelize');

// ========== PUBLIC ==========

/**
 * POST /api/coupons/validate
 * Check if a coupon is valid for the logged‑in user.
 * Body: { code }
 */
exports.validateCoupon = async (req, res) => {
  try {
    const { code, mobile } = req.body;

    if (!code) return res.failure('Coupon code required', 400);

    const coupon = await Coupon.findOne({ where: { code } });
    if (!coupon) return res.failure('Invalid coupon code', 404);

    // 1. Check active
    if (!coupon.isActive) return res.failure('Coupon is inactive', 400);

    // 2. Check expiry
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      return res.failure('Coupon has expired', 400);
    }

    // 3. Check max uses
    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      return res.failure('Coupon usage limit reached', 400);
    }

    // 4. Check eligibility (user in eligibleUsers or "All")
    const isEligible = coupon.eligibleUsers.includes('All') || coupon.eligibleUsers.includes(mobile);
    if (!isEligible) {
      return res.failure('You are not eligible to use this coupon', 403);
    }

    // 5. Check if user already used it
    const alreadyUsed = coupon.couponUsedUsers.some((u) => {
      console.log("phoneNumber::", u.phoneNumber);
      console.log("mobile::", mobile);
    
      return String(u.phoneNumber).trim() === String(mobile).trim();
    });
    
    console.log("alreadyUsed::", alreadyUsed);
    
    if (alreadyUsed) {
      return res.failure(
        "You have already used this coupon",
        409
      );
    }
    
    res.success({
      code: coupon.code,
      discountPercentage: coupon.discountPercentage,
    }, 'Coupon is valid');
  } catch (error) {
    console.error('Validate coupon error:', error);
    res.failure('Coupon validation failed', 500);
  }
};

/**
 * POST /api/coupons/apply
 * Apply a coupon to an order (marks as used for the user).
 * Body: { code, orderId }
 */
exports.applyCoupon = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { code, orderId } = req.body;
    const userId = req.user.id;
    const userPhone = req.user.phone;

    if (!code || !orderId) {
      return res.failure('Coupon code and order ID required', 400);
    }

    const coupon = await Coupon.findOne({ where: { code } }, { transaction: t });
    if (!coupon) return res.failure('Invalid coupon code', 404);

    // Re‑validate all conditions
    if (!coupon.isActive) return res.failure('Coupon is inactive', 400);
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      return res.failure('Coupon has expired', 400);
    }
    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      return res.failure('Coupon usage limit reached', 400);
    }
    const isEligible = coupon.eligibleUsers.includes('All') || coupon.eligibleUsers.includes(userId);
    if (!isEligible) return res.failure('You are not eligible for this coupon', 403);
    const alreadyUsed = coupon.couponUsedUsers.some(u => u.id === userId);
    if (alreadyUsed) return res.failure('Coupon already used by you', 409);

    // Get user name
    const user = await User.findByPk(userId, { transaction: t });
    if (!user) return res.failure('User not found', 404);

    // Update coupon: add user to used list, increment count
    const updatedUsers = [...coupon.couponUsedUsers, { phoneNumber: userPhone, name: user.name }];
    await coupon.update({
      couponUsedUsers: updatedUsers,
      usedCount: coupon.usedCount + 1,
    }, { transaction: t });

    // Optionally, you could apply the discount to the order here.
    // For now we just return the discount percentage.
    await t.commit();

    res.success({
      discountPercentage: coupon.discountPercentage,
      couponCode: coupon.code,
    }, 'Coupon applied successfully');
  } catch (error) {
    await t.rollback();
    console.error('Apply coupon error:', error);
    res.failure('Failed to apply coupon', 500);
  }
};

// ========== ADMIN ==========

/**
 * POST /api/admin/coupons
 * Create a new coupon.
 * Body: { code, discountPercentage, expiresAt, eligibleUsers, maxUses }
 */
exports.createCoupon = async (req, res) => {
  try {
    const { code, discountPercentage, expiresAt, eligibleUsers, maxUses } = req.body;
    if (!code || discountPercentage === undefined) {
      return res.failure('Code and discount percentage are required', 400);
    }
    const existing = await Coupon.findOne({ where: { code } });
    if (existing) return res.failure('Coupon code already exists', 409);

    const coupon = await Coupon.create({
      code: code.toUpperCase(),
      discountPercentage,
      expiresAt: expiresAt || null,
      eligibleUsers: eligibleUsers || ['All'],
      maxUses: maxUses || null,
      isActive: true,
    });
    res.success(coupon, 'Coupon created', 201);
  } catch (error) {
    console.error('Create coupon error:', error);
    res.failure('Failed to create coupon', 500);
  }
};

/**
 * GET /api/admin/coupons
 * List all coupons.
 */
exports.listCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.findAll({ order: [['createdAt', 'DESC']] });
    res.success(coupons);
  } catch (error) {
    console.error('List coupons error:', error);
    res.failure('Failed to list coupons', 500);
  }
};

/**
 * GET /api/admin/coupons/:id
 * Get a coupon by ID.
 */
exports.getCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findByPk(id);
    if (!coupon) return res.failure('Coupon not found', 404);
    res.success(coupon);
  } catch (error) {
    console.error('Get coupon error:', error);
    res.failure('Failed to fetch coupon', 500);
  }
};

/**
 * PUT /api/admin/coupons/:id
 * Update a coupon.
 */
exports.updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, discountPercentage, isActive, expiresAt, eligibleUsers, maxUses } = req.body;
    const coupon = await Coupon.findByPk(id);
    if (!coupon) return res.failure('Coupon not found', 404);

    await coupon.update({ code, discountPercentage, isActive, expiresAt, eligibleUsers, maxUses });
    res.success(coupon, 'Coupon updated');
  } catch (error) {
    console.error('Update coupon error:', error);
    res.failure('Failed to update coupon', 500);
  }
};

/**
 * DELETE /api/admin/coupons/:id
 * Delete a coupon.
 */
exports.deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findByPk(id);
    if (!coupon) return res.failure('Coupon not found', 404);
    await coupon.destroy();
    res.success(null, 'Coupon deleted');
  } catch (error) {
    console.error('Delete coupon error:', error);
    res.failure('Failed to delete coupon', 500);
  }
};

/**
 * PUT /api/admin/coupons/:id/toggle
 * Toggle coupon active status
 */
exports.toggleCouponStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findByPk(id);
    if (!coupon) return res.failure('Coupon not found', 404);

    await coupon.update({
      isActive: !coupon.isActive
    });

    res.success(coupon, `Coupon ${coupon.isActive ? 'activated' : 'deactivated'}`);
  } catch (error) {
    console.error('Toggle coupon status error:', error);
    res.failure('Failed to toggle coupon status', 500);
  }
};