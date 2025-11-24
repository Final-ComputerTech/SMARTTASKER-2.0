const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Collaborator = sequelize.define(
  'Collaborator',
  {
    collaborator_id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    project_id: { type: DataTypes.UUID, allowNull: false },
    user_id: { type: DataTypes.UUID, allowNull: false }
  },
  { timestamps: true, tableName: 'collaborators', underscored: true }
);

module.exports = Collaborator;

