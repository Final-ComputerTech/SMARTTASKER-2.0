// cron/notificationCron.js
const cron = require('node-cron');
const Task = require('../models/Task');
const User = require('../models/User');
const Reminder = require('../models/Reminder'); // nếu bạn có model Reminder
const notificationService = require('../services/notificationService');
const { Op } = require('sequelize');

// Cron job: check reminders table for reminders in the next 2 minutes
cron.schedule('*/1 * * * *', async () => {
  try {
    const now = new Date();
    const upcoming = new Date(now.getTime() + 2 * 60000); // next 2 minutes

    // Find reminders directly from Reminder model to avoid querying non-existent Task.due_date
    const reminders = await Reminder.findAll({
      where: {
        reminder_at: { [Op.between]: [now, upcoming] }
      }
    });

    let processed = 0;
    for (const rem of reminders) {
      try {
        const task = await Task.findByPk(rem.task_id, { include: [User] });
        if (!task) continue;
        await notificationService.sendTaskReminder(task);
        processed++;
      } catch (innerErr) {
        console.error('Error processing reminder', rem.reminder_id, innerErr.message || innerErr);
      }
    }

    console.log(`${processed} notifications processed at ${now} (reminders found: ${reminders.length})`);
  } catch (error) {
    console.error('Error in notification cron:', error);
  }
});