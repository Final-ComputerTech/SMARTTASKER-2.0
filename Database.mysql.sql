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

-- 2. Bảng Auth
CREATE TABLE Auth (
    auth_id CHAR(36) PRIMARY KEY,
    user_id CHAR(36),
    password_hash VARCHAR(255) NOT NULL,
    last_login DATETIME,
    role ENUM('admin','manager','member') DEFAULT 'member',
    FOREIGN KEY (user_id) REFERENCES User(user_id)
);

-- 3. Bảng Project_Category
CREATE TABLE Project_Category (
    category_id CHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

-- 4. Bảng Project
CREATE TABLE Project (
    project_id CHAR(36) PRIMARY KEY,
    category_id CHAR(36),
    project_name VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES Project_Category(category_id)
);

-- 5. Bảng Priority
CREATE TABLE Priority (
    priority_id CHAR(36) PRIMARY KEY,
    name ENUM('Low','Medium','High','Urgent') NOT NULL
);

-- 6. Bảng Status
CREATE TABLE Status (
    status_id CHAR(36) PRIMARY KEY,
    name ENUM('Todo','In Progress','Done','Overdue','Failed') NOT NULL
);

-- 7. Bảng Due_Date
CREATE TABLE Due_Date (
    due_date_id CHAR(36) PRIMARY KEY,
    date DATE,
    time TIME
);

-- 8. Bảng Reminder
CREATE TABLE Reminder (
    reminder_id CHAR(36) PRIMARY KEY,
    date DATE,
    time TIME
);

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


-- Priority
INSERT INTO Priority (priority_id, name) VALUES
(UUID(), 'Low'), 
(UUID(), 'Medium'), 
(UUID(), 'High'), 
(UUID(), 'Urgent');

-- Status
INSERT INTO Status (status_id, name) VALUES
(UUID(), 'Todo'),
(UUID(), 'In Progress'),
(UUID(), 'Done'),
(UUID(), 'Overdue'),
(UUID(), 'Failed');

-- Project Category
INSERT INTO Project_Category (category_id, name) VALUES
(UUID(), 'Work'),
(UUID(), 'Personal'),
(UUID(), 'Shopping'),
(UUID(), 'Family');
