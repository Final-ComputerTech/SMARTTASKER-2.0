// models/Priority.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Priority = sequelize.define(
  'Priority',
  {
    priority_id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    label: { type: DataTypes.STRING, allowNull: false },
    level: { type: DataTypes.INTEGER, allowNull: false } // 1=low, 3=high
  },
  {
    timestamps: false,
    tableName: 'priorities'
  }
);

module.exports = Priority;
