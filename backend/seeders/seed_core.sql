-- Seed core reference data: priorities, statuses
-- Run this SQL in your MySQL client connected to the application's database.

-- Priorities
INSERT INTO priorities (priority_id, label, level) VALUES (UUID(), 'Low', 1);
INSERT INTO priorities (priority_id, label, level) VALUES (UUID(), 'Medium', 2);
INSERT INTO priorities (priority_id, label, level) VALUES (UUID(), 'High', 3);

-- Statuses
INSERT INTO statuses (status_id, label) VALUES (UUID(), 'To Do');
INSERT INTO statuses (status_id, label) VALUES (UUID(), 'In Progress');
INSERT INTO statuses (status_id, label) VALUES (UUID(), 'Done');

-- Example DueDate and Reminder records (replace <TASK_UUID> with real task ids)
-- INSERT INTO due_dates (due_date_id, task_id, due_date, created_at, updated_at) VALUES (UUID(), '<TASK_UUID>', '2025-12-10 12:00:00', NOW(), NOW());
-- INSERT INTO reminders (reminder_id, task_id, reminder_at, created_at, updated_at) VALUES (UUID(), '<TASK_UUID>', '2025-12-09 12:00:00', NOW(), NOW());

-- Notes:
-- - If you use Sequelize sync({ alter: true }) the tables will be created automatically.
-- - The sample due_date/reminder rows need an existing task_id to reference; the faker seeder creates tasks and attaches due_dates/reminders automatically.
