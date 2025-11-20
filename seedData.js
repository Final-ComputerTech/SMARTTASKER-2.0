// seeders/seedData.js
const sequelize = require('../config/db');
const bcrypt = require('bcrypt');

const User = require('../models/User');
const Auth = require('../models/Auth');
const Project = require('../models/Project');
const Task = require('../models/Task');
const TaskCollaborator = require('../models/TaskCollaborator');
const Priority = require('../models/Priority');
const Status = require('../models/Status');

// Hàm seed example
async function seed() {
  try {
    await sequelize.sync({ force: true }); // reset DB

    // Tạo user
    const passwordHash = await bcrypt.hash('123456', 10);
    const user = await User.create({ name: 'Admin', email: 'admin@example.com' });
    await Auth.create({ user_id: user.id, token: 'sampletoken', refresh_token: 'refresh', expires_at: new Date() });

    // Tạo project
    const project = await Project.create({ name: 'Sample Project', owner_id: user.id, category_id: 1 });

    // Tạo task
    const task = await Task.create({
      title: 'Sample Task',
      description: 'This is a sample task',
      project_id: project.id,
      user_id: user.id,
      priority_id: 1,
      status_id: 1,
      due_date: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    console.log('Seeding completed successfully');
  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    await sequelize.close();
  }
}

seed();
