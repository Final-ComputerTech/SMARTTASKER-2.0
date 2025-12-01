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
  ,
  avatar: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: { len: { args: [0, 255], msg: 'Avatar path too long' } }
  }
  ,
  bio: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  gender: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: { len: { args: [0, 20], msg: 'Gender too long' } }
  },
  dob: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: { len: { args: [0, 30], msg: 'Phone too long' } }
  },
  address: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: { len: { args: [0, 255], msg: 'Address too long' } }
  },
  timezone: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: { len: { args: [0, 50], msg: 'Timezone too long' } }
  },
  language: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: { len: { args: [0, 50], msg: 'Language too long' } }
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
  const { user_id, name, email, avatar, bio, gender, dob, phone, address, timezone, language, createdAt, updatedAt } = this;
  return { user_id, name, email, avatar, bio, gender, dob, phone, address, timezone, language, createdAt, updatedAt };
};

module.exports = User;
