const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Worker = sequelize.define('Worker', {
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
  },
  profession: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  experience: {
    type: DataTypes.FLOAT, // years
  },
  description: {
    type: DataTypes.TEXT,
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  rating: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  totalJobs: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  schedule: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue:[],
    comment: 'Stores schedule information',
  },
  latitude: DataTypes.DOUBLE,
  longitude: DataTypes.DOUBLE,
  status: {
    type: DataTypes.ENUM('working', 'active', 'inactive'),
    defaultValue: 'inactive',
  },
});

module.exports = Worker;
