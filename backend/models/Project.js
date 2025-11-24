// models/Project.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Project = sequelize.define('Project', {
  project_id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  project_name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  category_id: { type: DataTypes.UUID, allowNull: true },
  owner_id: { type: DataTypes.UUID, allowNull: true }
}, { timestamps: true });

// Model-level helper: get count of tasks (we'll implement in service using association).
module.exports = Project;
