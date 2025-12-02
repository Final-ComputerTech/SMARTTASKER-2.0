# ERD (Entity Relationship) - SMARTTASKER (Core Tables)

This document describes the core tables referenced by the seeder and their constraints.

Tables and important columns

- users
  - user_id (PK, UUID)
  - name, email, avatar, ...

- projects
  - project_id (PK, UUID)
  - project_name, description, owner_id -> users.user_id (nullable)

- priorities
  - priority_id (PK, UUID)
  - label (e.g. Low, Medium, High)
  - level (int)

- statuses
  - status_id (PK, UUID)
  - label (e.g. To Do, In Progress, Done)

- tasks
  - task_id (PK, UUID)
  - title, description, attachment
  - user_id -> users.user_id (nullable)
  - project_id -> projects.project_id (nullable)
  - priority_id -> priorities.priority_id (nullable)
  - status_id -> statuses.status_id (nullable)
  - due_date_id -> due_dates.due_date_id (nullable)
  - reminder_id -> reminders.reminder_id (nullable)

- due_dates
  - due_date_id (PK, UUID)
  - task_id -> tasks.task_id (NOT NULL)
  - due_date (DATETIME)

- reminders
  - reminder_id (PK, UUID)
  - task_id -> tasks.task_id (NOT NULL)
  - reminder_at (DATETIME)

- attachments
  - attachment_id (PK, UUID)
  - task_id -> tasks.task_id (NOT NULL)
  - filename, filepath, mime, size, uploaded_by -> users.user_id (nullable)

Constraints and FKs (simplified)

- tasks.user_id REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE CASCADE
- tasks.project_id REFERENCES projects(project_id) ON DELETE SET NULL ON UPDATE CASCADE
- tasks.priority_id REFERENCES priorities(priority_id) ON DELETE SET NULL ON UPDATE CASCADE
- tasks.status_id REFERENCES statuses(status_id) ON DELETE SET NULL ON UPDATE CASCADE
- due_dates.task_id REFERENCES tasks(task_id) ON DELETE CASCADE ON UPDATE CASCADE
- reminders.task_id REFERENCES tasks(task_id) ON DELETE CASCADE ON UPDATE CASCADE
- attachments.task_id REFERENCES tasks(task_id) ON DELETE CASCADE ON UPDATE CASCADE
- attachments.uploaded_by REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE CASCADE

Notes
- DueDate and Reminder are modeled as separate rows to allow audit/history and multiple reminders per task if desired.
- Several FK relations use `ON DELETE SET NULL` for optional links (project/priority/status/user) so deleting a referenced row doesn't orphan dependent tasks irreversibly.

Use this ERD doc as a quick reference when running seeders or adding migrations.
