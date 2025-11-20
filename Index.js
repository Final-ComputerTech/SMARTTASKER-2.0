const sequelize = require('../config/db');

const User = require('./User');
const Auth = require('./Auth');  // đúng đường dẫn và export class
const Project = require('./Project');
const ProjectCategory = require('./ProjectCategory');
const Task = require('./Task');
const Priority = require('./Priority');
const Status = require('./Status');
const Reminder = require('./Reminder');
const Collaborator = require('./Collaborator');
const TaskCollaborator = require('./TaskCollaborator');
const Notification = require('./Notification');
const Conversation = require('./Conversation');

// Associations
Auth.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasOne(Auth, { foreignKey: 'user_id', as: 'auth' });


// Project relations
Project.belongsTo(ProjectCategory, { foreignKey: 'category_id', as: 'category' });
Project.belongsTo(User, { foreignKey: 'owner_id', as: 'owner' });
Project.hasMany(Task, { foreignKey: 'project_id', as: 'tasks' });

// Task relations
Task.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
Task.belongsTo(User, { foreignKey: 'user_id', as: 'creator' });
Task.belongsTo(Priority, { foreignKey: 'priority_id', as: 'priority' });
Task.belongsTo(Status, { foreignKey: 'status_id', as: 'status' });

// Task <-> User Many-to-Many (Collaborators)
Task.belongsToMany(User, {
  through: TaskCollaborator,
  as: 'collaborators',
  foreignKey: 'task_id',
  otherKey: 'user_id'
});
User.belongsToMany(Task, {
  through: TaskCollaborator,
  as: 'assigned_tasks',
  foreignKey: 'user_id',
  otherKey: 'task_id'
});

// Notifications
Notification.belongsTo(User, { foreignKey: 'user_id', as: 'recipient' });
Notification.belongsTo(Task, { foreignKey: 'task_id', as: 'task' });

// Conversation
Conversation.belongsTo(Task, { foreignKey: 'task_id', as: 'task' });
Conversation.belongsTo(User, { foreignKey: 'user_id', as: 'author' });

// ================== Export ==================
module.exports = {
  sequelize,
  User,
  Auth,
  Project,
  ProjectCategory,
  Task,
  Priority,
  Status,
  Reminder,
  Collaborator,
  TaskCollaborator,
  Notification,
  Conversation
};

