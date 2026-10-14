const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Cart = sequelize.define('Cart', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
    onDelete: 'CASCADE',
  },
  status: {
    type: DataTypes.ENUM('active', 'converted', 'abandoned'),
    defaultValue: 'active',
  },
  // Optional: which address this cart is destined for
  addressId: { type: DataTypes.INTEGER, allowNull: true },
  // Schedule preference, if the user picked one
  scheduledDate: { type: DataTypes.DATEONLY, allowNull: true },
  scheduledTime: { type: DataTypes.TIME, allowNull: true },
  bookingType: {
    type: DataTypes.ENUM('now', 'schedule'),
    defaultValue: 'now',
  },
  // Optional promo applied at cart level
  promotionId: { type: DataTypes.INTEGER, allowNull: true },
  // Cached totals — recomputed on every mutation, safe to read directly
  subtotal: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  discountAmount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  gstAmount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  convenienceCharges: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  totalAmount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  currency: { type: DataTypes.STRING(3), defaultValue: 'INR' },
  notes: { type: DataTypes.TEXT, allowNull: true },
  expiresAt: { type: DataTypes.DATE, allowNull: true },
}, {
  timestamps: true,
  indexes: [
    { fields: ['userId', 'status'] },
    { fields: ['status'] },
  ],
});

module.exports = Cart;