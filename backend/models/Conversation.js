const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./User');

const Conversation = sequelize.define(
  'Conversation',
  {
    conversation_id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    task_id: { type: DataTypes.UUID, allowNull: false },
    user_id: { type: DataTypes.UUID, allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false }
  },
  { timestamps: true, tableName: 'conversations', underscored: true }
);

// register association so `include: [User]` works in controllers
Conversation.belongsTo(User, { foreignKey: 'user_id', as: 'User' });

module.exports = Conversation;

