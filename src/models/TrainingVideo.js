const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TrainingVideo = sequelize.define('TrainingVideo', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  trainingId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Trainings',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  videoUrl: {
    type: DataTypes.STRING(500),
    allowNull: false, // Can be a YouTube embed, Vimeo, or hosted file
  },
  thumbnail: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  duration: {
    type: DataTypes.INTEGER, // in seconds
    allowNull: true,
  },
  sortOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  isFree: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  timestamps: true,
});

module.exports = TrainingVideo;