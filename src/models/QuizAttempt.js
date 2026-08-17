const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const QuizAttempt = sequelize.define('QuizAttempt', {
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
  quizId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Quizzes',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  score: {
    type: DataTypes.INTEGER,
    allowNull: true, // percentage
  },
  passed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  answers: {
    type: DataTypes.JSON,
    allowNull: true, // store selected answers
  },
  startedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  timestamps: true,
});

module.exports = QuizAttempt;