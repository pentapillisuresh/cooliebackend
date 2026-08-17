const multer = require("multer");

const errorHandler = (err, req, res, next) => {
    console.error('❌ Error:', err.stack);
  
    // Sequelize validation errors
    if (err.name === 'SequelizeValidationError') {
      return res.status(400).json({ error: err.errors.map(e => e.message) });
    }
  
    // Multer errors
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: err.message });
    }
  
    // Default
    res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error',
    });
  };
  
  module.exports = errorHandler;