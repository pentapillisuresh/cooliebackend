const {
  Service,
  Category,
  Booking,
  Worker,
  sequelize,
} = require('../models');

const {
  getPagination,
  getPagingData,
} = require('../utils/helpers');

const {
  Op,
} = require('sequelize');


// ============================================================
// GET TOP SERVICES
// ============================================================

/**
 * Get top 10 services by completed booking count
 */
exports.getTopServices = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;

    const topServices = await Booking.findAll({
      attributes: [
        'serviceId',
        [
          sequelize.fn(
            'COUNT',
            sequelize.col('Booking.serviceId')
          ),
          'bookingCount',
        ],
      ],

      where: {
        status: 'completed',
      },

      group: ['serviceId'],

      order: [
        [
          sequelize.literal('bookingCount'),
          'DESC',
        ],
      ],

      limit: parseInt(limit, 10),

      include: [
        {
          model: Service,

          attributes: [
            'id',
            'categoryId',
            'name',
            'slug',
            'image',
            'description',
            'basePrice',
            'duration',
            'isActive',
            'metadata',
          ],

          include: [
            {
              model: Category,
              attributes: [
                'id',
                'name',
                'slug',
              ],
            },
          ],
        },
      ],

      raw: true,
      nest: true,
    });

    const result = topServices.map((item) => ({
      service: item.Service,
      bookingCount: item.bookingCount,
    }));

    return res.status(200).json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error(
      'getTopServices error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
      sql: error.sql,
    });
  }
};


// ============================================================
// GET ALL SERVICES
// ============================================================

/**
 * Get all services
 * Supports:
 * categoryId
 * isActive
 * pagination
 */
exports.getAllServices = async (req, res, next) => {
  try {
    const {
      page,
      limit,
      categoryId,
      isActive,
    } = req.query;

    const {
      offset,
      limit: lim,
    } = getPagination(
      page,
      limit
    );

    const where = {};

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (isActive !== undefined) {
      where.isActive =
        isActive === 'true';
    }

    const data =
      await Service.findAndCountAll({
        where,

        include: [
          {
            model: Category,
          },
        ],

        order: [
          ['name', 'ASC'],
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
    next(error);
  }
};


// ============================================================
// GET SERVICE BY ID
// ============================================================

/**
 * Get a single service by ID
 */
exports.getServiceById = async (
  req,
  res,
  next
) => {
  try {
    const { id } = req.params;

    console.log(
      'Service ID:',
      id
    );

    const service =
      await Service.findByPk(
        id,
        {
          include: [
            {
              model: Category,
            },
          ],
        }
      );

    if (!service) {
      return res.status(404).json({
        success: false,
        error: 'Service not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: service,
    });

  } catch (error) {
    next(error);
  }
};


// ============================================================
// CREATE SERVICE
// ============================================================

/**
 * Create a new service
 * Admin only
 */
exports.createService = async (
  req,
  res,
  next
) => {
  try {
    const {
      categoryId,
      name,
      slug,
      description,
      basePrice,
      duration,
      image,
      metadata,
    } = req.body;

    // --------------------------------------------------------
    // Validate category
    // --------------------------------------------------------

    const category =
      await Category.findByPk(
        categoryId
      );

    if (!category) {
      return res.status(400).json({
        success: false,
        error: 'Invalid category',
      });
    }

    // --------------------------------------------------------
    // Create service
    // --------------------------------------------------------

    const service =
      await Service.create({
        categoryId,
        name,
        slug,
        description,
        basePrice,
        duration,
        image,

        // IMPORTANT:
        // metadata is stored as JSON
        metadata:
          metadata || {},

        isActive: true,
      });

    // --------------------------------------------------------
    // Return service with category
    // --------------------------------------------------------

    const createdService =
      await Service.findByPk(
        service.id,
        {
          include: [
            {
              model: Category,
            },
          ],
        }
      );

    return res.status(201).json({
      success: true,
      data: createdService,
    });

  } catch (error) {
    next(error);
  }
};


// ============================================================
// UPDATE SERVICE
// ============================================================

/**
 * Update a service
 * Admin only
 */
exports.updateService = async (
  req,
  res,
  next
) => {
  try {
    const { id } = req.params;

    const updates = {
      ...req.body,
    };

    const service =
      await Service.findByPk(id);

    if (!service) {
      return res.status(404).json({
        success: false,
        error: 'Service not found',
      });
    }

    // --------------------------------------------------------
    // Validate category if changed
    // --------------------------------------------------------

    if (
      updates.categoryId !== undefined
    ) {
      const category =
        await Category.findByPk(
          updates.categoryId
        );

      if (!category) {
        return res.status(400).json({
          success: false,
          error: 'Invalid category',
        });
      }
    }

    // --------------------------------------------------------
    // Make sure metadata is an object
    // --------------------------------------------------------

    if (
      updates.metadata !== undefined &&
      updates.metadata === null
    ) {
      updates.metadata = {};
    }

    // --------------------------------------------------------
    // Update
    // --------------------------------------------------------

    await service.update(
      updates
    );

    // --------------------------------------------------------
    // Get updated service
    // --------------------------------------------------------

    const updatedService =
      await Service.findByPk(
        id,
        {
          include: [
            {
              model: Category,
            },
          ],
        }
      );

    return res.status(200).json({
      success: true,
      data: updatedService,
    });

  } catch (error) {
    next(error);
  }
};


// ============================================================
// DELETE SERVICE
// ============================================================

/**
 * Delete service
 * Soft delete
 */
exports.deleteService = async (
  req,
  res,
  next
) => {
  try {
    const { id } = req.params;

    const service =
      await Service.findByPk(id);

    if (!service) {
      return res.status(404).json({
        success: false,
        error: 'Service not found',
      });
    }

    await service.destroy();

    return res.status(200).json({
      success: true,
      message:
        'Service deleted successfully',
    });

  } catch (error) {
    next(error);
  }
};


// ============================================================
// GET SERVICES BY CATEGORY SLUG
// ============================================================

/**
 * Get services by category slug
 */
exports.getServicesByCategorySlug =
  async (
    req,
    res,
    next
  ) => {
    try {
      const { slug } =
        req.params;

      const category =
        await Category.findOne({
          where: {
            slug,
          },
        });

      if (!category) {
        return res.status(404).json({
          success: false,
          error: 'Category not found',
        });
      }

      const services =
        await Service.findAll({
          where: {
            categoryId:
              category.id,

            isActive: true,
          },

          include: [
            {
              model: Category,
            },
          ],

          order: [
            ['name', 'ASC'],
          ],
        });

      return res.status(200).json({
        success: true,
        data: services,
      });

    } catch (error) {
      next(error);
    }
  };


// ============================================================
// TOGGLE SERVICE STATUS
// ============================================================

/**
 * Toggle service active status
 */
exports.toggleServiceStatus =
  async (
    req,
    res,
    next
  ) => {
    try {
      const { id } =
        req.params;

      const service =
        await Service.findByPk(
          id
        );

      if (!service) {
        return res.status(404).json({
          success: false,
          error: 'Service not found',
        });
      }

      await service.update({
        isActive:
          !service.isActive,
      });

      const updatedService =
        await Service.findByPk(
          id,
          {
            include: [
              {
                model: Category,
              },
            ],
          }
        );

      return res.status(200).json({
        success: true,
        data: updatedService,
      });

    } catch (error) {
      next(error);
    }
  };


// ============================================================
// GET SERVICE SCHEMA
// ============================================================

exports.getServiceSchema =
  async (
    req,
    res,
    next
  ) => {
    try {
      const { id } =
        req.params;

      const service =
        await Service.findByPk(
          id,
          {
            include: [
              {
                model: Category,
              },
            ],
          }
        );

      if (!service) {
        return res.status(404).json({
          success: false,
          error: 'Service not found',
        });
      }

      // ------------------------------------------------------
      // Build form schema from metadata
      // ------------------------------------------------------

      const metadata =
        service.metadata || {};

      const schema = {
        fields:
          metadata.formFields ||
          [],

        validation:
          metadata.validation ||
          {},

        priceCalculation:
          metadata.priceCalculation ||
          {
            type: 'fixed',
          },
      };

      return res.status(200).json({
        success: true,
        data: schema,
      });

    } catch (error) {
      next(error);
    }
  };


// ============================================================
// CHECK SERVICE AVAILABILITY
// ============================================================

/**
 * Check service availability for date/time
 */
exports.checkAvailability =
  async (
    req,
    res,
    next
  ) => {
    try {
      const { id } =
        req.params;

      const {
        date,
        time,
        workers,
      } = req.query;

      // ------------------------------------------------------
      // Get service WITH category
      // ------------------------------------------------------

      const service =
        await Service.findByPk(
          id,
          {
            include: [
              {
                model: Category,
              },
            ],
          }
        );

      if (!service) {
        return res.status(404).json({
          success: false,
          error: 'Service not found',
        });
      }

      // ------------------------------------------------------
      // Booking query
      // ------------------------------------------------------

      const where = {
        serviceId: id,

        status: {
          [Op.in]: [
            'pending',
            'accepted',
            'in_progress',
          ],
        },
      };

      // Only add date if provided

      if (date) {
        where.scheduledDate =
          date;
      }

      // Only add time if provided

      if (time) {
        where.scheduledTime =
          time;
      }

      const count =
        await Booking.count({
          where,
        });

      // ------------------------------------------------------
      // Get max bookings from metadata
      // ------------------------------------------------------

      const metadata =
        service.metadata || {};

      const maxBookings =
        Number(
          metadata.maxBookingsPerSlot ||
          3
        );

      // ------------------------------------------------------
      // Available workers
      // ------------------------------------------------------

      let availableWorkers = [];

      if (
        workers === 'true'
      ) {
        availableWorkers =
          await Worker.findAll({
            where: {
              isVerified: true,

              status: 'active',

              profession:
                service.Category?.name,
            },
          });
      }

      // ------------------------------------------------------
      // Response
      // ------------------------------------------------------

      return res.status(200).json({
        success: true,

        data: {
          serviceId: id,

          date:
            date || null,

          time:
            time || null,

          currentBookings:
            count,

          maxBookings,

          available:
            count <
            maxBookings,

          availableWorkers,
        },
      });

    } catch (error) {
      console.error(
        'checkAvailability error:',
        error
      );

      next(error);
    }
  };