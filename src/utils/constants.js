/**
 * Application-wide constants
 */

// ─── User Roles ──────────────────────────────────────────────────────
const USER_ROLES = {
    USER: 'user',
    WORKER: 'worker',
    ADMIN: 'admin',
  };
  
  // ─── Booking Status ──────────────────────────────────────────────────
  const BOOKING_STATUS = {
    PENDING: 'pending',
    ACCEPTED: 'accepted',
    IN_PROGRESS: 'in-progress',
    COMPLETED: 'completed',
    PAYMENT_PENDING: 'payment-pending',
    CANCELLED: 'cancelled',
    POSTPONED: 'postponed',
  };
  
  // ─── Job Status ──────────────────────────────────────────────────────
  const JOB_STATUS = {
    ASSIGNED: 'assigned',
    ARRIVED: 'arrived',
    IN_PROGRESS: 'in-progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
  };
  
  // ─── Payment Status ─────────────────────────────────────────────────
  const PAYMENT_STATUS = {
    PENDING: 'pending',
    PAID: 'paid',
    FAILED: 'failed',
    REFUNDED: 'refunded',
  };
  
  // ─── Payment Methods ────────────────────────────────────────────────
  const PAYMENT_METHODS = {
    CASH: 'cash',
    CARD: 'card',
    UPI: 'upi',
    WALLET: 'wallet',
  };
  
  // ─── Document Types ─────────────────────────────────────────────────
  const DOCUMENT_TYPES = {
    LICENSE: 'license',
    CERTIFICATE: 'certificate',
    AADHAAR: 'aadhaar',
    PAN: 'pan',
    PHOTO: 'photo',
    OTHER: 'other',
  };
  
  // ─── File Upload Limits ──────────────────────────────────────────────
  const FILE_LIMITS = {
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10 MB
    ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    MAX_FILES_PER_UPLOAD: 5,
  };
  
  // ─── OTP Configuration ──────────────────────────────────────────────
  const OTP_CONFIG = {
    LENGTH: 6,
    EXPIRY_MINUTES: 10,
  };
  
  // ─── Pagination Defaults ─────────────────────────────────────────────
  const PAGINATION = {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100,
  };
  
  // ─── Category Slugs (if needed) ─────────────────────────────────────
  const CATEGORY_SLUGS = {
    WOMEN_SALON: 'women-salon-spa',
    MEN_SALON: 'men-salon-grooming',
    APPLIANCE_REPAIR: 'appliance-repair-service',
    CLEANING_PEST: 'cleaning-pest-control',
    HANDYMAN: 'home-repairs-handyman',
    RENOVATION: 'home-renovations-wall-makeovers',
    TRANSPORT: 'transport-hubs-railways-bus',
    WAREHOUSE: 'warehousing-logistics',
    CONSTRUCTION: 'construction-site-material',
    MOVING: 'domestic-moving-shifting',
    SEWAGE: 'sewage-drainage',
    GARDENING: 'garden-setup-maintenance',
    FARMING: 'farming-agriculture',
  };
  
  module.exports = {
    USER_ROLES,
    BOOKING_STATUS,
    JOB_STATUS,
    PAYMENT_STATUS,
    PAYMENT_METHODS,
    DOCUMENT_TYPES,
    FILE_LIMITS,
    OTP_CONFIG,
    PAGINATION,
    CATEGORY_SLUGS,
  };