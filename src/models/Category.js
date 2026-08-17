const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Category = sequelize.define('Category', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    // unique: true,
  },
  slug: {
    type: DataTypes.STRING(100),
    allowNull: false,
    // unique: true,
  },
  icon: {
    type: DataTypes.STRING(255),
    allowNull: true, // URL or icon class
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  sortOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  image: {
    type: DataTypes.STRING(255),
    allowNull: true, // Banner image
  },
}, {
  timestamps: true,
  paranoid: true, // soft delete
});

module.exports = Category;