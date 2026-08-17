const { Service, Category, Booking, sequelize } = require('../models');
const { getPagination, getPagingData } = require('../utils/helpers');


/**
 * Get top 10 services by completed booking count
 */
exports.getTopServices = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;

    const topServices = await Booking.findAll({
      attributes: [
        'serviceId',
        [sequelize.fn('COUNT', sequelize.col('Booking.serviceId')), 'bookingCount']
      ],
      where: { status: 'completed' },
      group: ['serviceId'],
      order: [[sequelize.literal('bookingCount'), 'DESC']],
      limit: parseInt(limit, 10),
      include: [
        {
          model: Service,
          attributes: ['id', 'name', 'slug', 'image', 'description', 'basePrice', 'duration'],
          include: [{ model: Category, attributes: ['id', 'name', 'slug'] }],
        },
      ],
      raw: true,
      nest: true,
    });

    // Format the response
    const result = topServices.map((item) => ({
      service: item.Service,
      bookingCount: item.bookingCount,
    }));

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: error.message,
      sql: error.sql,
    });
  }
};

/**
 * Get all services (public)
 * Supports filtering by categoryId, isActive, and pagination
 */
exports.getAllServices = async (req, res, next) => {
  try {
    const { page, limit, categoryId, isActive } = req.query;
    const { offset, limit: lim } = getPagination(page, limit);

    const where = {};
    if (categoryId) where.categoryId = categoryId;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const data = await Service.findAndCountAll({
      where,
      include: [{ model: Category }],
      order: [['name', 'ASC']],
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
 * Get a single service by ID (public)
 */
exports.getServiceById = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log("id::".id)
    const service = await Service.findByPk(id, {
      include: [{ model: Category }],
    });
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }
    res.status(200).json({
      success: true,
      data: service,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new service (Admin only)
 */
exports.createService = async (req, res, next) => {
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

    // Verify category exists
    const category = await Category.findByPk(categoryId);
    if (!category) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    const service = await Service.create({
      categoryId,
      name,
      slug,
      description,
      basePrice,
      duration,
      image,
      metadata: metadata || {},
      isActive: true,
    });

    res.status(201).json({
      success: true,
      data: service,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a service (Admin only)
 */
exports.updateService = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const service = await Service.findByPk(id);
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // If categoryId is being updated, verify it exists
    if (updates.categoryId) {
      const category = await Category.findByPk(updates.categoryId);
      if (!category) {
        return res.status(400).json({ error: 'Invalid category' });
      }
    }

    await service.update(updates);

    res.status(200).json({
      success: true,
      data: service,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete (soft delete) a service (Admin only)
 */
exports.deleteService = async (req, res, next) => {
  try {
    const { id } = req.params;
    const service = await Service.findByPk(id);
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }
    await service.destroy();
    res.status(200).json({
      success: true,
      message: 'Service deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get services by category slug (public)
 */
exports.getServicesByCategorySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const category = await Category.findOne({ where: { slug } });
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    const services = await Service.findAll({
      where: { categoryId: category.id, isActive: true },
      order: [['name', 'ASC']],
    });
    res.status(200).json({
      success: true,
      data: services,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle service active status (Admin only)
 */
exports.toggleServiceStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const service = await Service.findByPk(id);
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }
    await service.update({ isActive: !service.isActive });
    res.status(200).json({
      success: true,
      data: service,
    });
  } catch (error) {
    next(error);
  }
};

exports.getServiceSchema = async (req, res, next) => {
  try {
    const { id } = req.params;
    const service = await Service.findByPk(id, {
      include: [{ model: Category }],
    });
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Build form schema from metadata
    const schema = {
      fields: service.metadata?.formFields || [],
      validation: service.metadata?.validation || {},
      priceCalculation: service.metadata?.priceCalculation || { type: 'fixed' },
    };

    res.status(200).json({ success: true, data: schema });
  } catch (error) {
    next(error);
  }
};

// ─── NEW: Check service availability for date/time ────────────────────
exports.checkAvailability = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { date, time, workers } = req.query;

    // Check if service exists
    const service = await Service.findByPk(id);
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Count existing bookings for that date/time
    const where = {
      serviceId: id,
      scheduledDate: date,
      scheduledTime: time,
      status: {
        [Op.in]: [BOOKING_STATUS.PENDING, BOOKING_STATUS.ACCEPTED, BOOKING_STATUS.IN_PROGRESS],
      },
    };
    const count = await Booking.count({ where });

    // If workers param provided, check worker availability
    let availableWorkers = [];
    if (workers === 'true') {
      availableWorkers = await Worker.findAll({
        where: {
          isVerified: true,
          isAvailable: true,
          profession: service.Category?.name,
        },
      });
    }

    res.status(200).json({
      success: true,
      data: {
        serviceId: id,
        date,
        time,
        currentBookings: count,
        maxBookings: service.metadata?.maxBookingsPerSlot || 3,
        available: count < (service.metadata?.maxBookingsPerSlot || 3),
        availableWorkers,
      },
    });
  } catch (error) {
    next(error);
  }
};
