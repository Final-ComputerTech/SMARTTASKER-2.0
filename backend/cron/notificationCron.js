// cron/notificationCron.js
const cron = require('node-cron');
const Task = require('../models/Task');
const User = require('../models/User');
const Reminder = require('../models/Reminder');
const Notification = require('../models/Notification');
const DueDate = require('../models/DueDate');
const notificationService = require('../services/notificationService');
const { Op, QueryTypes } = require('sequelize');
const sequelize = require('../config/db');

// Cron job: check reminders and task due-dates for upcoming/due/overdue notifications
cron.schedule('*/1 * * * *', async () => {
  try {
    const now = new Date();
    const upcoming = new Date(now.getTime() + 2 * 60000); // next 2 minutes for explicit reminders

    // Handle explicit reminders (existing behavior)
    const reminders = await Reminder.findAll({ where: { reminder_at: { [Op.between]: [now, upcoming] } } });
    let processed = 0;
    for (const rem of reminders) {
      try {
        const task = await Task.findByPk(rem.task_id, { include: [{ model: User }] });
        if (!task) continue;
        const userId = task.user_id || (task.User && task.User.user_id);
        const title = `Reminder: ${task.title || 'Task'}`;
        try {
          await Notification.create({ user_id: userId, task_id: task.task_id, title, message: title, type: 'reminder', severity: 'info' });
        } catch (createErr) {
          console.error('Failed to create DB notification', createErr.message || createErr);
        }
        await notificationService.sendTaskReminder(task);
        processed++;
      } catch (innerErr) {
        console.error('Error processing reminder', rem.reminder_id, innerErr.message || innerErr);
      }
    }

    // Now scan tasks for due-related notifications
    // thresholds (ms)
    const NEARING_MS = (process.env.NOTIF_NEARING_HOURS ? parseInt(process.env.NOTIF_NEARING_HOURS,10) : 24) * 3600000; // default 24h
    const DUE_SOON_MS = (process.env.NOTIF_DUE_SOON_MIN ? parseInt(process.env.NOTIF_DUE_SOON_MIN,10) : 5) * 60000; // default 5 minutes

    const soonLimit = new Date(now.getTime() + NEARING_MS);
    const dueSoonLimit = new Date(now.getTime() + DUE_SOON_MS);

    const tasks = await Task.findAll({ include: [{ model: DueDate }, { model: User }, { model: Reminder }] });
    for (const task of tasks) {
      try {
        const due = task.DueDate && task.DueDate.due_date ? new Date(task.DueDate.due_date) : null;
        if (!due) continue;
        const userId = task.user_id || (task.User && task.User.user_id);

        // Skip tasks without an owner/user
        if (!userId) continue;

        // Overdue
        if (due.getTime() < now.getTime()) {
          // avoid spamming: only create if not created in last 24h
          const cutoff = new Date(now.getTime() - 24 * 3600000);
          const existsRows = await sequelize.query(
            `SELECT 1 FROM notifications WHERE task_id = :taskId AND type = 'overdue' AND user_id = :userId AND created_at > :cutoff LIMIT 1`,
            { type: QueryTypes.SELECT, replacements: { taskId: task.task_id, userId, cutoff } }
          );
          if (!existsRows || existsRows.length === 0) {
            const title = `Overdue: ${task.title || 'Task'}`;
            await Notification.create({ user_id: userId, task_id: task.task_id, title, message: title, type: 'overdue', severity: 'urgent' });
            // Send an email for overdue tasks (dev: skips if SMTP not configured)
            try {
              const to = task?.User?.email || process.env.NOTIFY_EMAIL || process.env.EMAIL_FROM;
              const subject = title;
              const html = `<p>Your task <strong>${(task && task.title) || ''}</strong> is overdue.</p><p>Please review it in SMARTTASKER.</p>`;
              await notificationService.sendEmail(to, subject, html);
              console.log(`Sent overdue email to ${to} for task ${task.task_id}`);
            } catch (emailErr) {
              console.warn('Failed to send overdue email', emailErr && (emailErr.message || emailErr));
            }
          }
          continue;
        }

        // Due now (within DUE_SOON_MS)
        if (due.getTime() <= dueSoonLimit.getTime()) {
          const cutoff = new Date(now.getTime() - 60 * 60000); // don't repeat if created in last 60min
          const existsRows = await sequelize.query(
            `SELECT 1 FROM notifications WHERE task_id = :taskId AND type = 'due' AND user_id = :userId AND created_at > :cutoff LIMIT 1`,
            { type: QueryTypes.SELECT, replacements: { taskId: task.task_id, userId, cutoff } }
          );
          if (!existsRows || existsRows.length === 0) {
            const title = `Due now: ${task.title || 'Task'}`;
            await Notification.create({ user_id: userId, task_id: task.task_id, title, message: title, type: 'due', severity: 'critical' });
          }
          continue;
        }

        // Nearing due (within NEARING_MS)
        if (due.getTime() <= soonLimit.getTime()) {
          const cutoff = new Date(now.getTime() - 24 * 3600000);
          const existsRows = await sequelize.query(
            `SELECT 1 FROM notifications WHERE task_id = :taskId AND type = 'nearing_due' AND user_id = :userId AND created_at > :cutoff LIMIT 1`,
            { type: QueryTypes.SELECT, replacements: { taskId: task.task_id, userId, cutoff } }
          );
          if (!existsRows || existsRows.length === 0) {
            const title = `Nearing due: ${task.title || 'Task'}`;
            await Notification.create({ user_id: userId, task_id: task.task_id, title, message: title, type: 'nearing_due', severity: 'warning' });
          }
        }
      } catch (e) {
        console.error('Error processing task due notifications', task.task_id, e.message || e);
      }
    }

    console.log(`${processed} reminders processed at ${now} (reminders found: ${reminders.length})`);
  } catch (error) {
    console.error('Error in notification cron:', error);
  }
});