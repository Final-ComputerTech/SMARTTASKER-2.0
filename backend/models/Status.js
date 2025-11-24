// models/Status.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Status = sequelize.define(
  'Status',
  {
    status_id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    label: { type: DataTypes.STRING, allowNull: false }
  },
  {
    timestamps: false,
    tableName: 'statuses'
  }
);

module.exports = Status;
