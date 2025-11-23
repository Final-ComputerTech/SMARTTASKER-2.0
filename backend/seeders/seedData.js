const sequelize = require('../config/db');
const bcrypt = require('bcrypt');

async function seedDatabase() {
  try {
    console.log('Starting database seed...');

    // 1. Create Users
    const [users] = await sequelize.query(
      `INSERT INTO Users (user_id, name, email, createdAt, updatedAt) 
       VALUES 
       (UUID(), 'Admin User', 'admin@smarttasker.com', NOW(), NOW()),
       (UUID(), 'Manager One', 'manager1@smarttasker.com', NOW(), NOW()),
       (UUID(), 'Member One', 'member1@smarttasker.com', NOW(), NOW())`
    );
    console.log('✓ Created 3 users');

    // Get user IDs
    const [userRows] = await sequelize.query(`SELECT user_id FROM Users LIMIT 3`);
    const userIds = userRows.map(r => r.user_id);

    // 2. Create Auth records
    const plainPassword = 'password123';
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    
    await sequelize.query(
      `INSERT INTO Auths (auth_id, user_id, password_hash, role, createdAt, updatedAt) 
       VALUES 
       (UUID(), ?, ?, 'admin', NOW(), NOW()),
       (UUID(), ?, ?, 'manager', NOW(), NOW()),
       (UUID(), ?, ?, 'member', NOW(), NOW())`,
      { replacements: [userIds[0], hashedPassword, userIds[1], hashedPassword, userIds[2], hashedPassword] }
    );
    console.log('✓ Created 3 auth records (password: password123)');

    // 3. Create Project Categories
    const [categories] = await sequelize.query(
      `INSERT INTO ProjectCategories (category_id, name, createdAt, updatedAt) 
       VALUES 
       (UUID(), 'Work', NOW(), NOW()),
       (UUID(), 'Personal', NOW(), NOW()),
       (UUID(), 'Shopping', NOW(), NOW()),
       (UUID(), 'Family', NOW(), NOW())`
    );
    console.log('✓ Created 4 project categories');

    const [categoryRows] = await sequelize.query(`SELECT category_id FROM ProjectCategories LIMIT 2`);
    const categoryIds = categoryRows.map(r => r.category_id);

    // 4. Create Projects
    await sequelize.query(
      `INSERT INTO Projects (project_id, category_id, project_name, createdAt, updatedAt) 
       VALUES 
       (UUID(), ?, 'SmartTasker Backend Development', NOW(), NOW()),
       (UUID(), ?, 'Shopping Plan', NOW(), NOW())`,
      { replacements: [categoryIds[0], categoryIds[1]] }
    );
    console.log('✓ Created 2 projects');

    // 5. Create Priorities
    await sequelize.query(
      `INSERT INTO Priorities (priority_id, name, createdAt, updatedAt) 
       VALUES 
       (UUID(), 'Low', NOW(), NOW()),
       (UUID(), 'Medium', NOW(), NOW()),
       (UUID(), 'High', NOW(), NOW()),
       (UUID(), 'Urgent', NOW(), NOW())`
    );
    console.log('✓ Created 4 priority levels');

    // 6. Create Status
    await sequelize.query(
      `INSERT INTO Statuses (status_id, name, createdAt, updatedAt) 
       VALUES 
       (UUID(), 'Todo', NOW(), NOW()),
       (UUID(), 'In Progress', NOW(), NOW()),
       (UUID(), 'Done', NOW(), NOW()),
       (UUID(), 'Overdue', NOW(), NOW()),
       (UUID(), 'Failed', NOW(), NOW())`
    );
    console.log('✓ Created 5 status types');

    // 7. Create Due Dates
    await sequelize.query(
      `INSERT INTO DueDates (due_date_id, date, time, createdAt, updatedAt) 
       VALUES 
       (UUID(), '2025-02-15', '14:00:00', NOW(), NOW()),
       (UUID(), '2025-02-20', '09:00:00', NOW(), NOW())`
    );
    console.log('✓ Created 2 due dates');

    // 8. Create Reminders
    await sequelize.query(
      `INSERT INTO Reminders (reminder_id, date, time, createdAt, updatedAt) 
       VALUES 
       (UUID(), '2025-02-15', '13:00:00', NOW(), NOW()),
       (UUID(), '2025-02-20', '08:30:00', NOW(), NOW())`
    );
    console.log('✓ Created 2 reminders');

    // 9. Create Collaborators
    await sequelize.query(
      `INSERT INTO Collaborators (collaborator_id, name, email, createdAt, updatedAt) 
       VALUES 
       (UUID(), 'Hương Ly', 'ly.collab@example.com', NOW(), NOW()),
       (UUID(), 'Lan Anh', 'lananh.collab@example.com', NOW(), NOW())`
    );
    console.log('✓ Created 2 collaborators');

    console.log('\nDatabase seeding completed successfully!');
    console.log('\nTest Credentials:');
    console.log('  - Admin: admin@smarttasker.com / password123');
    console.log('  - Manager: manager1@smarttasker.com / password123');
    console.log('  - Member: member1@smarttasker.com / password123');
    
    process.exit(0);
  } catch (error) {
    console.error('Seed Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

seedDatabase();
