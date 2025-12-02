#!/usr/bin/env node
// Faker-based bulk seeder for projects, tasks, due_dates, reminders
// Usage: from backend/: node seeders/seedFaker.js [numProjects] [tasksPerProject]

const { faker } = require('@faker-js/faker');
const sequelize = require('../config/db');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Priority = require('../models/Priority');
const Status = require('../models/Status');
const DueDate = require('../models/DueDate');
const Reminder = require('../models/Reminder');
const User = require('../models/User');
const Attachment = require('../models/Attachment');

async function ensureCoreData() {
  // Ensure priorities
  const existingP = await Priority.findAll();
  if (existingP.length === 0) {
    await Priority.bulkCreate([
      { label: 'Low', level: 1 },
      { label: 'Medium', level: 2 },
      { label: 'High', level: 3 }
    ]);
    console.log('Inserted default priorities');
  }
  // Ensure statuses
  const existingS = await Status.findAll();
  if (existingS.length === 0) {
    await Status.bulkCreate([
      { label: 'To Do' },
      { label: 'In Progress' },
      { label: 'Done' }
    ]);
    console.log('Inserted default statuses');
  }
}

async function createSampleUsers(count = 5) {
  const users = [];
  for (let i = 0; i < count; i++) {
    users.push(await User.create({ name: faker.person.fullName(), email: faker.internet.email().toLowerCase() }));
  }
  console.log(`Created ${users.length} users`);
  return users;
}

async function main() {
  const numProjects = parseInt(process.argv[2], 10) || 5;
  const tasksPerProject = parseInt(process.argv[3], 10) || 8;

  try {
    await sequelize.sync();
    await ensureCoreData();

    const priorities = await Priority.findAll();
    const statuses = await Status.findAll();

    const users = await createSampleUsers(6);

    for (let p = 0; p < numProjects; p++) {
      const proj = await Project.create({ project_name: faker.company.name(), description: faker.company.catchPhrase(), owner_id: users[Math.floor(Math.random()*users.length)].user_id });
      console.log('Created project', proj.project_name);
      for (let t = 0; t < tasksPerProject; t++) {
        const author = users[Math.floor(Math.random()*users.length)];
        const priority = priorities[Math.floor(Math.random()*priorities.length)];
        const status = statuses[Math.floor(Math.random()*statuses.length)];
        const title = faker.hacker.phrase();
        const description = faker.lorem.paragraph();
        const task = await Task.create({ title, description, project_id: proj.project_id, user_id: author.user_id, priority_id: priority.priority_id, status_id: status.status_id });
        // create a due date for some tasks
        if (Math.random() < 0.7) {
          const due = await DueDate.create({ task_id: task.task_id, due_date: faker.date.soon({ days: 30 }) });
          // associate due_date to task
          await task.update({ due_date_id: due.due_date_id });
        }
        // create a reminder sometimes
        if (Math.random() < 0.4) {
          const rem = await Reminder.create({ task_id: task.task_id, reminder_at: faker.date.soon({ days: 20 }) });
          await task.update({ reminder_id: rem.reminder_id });
        }
        // optionally attach a fake attachment entry
        if (Math.random() < 0.25) {
          await Attachment.create({ task_id: task.task_id, filename: 'sample.txt', filepath: '/assets/img/uploads/sample.txt', mime: 'text/plain', size: 1234, uploaded_by: author.user_id });
        }
      }
    }

    console.log('Seeding complete');
    process.exit(0);
  } catch (err) {
    console.error('Seeder error', err);
    process.exit(1);
  }
}

main();
