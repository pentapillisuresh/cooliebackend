const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const { processImage } = require('../config/sharp');

// ─── Ensure upload directories exist ────────────────────────────────
const createUploadDirs = () => {
  const dirs = [
    path.join(__dirname, '../uploads/images'),
    path.join(__dirname, '../uploads/documents'),
  ];
  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};
createUploadDirs();

// ─── Multer configuration ─────────────────────────────────────────────
const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, WEBP and PDF are allowed.'), false);
  }
};

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// ─── Process a single image (with Sharp) ────────────────────────────
const processSingleImage = async (file, subFolder = 'images') => {
  // Generate unique filename
  const ext = path.extname(file.originalname) || '.jpg';
  const filename = `${uuidv4()}-${Date.now()}${ext}`;
  const savePath = path.join(__dirname, `../uploads/${subFolder}`, filename);

  // Process image using centralised Sharp configuration
  const processedBuffer = await processImage(file.buffer, {
    width: 1200,          // Max width
    height: 1200,         // Max height
    jpegQuality: 80,      // JPEG compression (0-100)
    fit: 'inside',        // Preserve aspect ratio
    withoutEnlargement: true,
  });

  // Write the processed buffer to disk
  await sharp(processedBuffer).toFile(savePath);

  return {
    filename,
    path: `/uploads/${subFolder}/${filename}`,
    fullUrl: `${process.env.BASE_URL}/uploads/${subFolder}/${filename}`,
  };
};

// ─── Process a single file (image or PDF) ───────────────────────────
const processSingleFile = async (file) => {
  if (file.mimetype.startsWith('image/')) {
    return await processSingleImage(file, 'images');
  } else {
    // PDF – save as is (no compression)
    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}-${Date.now()}${ext}`;
    const savePath = path.join(__dirname, '../uploads/documents', filename);
    await fs.promises.writeFile(savePath, file.buffer);
    return {
      filename,
      path: `/uploads/documents/${filename}`,
      fullUrl: `${process.env.BASE_URL}/uploads/documents/${filename}`,
    };
  }
};

// ─── Middleware: single file upload ──────────────────────────────────
const uploadSingle = (fieldName) => {
  return async (req, res, next) => {
    try {
      const uploadMiddleware = upload.single(fieldName);

      uploadMiddleware(req, res, async (err) => {
        if (err) return next(err);
        if (!req.file) {
          return res.status(400).json({ error: 'No file uploaded' });
        }
        const fileData = await processSingleFile(req.file);
        req.uploadedFile = fileData;
        next();
      });
    } catch (error) {
      next(error);
    }
  };
};

// ─── Middleware: multiple files upload ───────────────────────────────
const uploadMultiple = (fieldName, maxCount = 5) => {
  return async (req, res, next) => {
    try {
      const uploadMiddleware = upload.array(fieldName, maxCount);
      uploadMiddleware(req, res, async (err) => {
        if (err) return next(err);
        if (!req.files || req.files.length === 0) {
          return res.status(400).json({ error: 'No files uploaded' });
        }
        const uploadedFiles = await Promise.all(
          req.files.map((file) => processSingleFile(file))
        );
        req.uploadedFiles = uploadedFiles;
        next();
      });
    } catch (error) {
      next(error);
    }
  };
};

module.exports = {
  uploadSingle,
  uploadMultiple,
};