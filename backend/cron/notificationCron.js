// cron/notificationCron.js
const cron = require('node-cron');
const Task = require('../models/Task');
const User = require('../models/User');
const Reminder = require('../models/Reminder'); // nếu bạn có model Reminder
const notificationService = require('../services/notificationService');
const { Op } = require('sequelize');

// Ví dụ cron job chạy mỗi phút kiểm tra task sắp đến hạn hoặc quá hạn
cron.schedule('*/1 * * * *', async () => {
  try {
    const now = new Date();
    const upcoming = new Date(now.getTime() + 2 * 60000); // 2 phút tới

    const tasks = await Task.findAll({
      where: {
        [Op.or]: [
          { due_date: { [Op.between]: [now, upcoming] } },
          { reminder_at: { [Op.between]: [now, upcoming] } },
        ],
      },
      include: [{ model: User }],
    });

    for (const task of tasks) {
      await notificationService.sendTaskReminder(task);
    }

    console.log(`${tasks.length} notifications processed at ${now}`);
  } catch (error) {
    console.error('Error in notification cron:', error);
  }
});