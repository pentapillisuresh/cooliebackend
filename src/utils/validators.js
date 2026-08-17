const { body, param, query, validationResult } = require('express-validator');
const { USER_ROLES, BOOKING_STATUS, PAYMENT_METHODS, DOCUMENT_TYPES } = require('./constants');

/**
 * Middleware to validate request and return errors
 */
const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }
    res.status(400).json({ error: errors.array().map(e => e.msg) });
  };
};

// ─── Auth validators ──────────────────────────────────────────────────
const registerValidator = [
  body('mobile')
    .isMobilePhone('any')
    .withMessage('Valid mobile number is required')
    .customSanitizer(value => value.replace(/[^0-9]/g, '')),
  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 100 })
    .withMessage('Name too long'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('role')
    .optional()
    .isIn(Object.values(USER_ROLES))
    .withMessage('Invalid role'),
];

const loginValidator = [
  body('mobile')
    .isMobilePhone('any')
    .withMessage('Valid mobile number is required')
    .customSanitizer(value => value.replace(/[^0-9]/g, '')),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

// ─── Booking validators ─────────────────────────────────────────────
const createBookingValidator = [
  body('serviceId')
    .isInt()
    .withMessage('Service ID must be a number'),
  body('address')
    .notEmpty()
    .withMessage('Address is required'),
  body('scheduledDate')
    .isDate()
    .withMessage('Valid scheduled date is required'),
  body('scheduledTime')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Valid time format HH:MM required'),
  body('totalAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Total amount must be a positive number'),
  body('details')
    .optional()
    .isObject()
    .withMessage('Details must be a JSON object'),
];

const updateBookingValidator = [
  param('id')
    .isInt()
    .withMessage('Invalid booking ID'),
  body('scheduledDate')
    .optional()
    .isDate()
    .withMessage('Invalid date'),
  body('scheduledTime')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Invalid time format'),
  body('status')
    .optional()
    .isIn(Object.values(BOOKING_STATUS))
    .withMessage('Invalid status'),
];

// ─── Job validators ──────────────────────────────────────────────────
const confirmOTPValidator = [
  param('id')
    .isInt()
    .withMessage('Invalid job ID'),
  body('otp')
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be 6 digits')
    .isNumeric()
    .withMessage('OTP must be numeric'),
];

const completeJobValidator = [
  param('id')
    .isInt()
    .withMessage('Invalid job ID'),
  body('notes')
    .optional()
    .isString()
    .withMessage('Notes must be text'),
];

// ─── Worker validators ───────────────────────────────────────────────
const registerWorkerValidator = [
  body('profession')
    .notEmpty()
    .withMessage('Profession is required')
    .isLength({ max: 100 }),
  body('experience')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Experience must be a number'),
  body('description')
    .optional()
    .isString()
    .withMessage('Description must be text'),
  body('latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Invalid latitude'),
  body('longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Invalid longitude'),
];

// ─── Category validators ─────────────────────────────────────────────
const createCategoryValidator = [
  body('name')
    .notEmpty()
    .withMessage('Category name is required'),
  body('slug')
    .notEmpty()
    .withMessage('Slug is required')
    .isSlug()
    .withMessage('Slug must be valid (lowercase, hyphens)'),
  body('description')
    .optional()
    .isString(),
];

// ─── Common validators ───────────────────────────────────────────────
const idParamValidator = [
  param('id')
    .isInt()
    .withMessage('Invalid ID parameter'),
];

const paginationValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
];

module.exports = {
  validate,
  registerValidator,
  loginValidator,
  createBookingValidator,
  updateBookingValidator,
  confirmOTPValidator,
  completeJobValidator,
  registerWorkerValidator,
  createCategoryValidator,
  idParamValidator,
  paginationValidator,
};