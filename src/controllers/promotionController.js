const {
  Promotion,
  User,
  Booking,
  sequelize,
} = require('../models');

const {
  getPagination,
  getPagingData,
} = require('../utils/helpers');

const { Op } = require('sequelize');

// ============================================================
// PUBLIC
// ============================================================

/**
 * GET /api/promotions
 * Get active promotions
 */
exports.getActivePromotions = async (
  req,
  res,
  next
) => {
  try {
    const {
      page,
      limit,
    } = req.query;

    const {
      offset,
      limit: lim,
    } = getPagination(page, limit);

    const now = new Date();

    const where = {
      isActive: true,

      startDate: {
        [Op.lte]: now,
      },

      endDate: {
        [Op.gte]: now,
      },
    };

    // ==========================================
    // ROLE FILTER
    // ==========================================

    if (req.user) {
      const role =
        req.user.role === 'worker'
          ? 'worker'
          : 'user';

      where[Op.or] = [
        {
          applicableTo: 'all',
        },
        {
          applicableTo: role,
        },
      ];
    } else {
      where.applicableTo = 'all';
    }

    const data =
      await Promotion.findAndCountAll({
        where,

        order: [
          ['createdAt', 'DESC'],
        ],

        offset,

        limit: lim,
      });

    const paginated =
      getPagingData(
        data,
        page,
        lim
      );

    return res.status(200).json({
      success: true,
      data: paginated,
    });

  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET SINGLE ACTIVE PROMOTION
// ============================================================

exports.getPromotionById = async (
  req,
  res,
  next
) => {
  try {
    const now = new Date();

    const promotion =
      await Promotion.findOne({
        where: {
          id: req.params.id,

          isActive: true,

          startDate: {
            [Op.lte]: now,
          },

          endDate: {
            [Op.gte]: now,
          },
        },
      });

    if (!promotion) {
      return res.status(404).json({
        error:
          'Promotion not found or expired',
      });
    }

    return res.status(200).json({
      success: true,
      data: promotion,
    });

  } catch (error) {
    next(error);
  }
};

// ============================================================
// VALIDATE PROMOTION
// ============================================================

/**
 * POST /api/promotions/validate
 *
 * Body:
 * {
 *   code: "SUMMER10"
 * }
 */

exports.validatePromotion = async (
  req,
  res,
  next
) => {
  try {

    const rawCode =
      req.body?.code;

    // ========================================
    // SAFE CODE VALIDATION
    // ========================================

    if (
      typeof rawCode !== 'string' ||
      !rawCode.trim()
    ) {
      return res.status(400).json({
        error:
          'Promotion code required',
      });
    }

    const code =
      rawCode.trim().toUpperCase();

    // ========================================
    // FIND PROMOTION
    // ========================================

    const promotion =
      await Promotion.findOne({
        where: {
          code,
        },
      });

    if (!promotion) {
      console.log(
        'Coupon not found:',
        code
      );

      return res.status(404).json({
        error:
          'Invalid promotion code',
      });
    }

    // ========================================
    // ACTIVE
    // ========================================

    if (!promotion.isActive) {
      return res.status(400).json({
        error:
          'Promotion is inactive',
      });
    }

    // ========================================
    // DATE
    // ========================================

    const now = new Date();

    if (
      new Date(
        promotion.endDate
      ) < now
    ) {
      return res.status(400).json({
        error:
          'Promotion has expired',
      });
    }

    if (
      new Date(
        promotion.startDate
      ) > now
    ) {
      return res.status(400).json({
        error:
          'Promotion has not started yet',
      });
    }

    // ========================================
    // MAX USES
    // ========================================

    if (
      promotion.maxUses !== null &&
      promotion.maxUses !== undefined &&
      Number(promotion.usedCount || 0) >=
        Number(promotion.maxUses)
    ) {
      return res.status(400).json({
        error:
          'Promotion usage limit reached',
      });
    }

    // ========================================
    // ELIGIBLE USERS
    // ========================================

    const eligibleUsers =
      Array.isArray(
        promotion.eligibleUsers
      )
        ? promotion.eligibleUsers
        : ['All'];

    const userId =
      req.user?.id;

    const isEligible =
      eligibleUsers.includes('All') ||
      eligibleUsers.includes(userId) ||
      eligibleUsers.includes(
        String(userId)
      );

    if (!isEligible) {
      return res.status(403).json({
        error:
          'You are not eligible for this promotion',
      });
    }

    // ========================================
    // ALREADY USED
    // ========================================

    const couponUsedUsers =
      Array.isArray(
        promotion.couponUsedUsers
      )
        ? promotion.couponUsedUsers
        : [];

    const alreadyUsed =
      couponUsedUsers.some(
        (item) =>
          Number(item?.userId) ===
          Number(userId)
      );

    if (alreadyUsed) {
      return res.status(409).json({
        error:
          'You have already used this promotion',
      });
    }

    // ========================================
    // RESPONSE
    // ========================================

    return res.status(200).json({
      success: true,

      data: {
        id: promotion.id,
        code: promotion.code,
        title: promotion.title,
        discountType:
          promotion.discountType,
        discountValue:
          promotion.discountValue,
      },

      message:
        'Promotion is valid',
    });

  } catch (error) {

    console.error(
      'Validate promotion error:',
      error
    );

    next(error);
  }
};

// ============================================================
// APPLY PROMOTION
// ============================================================

/**
 * POST /api/promotions/apply
 *
 * Body:
 * {
 *   code,
 *   bookingId
 * }
 */

exports.applyPromotion = async (
  req,
  res,
  next
) => {

  const transaction =
    await sequelize.transaction();

  try {

    const rawCode =
      req.body?.code;

    const bookingId =
      req.body?.bookingId;

    // ========================================
    // VALIDATE INPUT
    // ========================================

    if (
      typeof rawCode !== 'string' ||
      !rawCode.trim()
    ) {
      await transaction.rollback();

      return res.status(400).json({
        error:
          'Promotion code is required',
      });
    }

    if (!bookingId) {
      await transaction.rollback();

      return res.status(400).json({
        error:
          'Booking ID is required',
      });
    }

    const code =
      rawCode.trim().toUpperCase();

    const user =
      req.user;

    // ========================================
    // FIND PROMOTION
    // ========================================

    const promotion =
      await Promotion.findOne({
        where: {
          code,
        },

        transaction,

        lock:
          transaction.LOCK.UPDATE,
      });

    if (!promotion) {
      await transaction.rollback();

      return res.status(404).json({
        error:
          'Invalid promotion code',
      });
    }

    // ========================================
    // ACTIVE
    // ========================================

    if (!promotion.isActive) {
      await transaction.rollback();

      return res.status(400).json({
        error:
          'Promotion is inactive',
      });
    }

    // ========================================
    // DATE
    // ========================================

    const now = new Date();

    if (
      new Date(
        promotion.endDate
      ) < now
    ) {
      await transaction.rollback();

      return res.status(400).json({
        error:
          'Promotion expired',
      });
    }

    if (
      new Date(
        promotion.startDate
      ) > now
    ) {
      await transaction.rollback();

      return res.status(400).json({
        error:
          'Promotion not started',
      });
    }

    // ========================================
    // MAX USES
    // ========================================

    if (
      promotion.maxUses !== null &&
      promotion.maxUses !== undefined &&
      Number(promotion.usedCount || 0) >=
        Number(promotion.maxUses)
    ) {
      await transaction.rollback();

      return res.status(400).json({
        error:
          'Usage limit reached',
      });
    }

    // ========================================
    // ELIGIBLE USERS
    // ========================================

    const eligibleUsers =
      Array.isArray(
        promotion.eligibleUsers
      )
        ? promotion.eligibleUsers
        : ['All'];

    const userId =
      user?.id;

    const isEligible =
      eligibleUsers.includes('All') ||
      eligibleUsers.includes(userId) ||
      eligibleUsers.includes(
        String(userId)
      );

    if (!isEligible) {
      await transaction.rollback();

      return res.status(403).json({
        error:
          'You are not eligible',
      });
    }

    // ========================================
    // ALREADY USED
    // ========================================

    const couponUsedUsers =
      Array.isArray(
        promotion.couponUsedUsers
      )
        ? promotion.couponUsedUsers
        : [];

    const alreadyUsed =
      couponUsedUsers.some(
        (item) =>
          Number(item?.userId) ===
          Number(userId)
      );

    if (alreadyUsed) {
      await transaction.rollback();

      return res.status(409).json({
        error:
          'Already used this promotion',
      });
    }

    // ========================================
    // VERIFY BOOKING
    // ========================================

    const booking =
      await Booking.findOne({
        where: {
          id: bookingId,
          userId,
        },

        transaction,
      });

    if (!booking) {
      await transaction.rollback();

      return res.status(404).json({
        error:
          'Booking not found',
      });
    }

    // ========================================
    // UPDATE USED USERS
    // ========================================

    const updatedUsers = [
      ...couponUsedUsers,

      {
        userId,
        phoneNumber:
          user?.mobile || null,
        name:
          user?.name || null,
      },
    ];

    await promotion.update(
      {
        couponUsedUsers:
          updatedUsers,

        usedCount:
          Number(
            promotion.usedCount || 0
          ) + 1,
      },
      {
        transaction,
      }
    );

    await transaction.commit();

    return res.status(200).json({
      success: true,

      data: {
        promotionId:
          promotion.id,

        title:
          promotion.title,

        discountType:
          promotion.discountType,

        discountValue:
          promotion.discountValue,
      },

      message:
        'Promotion applied successfully',
    });

  } catch (error) {

    try {
      await transaction.rollback();
    } catch (rollbackError) {
      console.error(
        'Rollback error:',
        rollbackError
      );
    }

    console.error(
      'Apply promotion error:',
      error
    );

    next(error);
  }
};

// ============================================================
// ADMIN - CREATE PROMOTION
// ============================================================

exports.createPromotion = async (
  req,
  res,
  next
) => {
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
      isActive,
    } = req.body;

    // ========================================
    // CODE VALIDATION
    // ========================================

    if (
      typeof code !== 'string' ||
      !code.trim()
    ) {
      return res.status(400).json({
        error:
          'Promotion code is required',
      });
    }

    const normalizedCode =
      code.trim().toUpperCase();

    // ========================================
    // TITLE
    // ========================================

    if (
      typeof title !== 'string' ||
      !title.trim()
    ) {
      return res.status(400).json({
        error:
          'Promotion title is required',
      });
    }

    // ========================================
    // DATES
    // ========================================

    if (!startDate) {
      return res.status(400).json({
        error:
          'Start date is required',
      });
    }

    if (!endDate) {
      return res.status(400).json({
        error:
          'End date is required',
      });
    }

    const start =
      new Date(startDate);

    const end =
      new Date(endDate);

    if (
      Number.isNaN(
        start.getTime()
      ) ||
      Number.isNaN(
        end.getTime()
      )
    ) {
      return res.status(400).json({
        error:
          'Invalid promotion dates',
      });
    }

    if (end < start) {
      return res.status(400).json({
        error:
          'End date cannot be before start date',
      });
    }

    // ========================================
    // DISCOUNT
    // ========================================

    const normalizedDiscountType =
      typeof discountType ===
        'string' &&
      discountType.trim()
        ? discountType
            .trim()
            .toLowerCase()
        : 'percentage';

    if (
      ![
        'percentage',
        'fixed',
      ].includes(
        normalizedDiscountType
      )
    ) {
      return res.status(400).json({
        error:
          'Invalid discount type',
      });
    }

    const numericDiscount =
      Number(discountValue);

    if (
      Number.isNaN(
        numericDiscount
      ) ||
      numericDiscount < 0
    ) {
      return res.status(400).json({
        error:
          'Invalid discount value',
      });
    }

    if (
      normalizedDiscountType ===
        'percentage' &&
      numericDiscount > 100
    ) {
      return res.status(400).json({
        error:
          'Percentage discount cannot exceed 100%',
      });
    }

    // ========================================
    // APPLICABLE TO
    // ========================================

    const normalizedApplicableTo =
      typeof applicableTo ===
        'string' &&
      applicableTo.trim()
        ? applicableTo
            .trim()
            .toLowerCase()
        : 'all';

    if (
      ![
        'all',
        'user',
        'worker',
      ].includes(
        normalizedApplicableTo
      )
    ) {
      return res.status(400).json({
        error:
          'Invalid applicableTo value',
      });
    }

    // ========================================
    // CHECK DUPLICATE CODE
    // ========================================

    const existing =
      await Promotion.findOne({
        where: {
          code:
            normalizedCode,
        },
      });

    if (existing) {
      return res.status(409).json({
        error:
          'Promotion code already exists',
      });
    }

    // ========================================
    // SERVICES
    // ========================================

    const normalizedServiceIds =
      Array.isArray(
        applicableServiceIds
      )
        ? applicableServiceIds
            .map((id) =>
              Number(id)
            )
            .filter(
              (id) =>
                !Number.isNaN(id)
            )
        : null;

    // ========================================
    // ELIGIBLE USERS
    // ========================================

    const normalizedEligibleUsers =
      Array.isArray(
        eligibleUsers
      ) &&
      eligibleUsers.length > 0
        ? eligibleUsers
        : ['All'];

    // ========================================
    // MAX USES
    // ========================================

    let normalizedMaxUses = null;

    if (
      maxUses !== null &&
      maxUses !== undefined &&
      maxUses !== ''
    ) {
      normalizedMaxUses =
        Number(maxUses);

      if (
        Number.isNaN(
          normalizedMaxUses
        ) ||
        normalizedMaxUses < 1
      ) {
        return res.status(400).json({
          error:
            'Max uses must be greater than 0',
        });
      }
    }

    // ========================================
    // CREATE
    // ========================================

    const promotion =
      await Promotion.create({

        code:
          normalizedCode,

        title:
          title.trim(),

        description:
          description?.trim() ||
          null,

        image:
          image?.trim() ||
          null,

        discountType:
          normalizedDiscountType,

        discountValue:
          numericDiscount,

        startDate:
          start,

        endDate:
          end,

        applicableTo:
          normalizedApplicableTo,

        applicableServiceIds:
          normalizedServiceIds,

        eligibleUsers:
          normalizedEligibleUsers,

        maxUses:
          normalizedMaxUses,

        isActive:
          isActive !== undefined
            ? Boolean(isActive)
            : true,

        createdBy:
          req.user?.id || null,
      });

    return res.status(201).json({
      success: true,
      data: promotion,
    });

  } catch (error) {

    console.error(
      'Create promotion error:',
      error
    );

    next(error);
  }
};

// ============================================================
// ADMIN - UPDATE
// ============================================================

exports.updatePromotion = async (
  req,
  res,
  next
) => {
  try {

    const promotion =
      await Promotion.findByPk(
        req.params.id
      );

    if (!promotion) {
      return res.status(404).json({
        error:
          'Promotion not found',
      });
    }

    const updates = {
      ...req.body,
    };

    // ========================================
    // CODE
    // ========================================

    if (
      updates.code !== undefined
    ) {

      if (
        typeof updates.code !==
          'string' ||
        !updates.code.trim()
      ) {
        return res.status(400).json({
          error:
            'Promotion code cannot be empty',
        });
      }

      updates.code =
        updates.code
          .trim()
          .toUpperCase();

      const duplicate =
        await Promotion.findOne({
          where: {
            code:
              updates.code,

            id: {
              [Op.ne]:
                promotion.id,
            },
          },
        });

      if (duplicate) {
        return res.status(409).json({
          error:
            'Promotion code already exists',
        });
      }
    }

    // ========================================
    // APPLICABLE TO
    // ========================================

    if (
      updates.applicableTo !==
      undefined
    ) {

      if (
        typeof updates.applicableTo !==
          'string'
      ) {
        return res.status(400).json({
          error:
            'Invalid applicableTo',
        });
      }

      updates.applicableTo =
        updates.applicableTo
          .trim()
          .toLowerCase();

      if (
        ![
          'all',
          'user',
          'worker',
        ].includes(
          updates.applicableTo
        )
      ) {
        return res.status(400).json({
          error:
            'Invalid applicableTo value',
        });
      }
    }

    // ========================================
    // DISCOUNT TYPE
    // ========================================

    if (
      updates.discountType !==
      undefined
    ) {

      updates.discountType =
        String(
          updates.discountType
        )
          .trim()
          .toLowerCase();

      if (
        ![
          'percentage',
          'fixed',
        ].includes(
          updates.discountType
        )
      ) {
        return res.status(400).json({
          error:
            'Invalid discount type',
        });
      }
    }

    // ========================================
    // DISCOUNT VALUE
    // ========================================

    if (
      updates.discountValue !==
      undefined
    ) {

      const value =
        Number(
          updates.discountValue
        );

      if (
        Number.isNaN(value) ||
        value < 0
      ) {
        return res.status(400).json({
          error:
            'Invalid discount value',
        });
      }

      if (
        updates.discountType ===
          'percentage' &&
        value > 100
      ) {
        return res.status(400).json({
          error:
            'Percentage discount cannot exceed 100%',
        });
      }

      updates.discountValue =
        value;
    }

    // ========================================
    // SERVICE IDS
    // ========================================

    if (
      updates.applicableServiceIds !==
      undefined
    ) {

      updates.applicableServiceIds =
        Array.isArray(
          updates.applicableServiceIds
        )
          ? updates
              .applicableServiceIds
              .map((id) =>
                Number(id)
              )
              .filter(
                (id) =>
                  !Number.isNaN(id)
              )
          : null;
    }

    // ========================================
    // ELIGIBLE USERS
    // ========================================

    if (
      updates.eligibleUsers !==
      undefined
    ) {

      updates.eligibleUsers =
        Array.isArray(
          updates.eligibleUsers
        )
          ? updates.eligibleUsers
          : ['All'];
    }

    // ========================================
    // UPDATE
    // ========================================

    await promotion.update(
      updates
    );

    return res.status(200).json({
      success: true,
      data: promotion,
    });

  } catch (error) {

    console.error(
      'Update promotion error:',
      error
    );

    next(error);
  }
};

// ============================================================
// ADMIN - DELETE
// ============================================================

exports.deletePromotion = async (
  req,
  res,
  next
) => {
  try {

    const promotion =
      await Promotion.findByPk(
        req.params.id
      );

    if (!promotion) {
      return res.status(404).json({
        error:
          'Promotion not found',
      });
    }

    await promotion.destroy();

    return res.status(200).json({
      success: true,
      message:
        'Promotion deleted',
    });

  } catch (error) {
    next(error);
  }
};

// ============================================================
// ADMIN - GET ALL
// ============================================================

exports.getAllPromotions = async (
  req,
  res,
  next
) => {
  try {

    const {
      page,
      limit,
      isActive,
      fromDate,
      toDate,
      search,
    } = req.query;

    const {
      offset,
      limit: lim,
    } = getPagination(
      page,
      limit
    );

    const where = {};

    // ========================================
    // ACTIVE FILTER
    // ========================================

    if (
      isActive !== undefined
    ) {
      where.isActive =
        isActive === 'true';
    }

    // ========================================
    // DATE FILTER
    // ========================================

    if (
      fromDate &&
      toDate
    ) {
      where.createdAt = {
        [Op.between]: [
          fromDate,
          toDate,
        ],
      };
    }

    // ========================================
    // SEARCH
    // ========================================

    if (
      typeof search === 'string' &&
      search.trim()
    ) {

      const searchValue =
        `%${search.trim()}%`;

      where[Op.or] = [

        {
          title: {
            [Op.like]:
              searchValue,
          },
        },

        {
          code: {
            [Op.like]:
              searchValue,
          },
        },

        {
          description: {
            [Op.like]:
              searchValue,
          },
        },

      ];
    }

    // ========================================
    // QUERY
    // ========================================

    const data =
      await Promotion.findAndCountAll({

        where,

        order: [
          ['createdAt', 'DESC'],
        ],

        offset,

        limit: lim,
      });

    const paginated =
      getPagingData(
        data,
        page,
        lim
      );

    return res.status(200).json({
      success: true,
      data: paginated,
    });

  } catch (error) {

    console.error(
      'Get all promotions error:',
      error
    );

    next(error);
  }
};