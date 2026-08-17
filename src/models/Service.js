const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Service = sequelize.define('Service', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  categoryId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Categories',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  slug: {
    type: DataTypes.STRING(200),
    allowNull: false,
    // unique: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  basePrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
  duration: {
    type: DataTypes.INTEGER, // in minutes
    allowNull: true,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  image: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  // Additional fields specific to service type (e.g., requires technician, requires location)
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Flexible fields for service-specific data (e.g., train required, weight limits)',
  },
}, {
  timestamps: true,
  paranoid: true,
});

module.exports = Service;