const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CartItem = sequelize.define('CartItem', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  cartId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Carts', key: 'id' },
    onDelete: 'CASCADE',
  },
  serviceId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Services', key: 'id' },
  },
  // Dynamic form values — same shape Booking.details uses
  details: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {},
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    validate: { min: 1 },
  },
  // Price snapshot (locked at add-to-cart time)
  unitPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  lineTotal: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  // Optional per-item scheduled datetime (overrides cart-level)
  scheduledDate: { type: DataTypes.DATEONLY, allowNull: true },
  scheduledTime: { type: DataTypes.TIME, allowNull: true },
  specialInstructions: { type: DataTypes.TEXT, allowNull: true },
}, {
  timestamps: true,
  indexes: [
    { fields: ['cartId'] },
    { fields: ['serviceId'] },
  ],
});

module.exports = CartItem;