const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const bcrypt = require('bcrypt');

const Auth = sequelize.define('Auth', {
  auth_id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  user_id: { type: DataTypes.UUID, allowNull: false },
  password_hash: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: "Password cannot be empty" },
      len: { args: [6, 100], msg: "Password must be at least 6 characters" }
    }
  },
  role: {
    type: DataTypes.STRING,
    defaultValue: "member",
    validate: { isIn: { args: [["admin","manager","member"]], msg: "Invalid role" } }
  },
  last_login: DataTypes.DATE
}, {
  // Password hashing is handled in the auth controller to avoid double-hashing.
});

// Helper method: so sánh mật khẩu login
Auth.prototype.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password_hash);
};

module.exports = Auth;
