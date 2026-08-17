const fs = require('fs');
const path = require('path');


// Single file upload
exports.uploadSingleFile = (req, res) => {

  if (!req.uploadedFile) {
    return res.status(400).json({ error: 'File upload failed' });
  }
  res.status(200).json({
    success: true,
    data: req.uploadedFile,
  });
};

// Multiple files upload
exports.uploadMultipleFiles = (req, res) => {
  if (!req.uploadedFiles || req.uploadedFiles.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }
  res.status(200).json({
    success: true,
    data: req.uploadedFiles,
  });
};

// ─── NEW: Delete a single file ────────────────────────────────────────
exports.deleteFile = async (req, res, next) => {
  try {
    const { filePath } = req.params;
    const fullPath = path.join(__dirname, '../uploads', filePath);

    // Security: Prevent directory traversal
    const normalized = path.normalize(fullPath);
    if (!normalized.startsWith(path.join(__dirname, '../uploads'))) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    if (fs.existsSync(normalized)) {
      fs.unlinkSync(normalized);
    } else {
      return res.status(404).json({ error: 'File not found' });
    }

    res.status(200).json({ success: true, message: 'File deleted successfully' });
  } catch (error) {
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

