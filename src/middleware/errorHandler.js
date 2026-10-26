const multer = require("multer");

const errorHandler = (err, req, res, next) => {
console.error('🔥 RAW ERROR:', {
    name: err.name,
    message: err.message,
    sql: err.sql,
    original: err.original?.sqlMessage,   // ← the real MySQL message
    code: err.original?.code,
    errno: err.original?.errno,
    fields: err.fields,
    stack:err.stack,
  });
  
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