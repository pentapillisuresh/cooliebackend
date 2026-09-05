const multer = require('multer');
const { fileTypeFromBuffer } = require('file-type');

const {
  processSingleFile,
  processMultipleFiles,
} = require('../services/processUpload');

// ─────────────────────────────────────────────
// Allowed actual file types
// ─────────────────────────────────────────────

const ALLOWED_FILE_TYPES = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'application/pdf': ['pdf'],
};

// ─────────────────────────────────────────────
// Multer configuration
// ─────────────────────────────────────────────

const storage = multer.memoryStorage();

const upload = multer({
  storage,

  // Don't reject based on client MIME type.
  // We validate the actual file content after Multer
  // has loaded it into memory.
  fileFilter: (req, file, cb) => {
    cb(null, true);
  },

  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
});

// ─────────────────────────────────────────────
// Validate actual file content
// ─────────────────────────────────────────────

const validateFile = async (file) => {
  if (!file || !file.buffer) {
    throw new Error('Invalid file');
  }

  const detectedType = await fileTypeFromBuffer(file.buffer);

  if (!detectedType) {
    throw new Error('Unable to determine file type');
  }

  console.log('File type detection:', {
    originalName: file.originalname,
    clientMimeType: file.mimetype,
    detectedMimeType: detectedType.mime,
    detectedExtension: detectedType.ext,
  });

  if (!ALLOWED_FILE_TYPES[detectedType.mime]) {
    throw new Error(
      `Invalid file type: ${detectedType.mime}. ` +
      'Only JPEG, PNG, WEBP and PDF are allowed.'
    );
  }

  // Replace the unreliable client MIME type
  // with the detected MIME type.
  file.mimetype = detectedType.mime;

  return file;
};

// ─────────────────────────────────────────────
// Single file upload
// ─────────────────────────────────────────────

const uploadSingle = (fieldName) => {
  return (req, res, next) => {
    upload.single(fieldName)(req, res, async (err) => {
      try {
        if (err) {
          return next(err);
        }

        if (!req.file) {
          return res.status(400).json({
            success: false,
            error: 'No file uploaded',
          });
        }

        // Validate actual file contents
        await validateFile(req.file);

        console.log('File accepted:', {
          name: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
        });

        // Process + upload to Google Cloud Storage
        const fileData = await processSingleFile(req.file);

        req.uploadedFile = fileData;

        next();
      } catch (error) {
        next(error);
      }
    });
  };
};

// ─────────────────────────────────────────────
// Multiple file upload
// ─────────────────────────────────────────────

const uploadMultiple = (fieldName, maxCount = 5) => {
  return (req, res, next) => {
    upload.array(fieldName, maxCount)(req, res, async (err) => {
      try {
        if (err) {
          return next(err);
        }

        if (!req.files || req.files.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'No files uploaded',
          });
        }

        // Validate every file
        for (const file of req.files) {
          await validateFile(file);
        }

        // Process + upload all files
        const uploadedFiles = await processMultipleFiles(req.files);

        req.uploadedFiles = uploadedFiles;

        next();
      } catch (error) {
        next(error);
      }
    });
  };
};

module.exports = {
  uploadSingle,
  uploadMultiple,
};
