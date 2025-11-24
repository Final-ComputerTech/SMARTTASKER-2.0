const nodemailer = require('nodemailer');
const logger = require('./logger');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: (process.env.SMTP_SECURE === 'true'),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// sendMail(to, subject, htmlOrText)
async function sendMail(to, subject, text) {
  if (!process.env.SMTP_HOST) {
    logger.warn('SMTP not configured — skipping email send', { to, subject });
    return null;
  }
  const from = process.env.EMAIL_FROM || 'no-reply@smarttasker.local';
  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text
  });
  logger.info('Email sent', info);
  return info;
}

module.exports = { sendMail };

