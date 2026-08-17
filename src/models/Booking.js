const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Booking = sequelize.define('Booking', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  serviceId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Services',
      key: 'id',
    },
  },
  // For transport/railway: train details, luggage weight, etc.
  // For general: address, time slot, manpower count, etc.
  details: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Stores service‑specific fields (train number, luggage count, room count, etc.)',
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  latitude: {
    type: DataTypes.DOUBLE,
    allowNull: true,
  },
  longitude: {
    type: DataTypes.DOUBLE,
    allowNull: true,
  },
  scheduledDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  scheduledTime: {
    type: DataTypes.TIME,
    allowNull: false,
  },
  estimatedArrival: {
    type: DataTypes.DATE,
    allowNull: true, // For live tracking (train arrival)
  },
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
  status: {
    type: DataTypes.ENUM(
      'pending',        // just created
      'accepted',       // worker assigned
      'in-progress',    // worker started
      'completed',      // work done
      'payment-pending',// completed but unpaid
      'cancelled',
      'postponed'
    ),
    defaultValue: 'pending',
  },
  paymentStatus: {
    type: DataTypes.ENUM('pending', 'paid', 'failed', 'refunded'),
    defaultValue: 'pending',
  },
  specialInstructions: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // Group booking (multiple workers)
  groupId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  timestamps: true,
  paranoid: true,
});

module.exports = Booking;