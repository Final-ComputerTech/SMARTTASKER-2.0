// models/Changes.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Changes = sequelize.define(
  'Changes',
  {
    change_id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    task_id: { type: DataTypes.UUID, allowNull: false },
    user_id: { type: DataTypes.UUID, allowNull: false },
    field: { type: DataTypes.STRING, allowNull: false },
    old_value: { type: DataTypes.STRING },
    new_value: { type: DataTypes.STRING }
  },
  { timestamps: true, tableName: 'changes', underscored: true }
);

module.exports = Changes;
