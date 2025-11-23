const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const User = sequelize.define('User', {
  user_id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: "Name cannot be empty" },
      len: { args: [2, 50], msg: "Name must be 2-50 characters" }
    }
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: { msg: "Email already exists" },
    validate: { isEmail: { msg: "Invalid email format" } }
  }
}, {
  timestamps: true,
  hooks: {
    beforeValidate: (user) => {
      if (user.email) user.email = user.email.toLowerCase().trim();
    },
    afterCreate: (user) => {
      console.log("User created:", user.email);
    }
  }
});

// Helper method: trả về JSON công khai
User.prototype.toPublicJSON = function () {
  const { user_id, name, email, createdAt, updatedAt } = this;
  return { user_id, name, email, createdAt, updatedAt };
};

module.exports = User;
