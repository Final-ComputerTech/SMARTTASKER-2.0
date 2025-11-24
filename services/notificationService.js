// services/taskService.js
const Task = require('../models/Task');
const User = require('../models/User');
const Project = require('../models/Project');
const TaskCollaborator = require('../models/TaskCollaborator');
const Priority = require('../models/Priority');
const Status = require('../models/Status');
const { Op } = require('sequelize');

// send email using nodemailer (uses env vars)
async function sendEmail(to, subject, html) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html
  });

  return info;
}

module.exports = { createNotification, sendEmail };
