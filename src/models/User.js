const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  mobile: {
    type: DataTypes.STRING(15),
    allowNull: false,
    unique: false,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: true,
    unique: false,
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  role: {
    type: DataTypes.ENUM('user', 'worker', 'admin'),
    defaultValue: 'user',
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  otp: {
    type: DataTypes.STRING(6),
    allowNull: true,
  },
  otpExpiry: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  profileImage: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  fcmToken: {
    type: DataTypes.STRING(255),
    allowNull: true,
    unique: false,
  },
  deviceType: {
    type: DataTypes.ENUM('ios', 'android', 'web'),
    allowNull: true,
  },
  // Additional fields as needed
});

module.exports = User;