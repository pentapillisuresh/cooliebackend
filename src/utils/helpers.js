const crypto = require('crypto');
const { OTP_CONFIG, PAGINATION } = require('./constants');

/**
 * Generate a numeric OTP of specified length
 */
const generateOTP = (length = OTP_CONFIG.LENGTH) => {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return crypto.randomInt(min, max + 1).toString();
};

/**
 * Check if OTP is expired (based on expiry timestamp)
 */
const isOTPExpired = (expiryDate) => {
  return new Date() > new Date(expiryDate);
};

/**
 * Format response wrapper
 */
const formatResponse = (success, data = null, message = null) => {
  return {
    success,
    data,
    message,
  };
};

/**
 * Pagination helper
 */
const getPagination = (page = PAGINATION.DEFAULT_PAGE, limit = PAGINATION.DEFAULT_LIMIT) => {
  const offset = (page - 1) * limit;
  return {
    limit: Math.min(limit, PAGINATION.MAX_LIMIT),
    offset,
  };
};

/**
 * Get pagination metadata
 */
const getPagingData = (data, page = PAGINATION.DEFAULT_PAGE, limit = PAGINATION.DEFAULT_LIMIT) => {
  const { count: totalItems, rows: items } = data;
  const currentPage = page ? Number(page) : PAGINATION.DEFAULT_PAGE;
  const totalPages = Math.ceil(totalItems / limit);
  return {
    totalItems,
    items,
    totalPages,
    currentPage,
    itemsPerPage: limit,
  };
};

/**
 * Generate a random alphanumeric string (for group IDs, etc.)
 */
const generateRandomString = (length = 8) => {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
};

/**
 * Sanitize phone number (remove spaces, +91, etc.)
 */
const sanitizeMobile = (mobile) => {
  return mobile.replace(/[^0-9]/g, '').replace(/^91/, '');
};

/**
 * Validate email format
 */
const isValidEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

/**
 * Truncate text to given length
 */
const truncateText = (text, maxLength = 100) => {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
};

/**
 * Extract base URL from request (for dynamic fullUrl building)
 */
const getBaseUrl = (req) => {
  return `${req.protocol}://${req.get('host')}`;
};

module.exports = {
  generateOTP,
  isOTPExpired,
  formatResponse,
  getPagination,
  getPagingData,
  generateRandomString,
  sanitizeMobile,
  isValidEmail,
  truncateText,
  getBaseUrl,
};