const multer = require('multer');
const { FILE_LIMITS } = require('../utils/constants');

// File filter
const fileFilter = (req, file, cb) => {
  if (FILE_LIMITS.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Invalid file type. Only JPEG, PNG, WEBP and PDF are allowed.'
      ),
      false
    );
  }
};

// Store uploaded file in memory
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: FILE_LIMITS.MAX_FILE_SIZE,
  },
});

const uploadSingle = (fieldName) => upload.single(fieldName);

const uploadMultiple = (fieldName, maxCount = 5) =>
  upload.array(fieldName, maxCount);

module.exports = {
  upload,
  uploadSingle,
  uploadMultiple,
};
