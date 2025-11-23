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
  hooks: {
    beforeCreate: async (auth) => {
      auth.password_hash = await bcrypt.hash(auth.password_hash, 10);
    },
    beforeUpdate: async (auth) => {
      if (auth.changed("password_hash")) {
        auth.password_hash = await bcrypt.hash(auth.password_hash, 10);
      }
    }
  }
});

// Helper method: so sánh mật khẩu login
Auth.prototype.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password_hash);
};

module.exports = Auth;
