const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Coupon = sequelize.define('Coupon', {
  code: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  discountPercentage: {
    type: DataTypes.FLOAT,
    allowNull: false,
    validate: { min: 0, max: 100 },
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  eligibleUsers: {
    type: DataTypes.JSON,
    allowNull: false,
    comment: 'Array of user IDs, or ["All"] for all users',
    defaultValue: ['All'],
  },
  couponUsedUsers: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: 'Array of { phoneNumber, Name } objects',
  },
  usedCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  maxUses: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Maximum number of times coupon can be used',
  },
},
  {
    timestamps: true,
    paranoid: true,
  });

module.exports = Coupon;