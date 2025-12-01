const { Sequelize } = require('sequelize');
const path = require('path');
// Ensure we load the backend .env file even when the process is started from repository root
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'mysql',
    logging: false
  }
);

module.exports = sequelize;

