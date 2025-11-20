const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./User');
const Project = require('./Project');
const Priority = require('./Priority');
const Status = require('./Status');
const DueDate = require('./DueDate');
const Reminder = require('./Reminder');

const Task = sequelize.define('Task', {
  task_id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  attachment: { type: DataTypes.STRING }
}, { timestamps: true });

// Associations placeholders (Dev B sẽ hoàn thiện)
Task.belongsTo(User, { foreignKey: 'user_id' });
Task.belongsTo(Project, { foreignKey: 'project_id' });
Task.belongsTo(Priority, { foreignKey: 'priority_id' });
Task.belongsTo(Status, { foreignKey: 'status_id' });
Task.belongsTo(DueDate, { foreignKey: 'due_date_id' });
Task.belongsTo(Reminder, { foreignKey: 'reminder_id' });

module.exports = Task;
