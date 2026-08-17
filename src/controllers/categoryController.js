const { Category, Service } = require('../models');
const { getPagination, getPagingData } = require('../utils/helpers');

/**
 * Get all categories (public)
 */
exports.getAllCategories = async (req, res, next) => {
  try {
    const data = await Category.findAll({
      where: { isActive: true },
      order: [['sortOrder', 'ASC']],
      include: [
        {
          model: Service,
          where: { isActive: true },
          required: false, // include even if no services
          order: [['name', 'ASC']],
        }
      ],
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};  
/**
 * Get single category by ID (public)
 */
exports.getCategoryById = async (req, res, next) => {
  console.log("==== getCategoryById ====");
  console.log(req.params);
  try {
    const { id } = req.params;

    const category = await Category.findByPk(id, {
      include: [{ model: Service, where: { isActive: true }, required: false }],
    });
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.status(200).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new category (Admin only)
 */
exports.createCategory = async (req, res, next) => {
  try {
    const { name, slug, icon, description, sortOrder, image } = req.body;
    const category = await Category.create({
      name,
      slug,
      icon,
      description,
      sortOrder: sortOrder || 0,
      image,
    });
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a category (Admin only)
 */
exports.updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await Category.findByPk(id);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    await category.update(req.body);
    res.status(200).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete (soft delete) a category (Admin only)
 */
exports.deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await Category.findByPk(id);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    await category.destroy();
    res.status(200).json({ success: true, message: 'Category deleted' });
  } catch (error) {
    next(error);
  }
};

exports.getCategoryWithSchema = async (req, res, next) => {
  console.log("==== getCategoryWithSchema ====");
  console.log(req.params);
  try {
    const { slug } = req.params;
    const category = await Category.findOne({
      where: { slug, isActive: true },
      include: [
        {
          model: Service,
          where: { isActive: true },
          required: false,
        },
      ],
    });
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    // Build form schema from services
    const services = category.Services.map(service => ({
      id: service.id,
      name: service.name,
      slug: service.slug,
      basePrice: service.basePrice,
      duration: service.duration,
      description: service.description,
      metadata: service.metadata || {},
      // Form fields from metadata
      fields: service.metadata?.formFields || [],
    }));
    res.status(200).json({
      success: true,
      data: {
        category,
        services,
        totalServices: services.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── NEW: Get all categories with service count ──────────────────────
exports.getAllCategoriesWithCount = async (req, res, next) => {
  try {
    const categories = await Category.findAll({
      where: { isActive: true },
      attributes: {
        include: [
          [
            sequelize.literal('(SELECT COUNT(*) FROM Services WHERE Services.categoryId = Category.id AND Services.isActive = true)'),
            'serviceCount',
          ],
        ],
      },
      order: [['sortOrder', 'ASC']],
    });
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
};

// ─── NEW: Bulk update sort order ──────────────────────────────────────
exports.bulkUpdateSortOrder = async (req, res, next) => {
  try {
    const { categories } = req.body; // Array of { id, sortOrder }
    if (!categories || !Array.isArray(categories)) {
      return res.status(400).json({ error: 'Categories array is required' });
    }
    const updates = categories.map(cat => ({
      id: cat.id,
      sortOrder: cat.sortOrder,
    }));
    await Promise.all(updates.map(({ id, sortOrder }) =>
      Category.update({ sortOrder }, { where: { id } })
    ));
    res.status(200).json({ success: true, message: 'Sort order updated' });
  } catch (error) {
    next(error);
  }
};