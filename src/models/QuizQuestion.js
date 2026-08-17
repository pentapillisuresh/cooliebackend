const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const QuizQuestion = sequelize.define('QuizQuestion', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
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
  question: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  options: {
    type: DataTypes.JSON,
    allowNull: false,
    comment: 'Array of options (e.g., ["A", "B", "C", "D"])',
  },
  correctOptionIndex: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 0 },
  },
  explanation: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  sortOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
}, {
  timestamps: true,
});

module.exports = QuizQuestion;