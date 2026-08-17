const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BankDetail = sequelize.define('BankDetail', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  workerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Workers',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  accountHolderName: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  accountNumber: {
    type: DataTypes.STRING(30),
    allowNull: false,
  },
  ifscCode: {
    type: DataTypes.STRING(11),
    allowNull: false,
  },
  bankName: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  branchName: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  upiId: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  timestamps: true,
});

module.exports = BankDetail;