const sequelize = require('../config/db');
const User = require('../models/User');
const Task = require('../models/Task');
const DueDate = require('../models/DueDate');

async function run() {
  try {
    await sequelize.authenticate();
  } catch (e) {
    console.error('DB connect failed:', e && e.message ? e.message : e);
    process.exit(1);
  }

  const email = process.argv[2] || 'admin@smarttasker.com';
  let user = await User.findOne({ where: { email } });
  if (!user) {
    user = await User.findOne();
    if (!user) {
      console.error('No users found in DB. Create a user or run seed first.');
      process.exit(1);
    }
    console.log('Using first user in DB:', user.email);
  }

  // create a sample task due 3 days from now
  const due = new Date(Date.now() + (3 * 24 * 60 * 60 * 1000));
  // Create the task first, then the DueDate which requires task_id non-null, then link due_date_id on the Task
  const task = await Task.create({ title: process.argv[3] || 'Sample upcoming task', description: 'Auto-created upcoming task for dashboard' });
  await task.update({ user_id: user.user_id });

  const dueRow = await DueDate.create({ task_id: task.task_id, due_date: due });
  await task.update({ due_date_id: dueRow.due_date_id });

  console.log('Created task', task.task_id, 'due at', due.toISOString(), 'for user', user.email);
  process.exit(0);
}

run().catch(e => { console.error('create_sample_upcoming failed:', e && e.stack ? e.stack : e); process.exit(1); });
