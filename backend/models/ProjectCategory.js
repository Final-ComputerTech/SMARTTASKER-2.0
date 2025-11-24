// models/ProjectCategory.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ProjectCategory = sequelize.define(
  'ProjectCategory',
  {
    category_id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    name: { type: DataTypes.STRING, allowNull: false }
  },
  {
    timestamps: true,
    tableName: 'project_categories',
    underscored: true
  }
);

module.exports = ProjectCategory;
