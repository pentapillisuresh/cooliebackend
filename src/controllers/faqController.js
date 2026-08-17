const { FAQ } = require('../models');
const { getPagination, getPagingData } = require('../utils/helpers');
const { USER_ROLES } = require('../utils/constants');

/**
 * Public: Get all active FAQs with pagination and category filter
 */
exports.getFAQs = async (req, res, next) => {
  try {
    const { page, limit, category } = req.query;
    const { offset, limit: lim } = getPagination(page, limit);

    const where = { isActive: true };
    if (category) where.category = category;

    const data = await FAQ.findAndCountAll({
      where,
      order: [['sortOrder', 'ASC']],
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
 * Public: Get a single FAQ by ID (only if active)
 */
exports.getFAQById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const faq = await FAQ.findOne({
      where: { id, isActive: true },
    });
    if (!faq) {
      return res.status(404).json({ error: 'FAQ not found' });
    }
    res.status(200).json({ success: true, data: faq });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Create a new FAQ
 */
exports.createFAQ = async (req, res, next) => {
  try {
    const { question, answer, category, sortOrder } = req.body;

    if (!question || !answer) {
      return res.status(400).json({ error: 'Question and answer are required' });
    }

    const faq = await FAQ.create({
      question,
      answer,
      category: category || 'general',
      sortOrder: sortOrder || 0,
      isActive: true,
    });

    res.status(201).json({ success: true, data: faq });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Update an existing FAQ
 */
exports.updateFAQ = async (req, res, next) => {
  try {
    const { id } = req.params;
    const faq = await FAQ.findByPk(id);
    if (!faq) {
      return res.status(404).json({ error: 'FAQ not found' });
    }

    // Only allow updating certain fields
    const { question, answer, category, sortOrder, isActive } = req.body;
    await faq.update({
      question: question || faq.question,
      answer: answer || faq.answer,
      category: category !== undefined ? category : faq.category,
      sortOrder: sortOrder !== undefined ? sortOrder : faq.sortOrder,
      isActive: isActive !== undefined ? isActive : faq.isActive,
    });

    res.status(200).json({ success: true, data: faq });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Delete an FAQ (soft delete)
 */
exports.deleteFAQ = async (req, res, next) => {
  try {
    const { id } = req.params;
    const faq = await FAQ.findByPk(id);
    if (!faq) {
      return res.status(404).json({ error: 'FAQ not found' });
    }
    await faq.destroy(); // assumes paranoid: true
    res.status(200).json({ success: true, message: 'FAQ deleted' });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Bulk update sort order for FAQs
 */
exports.bulkUpdateSortOrder = async (req, res, next) => {
  try {
    const { faqs } = req.body; // array of { id, sortOrder }
    if (!faqs || !Array.isArray(faqs)) {
      return res.status(400).json({ error: 'FAQs array is required' });
    }

    const updates = faqs.map(({ id, sortOrder }) =>
      FAQ.update({ sortOrder }, { where: { id } })
    );
    await Promise.all(updates);

    res.status(200).json({ success: true, message: 'Sort order updated' });
  } catch (error) {
    next(error);
  }
};