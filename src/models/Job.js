const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Job = sequelize.define('Job', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  bookingId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Bookings',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  workerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Workers',
      key: 'id',
    },
  },
  // Status specific to worker's progress
  status: {
    type: DataTypes.ENUM(
      'assigned',     // worker has accepted
      'arrived',      // worker reached location (for transport: train arrived)
      'in-progress',  // started work
      'completed',    // work finished
      'cancelled'
    ),
    defaultValue: 'assigned',
  },
  assignedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  // For confirmation OTP (mutual confirmation)
  confirmationOtp: {
    type: DataTypes.STRING(6),
    allowNull: true,
  },
  otpExpiry: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  // Worker's latitude/longitude during job (for tracking)
  workerLatitude: {
    type: DataTypes.DOUBLE,
    allowNull: true,
  },
  workerLongitude: {
    type: DataTypes.DOUBLE,
    allowNull: true,
  },
  // Before/after photos (stored as JSON array of URLs)
  beforePhotos: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  afterPhotos: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  // Additional notes
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // Rating given by user (after completion)
  rating: {
    type: DataTypes.FLOAT,
    allowNull: true,
    validate: { min: 0, max: 5 },
  },
  feedback: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  timestamps: true,
  paranoid: true,
});

module.exports = Job;