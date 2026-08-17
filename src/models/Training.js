const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Training = sequelize.define('Training', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  title: {
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
  thumbnail: {
    type: DataTypes.STRING(255),
    allowNull: true, // Image URL
  },
  // Which worker professions this training applies to (JSON array)
  applicableProfessions: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Array of profession names (e.g., ["Plumber", "Electrician"])',
  },
  // Difficulty level
  level: {
    type: DataTypes.ENUM('beginner', 'intermediate', 'advanced'),
    defaultValue: 'beginner',
  },
  duration: {
    type: DataTypes.INTEGER, // in minutes
    allowNull: true,
  },
  isRequired: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  // Scheduled training session (live)
  scheduledDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  meetingLink: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
}, {
  timestamps: true,
  paranoid: true,
});

module.exports = Training;