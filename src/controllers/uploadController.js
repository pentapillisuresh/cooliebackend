const fs = require('fs');
const path = require('path');
const { deleteFile } = require('../services/processUpload');
const { getUploadSignedUrl, getReadSignedUrl } = require('../services/gcsService');

// Single file upload
exports.uploadSingleFile = (req, res) => {
  if (!req.uploadedFile) {
    return res.status(400).json({
      error: 'File upload failed',
    });
  }

  res.status(200).json({
    success: true,
    data: req.uploadedFile,
  });
};


exports.uploadMultipleFiles = (req, res) => {
  if (!req.uploadedFiles || req.uploadedFiles.length === 0) {
    return res.status(400).json({
      error: 'No files uploaded',
    });
  }

  res.status(200).json({
    success: true,
    data: req.uploadedFiles,
  });
};

// ─── NEW: Delete a single file ────────────────────────────────────────

exports.deleteFile = async (req, res, next) => {
  try {
    let { filePath } = req.params;

    console.log('Delete request params:', req.params);

    // Express 5 wildcard parameters can be arrays
    if (Array.isArray(filePath)) {
      filePath = filePath.join('/');
    }

    if (typeof filePath !== 'string' || !filePath) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file path',
      });
    }

    // Security checks
    if (
      filePath.includes('..') ||
      filePath.startsWith('/') ||
      filePath.includes('\\')
    ) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file path',
      });
    }

    console.log('Deleting GCS file:', filePath);

    const deleted = await deleteFile(filePath);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'File not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'File deleted successfully',
      path: filePath,
    });

  } catch (error) {
    console.error('Delete file error:', error);
    next(error);
  }
};

// ─── NEW: Upload video for training ───────────────────────────────────
exports.uploadVideo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video uploaded' });
    }
    const { filename, path: filePath, fullUrl } = await processSingleFile(req.file);
    res.status(200).json({
      success: true,
      data: {
        filename,
        path: filePath,
        fullUrl,
        mimeType: req.file.mimetype,
        size: req.file.size,
      },
    });
  } catch (error) {
    next(error);
  }
};
exports.signedUrl = async (req, res) => {
  try {
    const { fileName, mimeType, fileType = 'image' } = req.body;

    if (!fileName || !mimeType) {
      return res
        .status(400)
        .json({ error: 'fileName and mimeType are required' });
    }

    let subFolder = 'images';
    let maxSizeBytes = 10 * 1024 * 1024; // 10 MB for images

    if (fileType === 'document' || mimeType === 'application/pdf') {
      subFolder = 'documents';
      maxSizeBytes = 25 * 1024 * 1024;   // 25 MB for documents
    }

    const result = await getUploadSignedUrl(
      fileName,
      mimeType,
      subFolder,
      maxSizeBytes
    );

    res.status(200).json({
      success: true,
      data: {
        uploadUrl: result.url,
        filePath: result.filePath,
        fullUrl: result.fullUrl,
        requiredHeaders: result.requiredHeaders,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }};

exports.signedReadUrl = async (req, res) => {
  try {
    const { path: filePath } = req.query;
    if (!filePath) {
      return res.status(400).json({ error: 'path query param is required' });
    }

    const url = await getReadSignedUrl(filePath, 60 * 60 * 1000); // 1 hour

    res.json({
      success: true,
      data: { url, expiresIn: 3600 },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }};

