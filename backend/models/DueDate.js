// models/DueDate.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const DueDate = sequelize.define(
  'DueDate',
  {
    due_date_id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    task_id: { type: DataTypes.UUID, allowNull: false },
    due_date: { type: DataTypes.DATE, allowNull: false }
  },
  { timestamps: true, tableName: 'due_dates', underscored: true }
);

module.exports = DueDate;
