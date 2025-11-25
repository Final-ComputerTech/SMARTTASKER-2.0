// Minimal notification service used by cron jobs
const nodemailer = require('nodemailer');

// send email using nodemailer (uses env vars)
async function sendEmail(to, subject, html) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    // SMTP not configured; log and skip sending
    console.log('SMTP not configured — skipping sendEmail for', to);
    return null;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
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

// send a simple task reminder (safe if no SMTP configured)
async function sendTaskReminder(task) {
  const to = task?.creator?.email || process.env.NOTIFY_EMAIL || process.env.EMAIL_FROM;
  const subject = `Task Reminder: ${task?.title || 'Task'}`;
  const html = `<p>Reminder for task: <strong>${task?.title || ''}</strong></p>`;
  try {
    const res = await sendEmail(to, subject, html);
    console.log(`sendTaskReminder: attempted sending to ${to}`, !!res);
    return res;
  } catch (err) {
    console.error('sendTaskReminder error', err.message || err);
    return null;
  }
}

module.exports = { sendTaskReminder, sendEmail };