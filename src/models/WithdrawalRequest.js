const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WithdrawalRequest = sequelize.define('WithdrawalRequest', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  workerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Workers', key: 'id' },
    onDelete: 'CASCADE',
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
    onDelete: 'CASCADE',
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: { min: 100 },
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'INR',
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'completed'),
    defaultValue: 'pending',
  },
  // Payout destination — snapshot the details so later bank changes don't
  // rewrite history.
  bankAccountName:   { type: DataTypes.STRING, allowNull: true },
  bankAccountNumber: { type: DataTypes.STRING, allowNull: true },
  bankIfsc:          { type: DataTypes.STRING, allowNull: true },
  upiId:             { type: DataTypes.STRING, allowNull: true },

  // Processing
  processedAt:     { type: DataTypes.DATE, allowNull: true },
  processedBy:     { type: DataTypes.INTEGER, allowNull: true }, // admin userId
  transactionRef:  { type: DataTypes.STRING(100), allowNull: true },
  rejectionReason: { type: DataTypes.TEXT, allowNull: true },
  notes:           { type: DataTypes.TEXT, allowNull: true },
}, {
  timestamps: true,
  indexes: [
    { fields: ['workerId', 'status'] },
    { fields: ['status'] },
  ],
});

module.exports = WithdrawalRequest;