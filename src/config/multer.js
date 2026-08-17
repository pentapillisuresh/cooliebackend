const multer = require('multer');
const path = require('path');
const { FILE_LIMITS } = require('../utils/constants');

// File filter: allow images and PDFs
const fileFilter = (req, file, cb) => {
  if (FILE_LIMITS.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, WEBP and PDF are allowed.'), false);
  }
};

// Memory storage – we'll process with Sharp later
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: FILE_LIMITS.MAX_FILE_SIZE },
});

module.exports = upload;