const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Auth = sequelize.define('Auth', {
  auth_id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  user_id: { type: DataTypes.UUID, allowNull: false },
  password_hash: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.STRING, allowNull: false, defaultValue: 'member' }
}, { timestamps: true, underscored: true });

module.exports = Auth;
