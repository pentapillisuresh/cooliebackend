const { Document, Worker } = require('../models');
const { DOCUMENT_TYPES } = require('../utils/constants');

/**
 * Upload a document (worker) – uses multer middleware
 * Expects req.uploadedFile from upload middleware
 */
exports.uploadDocument = async (req, res, next) => {
  try {
    const { documentType } = req.body;

    if (!documentType || !Object.values(DOCUMENT_TYPES).includes(documentType)) {
      return res.status(400).json({ error: 'Valid document type is required' });
    }

    // Get worker profile for the authenticated user
    const worker = await Worker.findOne({ where: { userId: req.user.id } });
    if (!worker) {
      return res.status(404).json({ error: 'Worker profile not found' });
    }

    // req.uploadedFile is set by uploadSingle middleware
    const file = req.uploadedFile;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const document = await Document.create({
      workerId: worker.id,
      documentType,
      fileName: file.filename,
      filePath: file.fullUrl,
      mimeType: req.file.mimetype,
      isVerified: false,
    });

    res.status(201).json({
      success: true,
      data: document,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all documents for the authenticated worker
 */
exports.getMyDocuments = async (req, res, next) => {
  try {
    const worker = await Worker.findOne({ where: { userId: req.user.id } });
    if (!worker) {
      return res.status(404).json({ error: 'Worker profile not found' });
    }
    const documents = await Document.findAll({
      where: { workerId: worker.id },
      order: [['uploadedAt', 'DESC']],
    });
    res.status(200).json({
      success: true,
      data: documents,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a specific document by ID (worker or admin)
 */
exports.getDocumentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const document = await Document.findByPk(id, {
      include: [{ model: Worker, include: [{ model: User, attributes: ['id', 'name', 'mobile'] }] }],
    });
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    // Check access: worker owns it or admin
    const worker = await Worker.findOne({ where: { userId: req.user.id } });
    if (req.user.role !== 'admin' && document.workerId !== worker?.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.status(200).json({
      success: true,
      data: document,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a document (worker or admin)
 */
exports.deleteDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const document = await Document.findByPk(id);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    const worker = await Worker.findOne({ where: { userId: req.user.id } });
    if (req.user.role !== 'admin' && document.workerId !== worker?.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    await document.destroy();
    res.status(200).json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Verify a document (set isVerified = true)
 */
exports.verifyDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const document = await Document.findByPk(id);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    await document.update({ isVerified: true });
    res.status(200).json({
      success: true,
      data: document,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Get all documents with filters (by workerId, documentType, verified status)
 */
exports.getAllDocuments = async (req, res, next) => {
  try {
    const { workerId, documentType, isVerified, page, limit } = req.query;
    const { offset, limit: lim } = require('../utils/helpers').getPagination(page, limit);

    const where = {};
    if (workerId) where.workerId = workerId;
    if (documentType) where.documentType = documentType;
    if (isVerified !== undefined) where.isVerified = isVerified === 'true';

    const data = await Document.findAndCountAll({
      where,
      include: [{ model: Worker, include: [{ model: User, attributes: ['id', 'name', 'mobile'] }] }],
      order: [['uploadedAt', 'DESC']],
      offset,
      limit: lim,
    });

    const paginated = require('../utils/helpers').getPagingData(data, page, lim);

    res.status(200).json({
      success: true,
      data: paginated,
    });
  } catch (error) {
    next(error);
  }
};