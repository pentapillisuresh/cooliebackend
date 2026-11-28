const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Referral = sequelize.define('Referral', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  referrerId: { type: DataTypes.INTEGER, allowNull: false }, // User A (sharer)
  referredId: { type: DataTypes.INTEGER, allowNull: false, unique: true }, // User B (new user)
  status: { type: DataTypes.ENUM('pending', 'completed', 'cancelled'), defaultValue: 'pending' },
  rewardAmount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 100.00 },
});

module.exports = Referral;