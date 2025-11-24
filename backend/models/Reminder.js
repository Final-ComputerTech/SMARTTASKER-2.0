const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Reminder = sequelize.define(
  'Reminder',
  {
    reminder_id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    task_id: { type: DataTypes.UUID, allowNull: false },
    reminder_at: { type: DataTypes.DATE, allowNull: false }
  },
  { timestamps: true, tableName: 'reminders', underscored: true }
);

module.exports = Reminder;

