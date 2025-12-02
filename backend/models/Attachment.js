const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Attachment = sequelize.define(
  'Attachment',
  {
    attachment_id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    task_id: { type: DataTypes.UUID, allowNull: false },
    filename: { type: DataTypes.STRING, allowNull: false },
    filepath: { type: DataTypes.STRING, allowNull: false },
    mime: { type: DataTypes.STRING, allowNull: true },
    size: { type: DataTypes.INTEGER, allowNull: true },
    uploaded_by: { type: DataTypes.UUID, allowNull: true }
  },
  { timestamps: true, tableName: 'attachments', underscored: true }
);

module.exports = Attachment;
