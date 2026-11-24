const { Service, Category } = require('../models');
const { Op } = require('sequelize');

// ── Create Service ──
exports.createService = async (req, res, next) => {
  try {
    const { 
      categoryId, name, slug, description, basePrice, 
      duration, image, metadata, pricingUnit, position, isActive 
    } = req.body;

    // Check if category exists
    const category = await Category.findByPk(categoryId);
    if (!category) return res.status(404).json({ error: 'Category not found' });

    // Check slug uniqueness
    const existing = await Service.findOne({ where: { slug } });
    if (existing) return res.status(400).json({ error: 'Service slug already exists' });

    const service = await Service.create({
      categoryId,
      name,
      slug,
      description,
      basePrice: parseFloat(basePrice) || 0,
      duration: parseInt(duration) || null,
      image,
      metadata, // Save the JSON object directly
      pricingUnit,
      position: parseInt(position) || 0,
      isActive: isActive !== undefined ? isActive : true,
    });

    res.status(201).json({ success: true, data: service });
  } catch (error) {
    next(error);
  }
};

// ── Update Service ──
exports.updateService = async (req, res, next) => {
  try {
    const { id } = req.params;
    const service = await Service.findByPk(id);
    if (!service) return res.status(404).json({ error: 'Service not found' });

    const { 
      categoryId, name, slug, description, basePrice, 
      duration, image, metadata, pricingUnit, position, isActive 
    } = req.body;

    if (slug && slug !== service.slug) {
      const existing = await Service.findOne({ where: { slug } });
      if (existing) return res.status(400).json({ error: 'Service slug already exists' });
    }

    await service.update({
      categoryId: categoryId || service.categoryId,
      name: name || service.name,
      slug: slug || service.slug,
      description: description !== undefined ? description : service.description,
      basePrice: basePrice !== undefined ? parseFloat(basePrice) : service.basePrice,
      duration: duration !== undefined ? parseInt(duration) : service.duration,
      image: image !== undefined ? image : service.image,
      metadata: metadata !== undefined ? metadata : service.metadata,
      pricingUnit: pricingUnit !== undefined ? pricingUnit : service.pricingUnit,
      position: position !== undefined ? parseInt(position) : service.position,
      isActive: isActive !== undefined ? isActive : service.isActive,
    });

    res.json({ success: true, data: service });
  } catch (error) {
    next(error);
  }
};

// ── Toggle Active Status ──
exports.toggleStatus = async (req, res, next) => {
  try {
    const service = await Service.findByPk(req.params.id);
    if (!service) return res.status(404).json({ error: 'Service not found' });

    await service.update({ isActive: !service.isActive });
    
    res.json({ 
      success: true, 
      message: `Service ${service.isActive ? 'activated' : 'deactivated'}`,
      data: service 
    });
  } catch (error) {
    next(error);
  }
};

// ── Delete Service (Soft Delete) ──
exports.deleteService = async (req, res, next) => {
  try {
    const service = await Service.findByPk(req.params.id);
    if (!service) return res.status(404).json({ error: 'Service not found' });

    await service.destroy(); // Soft delete due to paranoid: true
    
    res.json({ success: true, message: 'Service deleted successfully' });
  } catch (error) {
    next(error);
  }
};