// models/TaskCollaborator.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const TaskCollaborator = sequelize.define('TaskCollaborator', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  task_id: { type: DataTypes.UUID, allowNull: false },
  user_id: { type: DataTypes.UUID, allowNull: false }
}, { timestamps: true });

module.exports = TaskCollaborator;
