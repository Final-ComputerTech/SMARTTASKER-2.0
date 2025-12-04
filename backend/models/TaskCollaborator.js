const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const TaskCollaborator = sequelize.define('TaskCollaborator', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  task_id: { type: DataTypes.UUID, allowNull: false },
  user_id: { type: DataTypes.UUID, allowNull: false }
}, { timestamps: true });

// Set up associations if Task model is available. Wrap in try/catch to avoid circular-require issues.
try {
  const Task = require('./Task');
  Task.hasMany(TaskCollaborator, { foreignKey: 'task_id', as: 'TaskCollaborators' });
  TaskCollaborator.belongsTo(Task, { foreignKey: 'task_id', as: 'Task' });
} catch (e) {
  // It's safe to continue if Task isn't available yet; associations can be set elsewhere.
}

module.exports = TaskCollaborator;

