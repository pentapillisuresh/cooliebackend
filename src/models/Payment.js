const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Payment = sequelize.define('Payment', {
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
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'INR',
  },
  paymentMethod: {
    type: DataTypes.ENUM('cash', 'card', 'upi', 'wallet', 'razorpay'),
    allowNull: false,
    defaultValue: 'razorpay',
  },
  status: {
    type: DataTypes.ENUM('pending', 'success', 'failed', 'refunded'),
    defaultValue: 'pending',
  },
  transactionId: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  paidAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  // Razorpay specific fields
  razorpayOrderId: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  razorpayPaymentId: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  razorpaySignature: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  // Webhook tracking
  webhookStatus: {
    type: DataTypes.ENUM('pending', 'processed', 'failed'),
    defaultValue: 'pending',
  },
  // Store full gateway response (JSON)
  gatewayResponse: {
    type: DataTypes.JSON,
    allowNull: true,
  },
}, {
  timestamps: true,
});

module.exports = Payment;