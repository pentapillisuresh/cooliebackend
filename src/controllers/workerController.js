const {
  Worker,
  User,
  Document,
  BankDetail,
  Job,
  Booking,
  Review,
  Payment,
} = require('../models');

const {
  getPagination,
  getPagingData,
} = require('../utils/helpers');

const { Op } = require('sequelize');

// ─────────────────────────────────────────────────────────────
// Worker Registration & Profile
// ─────────────────────────────────────────────────────────────

/**
 * Register as a worker (Kooli)
 */
exports.registerWorker = async (req, res, next) => {
  try {
    const {
      profession,
      experience,
      description,
      latitude,
      longitude,
    } = req.body;

    const existing = await Worker.findOne({
      where: {
        userId: req.user.id,
      },
    });

    if (existing) {
      return res.status(400).json({
        error: 'Worker profile already exists',
      });
    }

    const worker = await Worker.create({
      userId: req.user.id,
      profession,
      experience,
      description,
      latitude,
      longitude,

      isVerified: false,

      // Worker availability is controlled through status
      status: 'active',

      rating: 0,
      totalJobs: 0,
    });

    return res.status(201).json({
      success: true,
      data: worker,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// Get My Profile
// ─────────────────────────────────────────────────────────────

/**
 * Get worker profile for authenticated user
 */
exports.getMyProfile = async (req, res, next) => {
  try {
    const worker = await Worker.findOne({
      where: {
        userId: req.user.id,
      },

      include: [
        {
          model: Document,
        },
        {
          model: BankDetail,
        },
        {
          model: User,
          attributes: [
            'id',
            'name',
            'mobile',
          ],
        },
      ],
    });

    if (!worker) {
      return res.status(404).json({
        error: 'Worker profile not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: worker,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// Get Worker By ID
// ─────────────────────────────────────────────────────────────

/**
 * Get worker profile by ID
 */
exports.getWorkerById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const worker = await Worker.findByPk(id, {
      include: [
        {
          model: User,
          attributes: [
            'id',
            'name',
            'mobile',
          ],
        },

        {
          model: Document,
          where: {
            isVerified: true,
          },
          required: false,
        },

        {
          model: BankDetail,
          attributes: {
            exclude: [
              'accountNumber',
              'ifscCode',
            ],
          },
        },
      ],
    });

    if (!worker) {
      return res.status(404).json({
        error: 'Worker not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: worker,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// Update Worker Profile
// ─────────────────────────────────────────────────────────────

/**
 * Update worker profile
 */
exports.updateWorkerProfile = async (req, res, next) => {
  try {
    const worker = await Worker.findOne({
      where: {
        userId: req.user.id,
      },
    });

    if (!worker) {
      return res.status(404).json({
        error: 'Worker profile not found',
      });
    }

    await worker.update(req.body);

    return res.status(200).json({
      success: true,
      data: worker,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// Worker Location & Availability
// ─────────────────────────────────────────────────────────────

/**
 * Update worker's current location
 */
exports.updateLocation = async (req, res, next) => {
  try {
    const {
      latitude,
      longitude,
    } = req.body;

    if (
      latitude === undefined ||
      latitude === null ||
      longitude === undefined ||
      longitude === null
    ) {
      return res.status(400).json({
        error: 'Latitude and longitude are required',
      });
    }

    const worker = await Worker.findOne({
      where: {
        userId: req.user.id,
      },
    });

    if (!worker) {
      return res.status(404).json({
        error: 'Worker not found',
      });
    }

    await worker.update({
      latitude,
      longitude,
    });

    return res.status(200).json({
      success: true,
      data: worker,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle worker availability
 *
 * active   = available
 * working = currently working
 * inactive = unavailable
 */
exports.toggleAvailability = async (req, res, next) => {
  try {
    const worker = await Worker.findOne({
      where: {
        userId: req.user.id,
      },
    });

    if (!worker) {
      return res.status(404).json({
        error: 'Worker not found',
      });
    }

    const status =
      worker.status === 'active'
        ? 'inactive'
        : 'active';

    await worker.update({
      status,
    });

    return res.status(200).json({
      success: true,
      data: {
        status,
        isAvailable: status === 'active',
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// Worker Statistics
// ─────────────────────────────────────────────────────────────

/**
 * Get worker dashboard statistics
 */
exports.getWorkerStats = async (req, res, next) => {
  try {
    const worker = await Worker.findOne({
      where: {
        userId: req.user.id,
      },
    });

    if (!worker) {
      return res.status(404).json({
        error: 'Worker not found',
      });
    }

    // Get completed jobs
    const jobs = await Job.findAll({
      where: {
        workerId: worker.id,
        status: 'completed',
      },

      include: [
        {
          model: Booking,
        },
      ],
    });

    let totalEarned = 0;
    let pendingPayment = 0;

    for (const job of jobs) {
      const payment = await Payment.findOne({
        where: {
          bookingId: job.bookingId,
          status: 'paid',
        },
      });

      const amount = job.Booking
        ? parseFloat(job.Booking.totalAmount || 0)
        : 0;

      if (payment) {
        totalEarned += amount;
      } else {
        pendingPayment += amount;
      }
    }

    // Get reviews
    const reviews = await Review.findAll({
      where: {
        workerId: worker.id,
      },
    });

    const averageRating =
      reviews.length > 0
        ? reviews.reduce(
            (sum, review) =>
              sum + Number(review.rating || 0),
            0
          ) / reviews.length
        : 0;

    return res.status(200).json({
      success: true,

      data: {
        totalJobs: worker.totalJobs || 0,

        totalEarned,

        pendingPayment,

        rating:
          worker.rating || averageRating,

        reviewsCount:
          reviews.length,

        isVerified:
          worker.isVerified,

        isAvailable:
          worker.status === 'active',

        status:
          worker.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// Bank Details
// ─────────────────────────────────────────────────────────────

/**
 * Add or update worker bank details
 */
exports.addBankDetails = async (req, res, next) => {
  try {
    const {
      accountHolderName,
      accountNumber,
      ifscCode,
      bankName,
      branchName,
      upiId,
    } = req.body;

    const worker = await Worker.findOne({
      where: {
        userId: req.user.id,
      },
    });

    if (!worker) {
      return res.status(404).json({
        error: 'Worker not found',
      });
    }

    let bankDetail =
      await BankDetail.findOne({
        where: {
          workerId: worker.id,
        },
      });

    if (bankDetail) {
      await bankDetail.update({
        accountHolderName,
        accountNumber,
        ifscCode,
        bankName,
        branchName,
        upiId,
      });
    } else {
      bankDetail =
        await BankDetail.create({
          workerId: worker.id,
          accountHolderName,
          accountNumber,
          ifscCode,
          bankName,
          branchName,
          upiId,
        });
    }

    return res.status(200).json({
      success: true,
      data: bankDetail,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get worker bank details
 */
exports.getBankDetails = async (req, res, next) => {
  try {
    const worker = await Worker.findOne({
      where: {
        userId: req.user.id,
      },
    });

    if (!worker) {
      return res.status(404).json({
        error: 'Worker not found',
      });
    }

    const bankDetail =
      await BankDetail.findOne({
        where: {
          workerId: worker.id,
        },
      });

    return res.status(200).json({
      success: true,
      data: bankDetail,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// Admin - Get All Workers
// ─────────────────────────────────────────────────────────────

/**
 * Admin:
 * Get all workers with filters
 *
 * Supported query parameters:
 *
 * page
 * limit
 * profession
 * isVerified
 * isAvailable
 * status
 * search
 */
exports.getAllWorkers = async (req, res, next) => {
  try {
    const {
      page,
      limit,
      profession,
      isVerified,
      isAvailable,
      status,
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

    // Profession filter
    if (
      profession &&
      profession !== 'all'
    ) {
      where.profession =
        profession;
    }

    // Verification filter
    if (
      isVerified !== undefined &&
      isVerified !== ''
    ) {
      where.isVerified =
        isVerified === 'true';
    }

    // Status filter
    if (
      status &&
      status !== 'all'
    ) {
      where.status = status;
    }

    // Backward compatibility:
    // Admin frontend may still send isAvailable
    if (
      !status &&
      isAvailable !== undefined &&
      isAvailable !== ''
    ) {
      where.status =
        isAvailable === 'true'
          ? 'active'
          : 'inactive';
    }

    // Search
    if (
      search &&
      search.trim()
    ) {
      const searchValue =
        search.trim();

      where[Op.or] = [
        {
          profession: {
            [Op.like]:
              `%${searchValue}%`,
          },
        },

        {
          '$User.name$': {
            [Op.like]:
              `%${searchValue}%`,
          },
        },

        {
          '$User.mobile$': {
            [Op.like]:
              `%${searchValue}%`,
          },
        },
      ];
    }

    const data =
      await Worker.findAndCountAll({
        where,

        include: [
          {
            model: User,
            attributes: [
              'id',
              'name',
              'mobile',
            ],
          },

          {
            model: BankDetail,
          },

          {
            model: Document,
            where: {
              isVerified: true,
            },
            required: false,
          },
        ],

        order: [
          ['createdAt', 'DESC'],
        ],

        offset,

        limit: lim,

        distinct: true,
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
      'getAllWorkers error:',
      error
    );

    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// Admin - Get Professions
// ─────────────────────────────────────────────────────────────

/**
 * Admin:
 * Get workers by profession
 */
exports.getProfessions = async (
  req,
  res,
  next
) => {
  try {
    const professions =
      await Worker.findAll({
        attributes: [
          'profession',
        ],

        group: [
          'profession',
        ],

        raw: true,
      });

    const list =
      professions
        .map(
          (item) =>
            item.profession
        )
        .filter(Boolean);

    return res.status(200).json({
      success: true,
      data: list,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// Admin - Verify Worker
// ─────────────────────────────────────────────────────────────

/**
 * Admin:
 * Verify worker
 */
exports.verifyWorker = async (
  req,
  res,
  next
) => {
  try {
    const { id } =
      req.params;

    const worker =
      await Worker.findByPk(id);

    if (!worker) {
      return res.status(404).json({
        error: 'Worker not found',
      });
    }

    await worker.update({
      isVerified: true,
    });

    return res.status(200).json({
      success: true,
      data: worker,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// Admin - Verify Bank Details
// ─────────────────────────────────────────────────────────────

/**
 * Admin:
 * Verify worker bank details
 */
exports.verifyBankDetails = async (
  req,
  res,
  next
) => {
  try {
    const { id } =
      req.params;

    const bankDetail =
      await BankDetail.findOne({
        where: {
          workerId: id,
        },
      });

    if (!bankDetail) {
      return res.status(404).json({
        error:
          'Bank details not found',
      });
    }

    await bankDetail.update({
      isVerified: true,
    });

    return res.status(200).json({
      success: true,
      data: bankDetail,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// Admin - Delete Worker
// ─────────────────────────────────────────────────────────────

/**
 * Admin:
 * Delete worker
 */
exports.deleteWorker = async (
  req,
  res,
  next
) => {
  try {
    const { id } =
      req.params;

    const worker =
      await Worker.findByPk(id);

    if (!worker) {
      return res.status(404).json({
        error: 'Worker not found',
      });
    }

    await worker.destroy();

    return res.status(200).json({
      success: true,
      message:
        'Worker deleted',
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// Admin - Full Worker Details
// ─────────────────────────────────────────────────────────────

/**
 * Admin:
 * Get worker with complete details
 *
 * Includes:
 *
 * User
 * Documents
 * Bank Details
 * Jobs
 * Booking
 * Payment
 * Reviews
 */
exports.getWorkerFullDetails = async (
  req,
  res,
  next
) => {
  try {
    const { id } =
      req.params;

    const worker =
      await Worker.findByPk(id, {
        include: [
          // User
          {
            model: User,
            attributes: [
              'id',
              'name',
              'mobile',
              'email',
            ],
          },

          // Documents
          {
            model: Document,
          },

          // Bank details
          {
            model: BankDetail,
          },

          // Jobs
          {
            model: Job,

            include: [
              {
                model: Booking,

                include: [
                  {
                    model: Payment,
                  },
                ],
              },
            ],
          },

          // Reviews
          {
            model: Review,

            include: [
              {
                model: User,
                attributes: [
                  'id',
                  'name',
                ],
              },
            ],
          },
        ],
      });

    if (!worker) {
      return res.status(404).json({
        error: 'Worker not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: worker,
    });
  } catch (error) {
    console.error(
      'getWorkerFullDetails error:',
      error
    );

    next(error);
  }
};