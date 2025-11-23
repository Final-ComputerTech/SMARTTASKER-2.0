CREATE DATABASE smarttasker_2_0;
USE smarttasker_2_0;

-- 1. Bảng User
CREATE TABLE User (
    user_id CHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Seed User
INSERT INTO User (user_id, name, email)
VALUES
(UUID(), 'Admin User', 'admin@smarttasker.com'),
(UUID(), 'Manager One', 'manager1@smarttasker.com'),
(UUID(), 'Member One', 'member1@smarttasker.com');


-- 2. Bảng Auth
CREATE TABLE Auth (
    auth_id CHAR(36) PRIMARY KEY,
    user_id CHAR(36),
    password_hash VARCHAR(255) NOT NULL,
    last_login DATETIME,
    role ENUM('admin','manager','member') DEFAULT 'member',
    FOREIGN KEY (user_id) REFERENCES User(user_id)
);

-- Seed Auth (password hash mô phỏng)
INSERT INTO Auth (auth_id, user_id, password_hash, role)
SELECT UUID(), user_id, '$2a$10$abcdefghijklmnopqrstuv', 'admin'
FROM User WHERE email='admin@smarttasker.com';

INSERT INTO Auth (auth_id, user_id, password_hash, role)
SELECT UUID(), user_id, '$2a$10$abcdefghijklmnopqrstuv', 'manager'
FROM User WHERE email='manager1@smarttasker.com';

INSERT INTO Auth (auth_id, user_id, password_hash, role)
SELECT UUID(), user_id, '$2a$10$abcdefghijklmnopqrstuv', 'member'
FROM User WHERE email='member1@smarttasker.com';


-- 3. Bảng Project_Category
CREATE TABLE Project_Category (
    category_id CHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

INSERT INTO Project_Category (category_id, name) VALUES
(UUID(), 'Work'),
(UUID(), 'Personal'),
(UUID(), 'Shopping'),
(UUID(), 'Family');

-- 4. Bảng Project
CREATE TABLE Project (
    project_id CHAR(36) PRIMARY KEY,
    category_id CHAR(36),
    project_name VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES Project_Category(category_id)
);

-- Seed sample project
INSERT INTO Project (project_id, category_id, project_name)
SELECT UUID(), category_id, 'SmartTasker Backend Development'
FROM Project_Category WHERE name='Work';

INSERT INTO Project (project_id, category_id, project_name)
SELECT UUID(), category_id, 'Shopping Plan'
FROM Project_Category WHERE name='Shopping';



-- 5. Bảng Priority
CREATE TABLE Priority (
    priority_id CHAR(36) PRIMARY KEY,
    name ENUM('Low','Medium','High','Urgent') NOT NULL
);

INSERT INTO Priority (priority_id, name) VALUES
(UUID(), 'Low'), 
(UUID(), 'Medium'), 
(UUID(), 'High'), 
(UUID(), 'Urgent');

-- 6. Bảng Status
CREATE TABLE Status (
    status_id CHAR(36) PRIMARY KEY,
    name ENUM('Todo','In Progress','Done','Overdue','Failed') NOT NULL
);

-- Status
INSERT INTO Status (status_id, name) VALUES
(UUID(), 'Todo'),
(UUID(), 'In Progress'),
(UUID(), 'Done'),
(UUID(), 'Overdue'),
(UUID(), 'Failed');

-- 7. Bảng Due_Date
CREATE TABLE Due_Date (
    due_date_id CHAR(36) PRIMARY KEY,
    date DATE,
    time TIME
);

INSERT INTO Due_Date (due_date_id, date, time) VALUES
(UUID(), '2025-02-15', '14:00:00'),
(UUID(), '2025-02-20', '09:00:00');


-- 8. Bảng Reminder
CREATE TABLE Reminder (
    reminder_id CHAR(36) PRIMARY KEY,
    date DATE,
    time TIME
);

INSERT INTO Reminder (reminder_id, date, time) VALUES
(UUID(), '2025-02-15', '13:00:00'),
(UUID(), '2025-02-20', '08:30:00');

-- 9. Bảng Task
CREATE TABLE Task (
    task_id CHAR(36) PRIMARY KEY,
    project_id CHAR(36),
    user_id CHAR(36),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority_id CHAR(36),
    due_date_id CHAR(36),
    reminder_id CHAR(36),
    status_id CHAR(36),
    attachment VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES Project(project_id),
    FOREIGN KEY (user_id) REFERENCES User(user_id),
    FOREIGN KEY (priority_id) REFERENCES Priority(priority_id),
    FOREIGN KEY (due_date_id) REFERENCES Due_Date(due_date_id),
    FOREIGN KEY (reminder_id) REFERENCES Reminder(reminder_id),
    FOREIGN KEY (status_id) REFERENCES Status(status_id)
);

-- Seed task
INSERT INTO Task (task_id, project_id, user_id, title, description, priority_id, due_date_id, reminder_id, status_id)
SELECT
    UUID(),
    (SELECT project_id FROM Project LIMIT 1),
    (SELECT user_id FROM User WHERE email='manager1@smarttasker.com'),
    'Thiết kế Database SmartTasker',
    'Tạo ERD, relationship, seed data, foreign keys.',
    (SELECT priority_id FROM Priority WHERE name='High'),
    (SELECT due_date_id FROM Due_Date LIMIT 1),
    (SELECT reminder_id FROM Reminder LIMIT 1),
    (SELECT status_id FROM Status WHERE name='In Progress');

-- 10. Bảng Collaborator (N-N với Task)
CREATE TABLE Collaborator (
    collaborator_id CHAR(36) PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255)
);

CREATE TABLE Task_Collaborator (
    task_id CHAR(36),
    collaborator_id CHAR(36),
    PRIMARY KEY(task_id, collaborator_id),
    FOREIGN KEY (task_id) REFERENCES Task(task_id),
    FOREIGN KEY (collaborator_id) REFERENCES Collaborator(collaborator_id)
);

INSERT INTO Collaborator (collaborator_id, name, email) VALUES
(UUID(), 'Hương Ly', 'ly.collab@example.com'),
(UUID(), 'Lan Anh', 'lananh.collab@example.com');

-- Link collaborators to task
INSERT INTO Task_Collaborator (task_id, collaborator_id)
SELECT (SELECT task_id FROM Task LIMIT 1), collaborator_id
FROM Collaborator;

-- 11. Bảng Changes
CREATE TABLE Changes (
    change_id CHAR(36) PRIMARY KEY,
    task_id CHAR(36),
    user_id CHAR(36),
    description TEXT,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES Task(task_id),
    FOREIGN KEY (user_id) REFERENCES User(user_id)
);

INSERT INTO Changes (change_id, task_id, user_id, description)
VALUES
(UUID(), (SELECT task_id FROM Task LIMIT 1), (SELECT user_id FROM User LIMIT 1), 'Khởi tạo task lần đầu.');


-- 12. Bảng Conversation
CREATE TABLE Conversation (
    conversation_id CHAR(36) PRIMARY KEY,
    task_id CHAR(36),
    created_by CHAR(36),
    message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES Task(task_id),
    FOREIGN KEY (created_by) REFERENCES User(user_id)
);

INSERT INTO Conversation (conversation_id, task_id, created_by, message)
VALUES
(UUID(), (SELECT task_id FROM Task LIMIT 1), (SELECT user_id FROM User LIMIT 1), 'Nhớ update tiến độ nhé!');

-- Project Category
INSERT INTO Project_Category (category_id, name) VALUES
(UUID(), 'Work'),
(UUID(), 'Personal'),
(UUID(), 'Shopping'),
(UUID(), 'Family');

