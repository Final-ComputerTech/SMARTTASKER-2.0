#!/usr/bin/env node
require('dotenv').config();
const notificationService = require('../services/notificationService');

const emailArg = process.argv[2];
const to = emailArg || process.env.NOTIFY_EMAIL || process.env.EMAIL_FROM;
if (!to) {
  console.error('\nUsage: node backend/scripts/send_test_email.js you@example.com\nOr set NOTIFY_EMAIL or EMAIL_FROM in .env\n');
  process.exit(1);
}

(async () => {
  try {
    console.log('Sending test email to', to);
    const subject = 'SMARTTASKER test email';
    const html = `<p>This is a <strong>test email</strong> sent from SMARTTASKER at ${new Date().toISOString()}.</p>`;
    const res = await notificationService.sendEmail(to, subject, html);
    console.log('sendEmail returned:', res);
    process.exit(0);
  } catch (err) {
    console.error('Failed to send test email:', err && (err.message || err));
    process.exit(2);
  }
})();
