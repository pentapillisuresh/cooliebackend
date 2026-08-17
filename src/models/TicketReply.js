const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TicketReply = sequelize.define('TicketReply', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  ticketId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Tickets',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id',
    },
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  attachments: {
    type: DataTypes.JSON,
    allowNull: true, // array of file URLs
  },
  isInternal: {
    type: DataTypes.BOOLEAN,
    defaultValue: false, // if true, only admins can see
  },
}, {
  timestamps: true,
});

module.exports = TicketReply;