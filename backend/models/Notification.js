const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./User');
const Task = require('./Task');

const Notification = sequelize.define('Notification', {
  notification_id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  user_id: { type: DataTypes.UUID, allowNull: false },
  task_id: { type: DataTypes.UUID, allowNull: true },
  title: { type: DataTypes.STRING, allowNull: true },
  message: { type: DataTypes.TEXT, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  type: { type: DataTypes.STRING, allowNull: true },
  severity: { type: DataTypes.STRING, allowNull: true },
  is_read: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_read' },
  
}, { timestamps: true, tableName: 'notifications', underscored: true });

Notification.belongsTo(User, { foreignKey: 'user_id' });
Notification.belongsTo(Task, { foreignKey: 'task_id' });

module.exports = Notification;
