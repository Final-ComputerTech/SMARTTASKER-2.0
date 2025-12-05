const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sequelize = require('./config/db');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const taskRoutes = require('./routes/taskRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const userRoutes = require('./routes/UserRouters');
const projectRoutes = require('./routes/projectRoutes');
const oauthRoutes = require('./routes/oauthRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const metaRoutes = require('./routes/metaRoutes');
// scheduled jobs
require('./cron/notificationCron');

const app = express();
app.use(cors());
// Configure body parsing with reasonable limits (allow base64 avatar uploads)
// Increased limits to allow larger base64 payloads from the frontend.
// If you expect very large file uploads, consider switching to multipart/form-data.
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(bodyParser.raw({ limit: '50mb' }));
app.use(bodyParser.text({ limit: '10mb' }));

// Simple request logger to help debug route issues (will print method + URL)
app.use((req, res, next) => {
  try { console.log(`[req] ${req.method} ${req.originalUrl} - content-length: ${req.headers['content-length'] || 'n/a'}`); } catch (e) {}
  next();
});

const path = require('path');

// Serve frontend static files from the repo `frontend` folder
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html')));

// Health check endpoint
app.get('/api', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'SMARTTASKER API v1.0',
    endpoints: {
      auth: '/api/auth/register, /api/auth/login',
      tasks: '/api/tasks',
      notifications: '/api/notifications'
    }
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
// OAuth status and placeholders
app.use('/api/oauth', oauthRoutes);
// Dashboard summary
app.use('/api/dashboard', dashboardRoutes);
// Meta endpoints for client-side selects (priorities, statuses)
app.use('/api/meta', metaRoutes);
// Mount user management routes (admin access)
app.use('/api/users', require('./routes/UserRouters'));
// User management routes (admin + profile endpoints)
app.use('/api/users', require('./routes/UserRouters'));

// 404 Handler (must come after all routes)
app.use(notFoundHandler);

// Global Error Handler (must come last)
app.use(errorHandler);

// Global process-level handlers to catch and log SQL errors not reaching express error middleware
process.on('unhandledRejection', (reason, p) => {
  try {
    console.error('UnhandledRejection at:', p, 'reason:', reason && (reason.stack || reason));
    if (reason && reason.sql) console.error('SQL:', reason.sql);
    if (reason && reason.parent && reason.parent.sql) console.error('Parent SQL:', reason.parent.sql);
  } catch (e) {}
});
process.on('uncaughtException', (err) => {
  try {
    console.error('UncaughtException:', err && (err.stack || err));
    if (err && err.sql) console.error('SQL:', err.sql);
    if (err && err.parent && err.parent.sql) console.error('Parent SQL:', err.parent.sql);
  } catch (e) {}
});

const PORT = process.env.PORT || 3000;

// Ensure timestamp columns exist with safe defaults to avoid MySQL strict-mode errors
async function ensureTimestampColumns() {
  try {
    // Get a list of existing tables in the connected database
    const [tables] = await sequelize.query("SHOW TABLES");
    const tableNames = tables.map(r => Object.values(r)[0]);

    // For each existing table, ensure both camelCase and underscored timestamp columns exist
    for (const table of tableNames) {
      try {
        const [hasCreatedAt] = await sequelize.query(`SHOW COLUMNS FROM \`${table}\` LIKE 'createdAt'`);
        const [hasUpdatedAt] = await sequelize.query(`SHOW COLUMNS FROM \`${table}\` LIKE 'updatedAt'`);
        const [hasCreated_at] = await sequelize.query(`SHOW COLUMNS FROM \`${table}\` LIKE 'created_at'`);
        const [hasUpdated_at] = await sequelize.query(`SHOW COLUMNS FROM \`${table}\` LIKE 'updated_at'`);

        const alters = [];
        if (!hasCreatedAt || hasCreatedAt.length === 0) {
          alters.push("ADD COLUMN `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
        }
        if (!hasUpdatedAt || hasUpdatedAt.length === 0) {
          alters.push("ADD COLUMN `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
        }
        if (!hasCreated_at || hasCreated_at.length === 0) {
          alters.push("ADD COLUMN `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
        }
        if (!hasUpdated_at || hasUpdated_at.length === 0) {
          alters.push("ADD COLUMN `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
        }

        if (alters.length > 0) {
          // Build a safe ALTER TABLE statement adding only missing columns
          const stmt = `ALTER TABLE \`${table}\` ${alters.join(', ')}`;
          await sequelize.query(stmt);
          console.log(`Added timestamp columns to ${table}`);
        }
      } catch (e) {
        // Best-effort only — if a table is a view or special, skip
      }
    }
  } catch (e) {
    console.warn('Could not read tables to ensure timestamps:', e.message || e);
  }
}

// Ensure notifications table has optional classification columns
async function ensureNotificationColumns() {
  try {
    const [rows] = await sequelize.query("SHOW COLUMNS FROM `notifications` LIKE 'type'");
    if (!rows || rows.length === 0) {
      await sequelize.query('ALTER TABLE `notifications` '
        + 'ADD COLUMN `title` VARCHAR(255) NULL, '
        + 'ADD COLUMN `description` TEXT NULL, '
        + 'ADD COLUMN `type` VARCHAR(100) NULL, '
        + 'ADD COLUMN `severity` VARCHAR(50) NULL');
      console.log('Added notification classification columns to notifications');
    }
  } catch (e) {
    // ignore if notifications table doesn't exist yet or other benign error
  }
}

// Ensure core meta data exists: priorities and statuses
async function ensureCoreMeta() {
  try {
    const Priority = require('./models/Priority');
    const Status = require('./models/Status');
    const pri = await Priority.findAll();
    if (!pri || pri.length === 0) {
      await Priority.bulkCreate([
        { label: 'Low', level: 1 },
        { label: 'Medium', level: 2 },
        { label: 'High', level: 3 }
      ]);
      console.log('Inserted default priorities');
    }
    const st = await Status.findAll();
    if (!st || st.length === 0) {
      await Status.bulkCreate([
        { label: 'To Do' },
        { label: 'In Progress' },
        { label: 'Done' }
      ]);
      console.log('Inserted default statuses');
    }
  } catch (e) {
    console.warn('Could not ensure core meta:', e.message || e);
  }
}

(async () => {
  try {
    await ensureTimestampColumns();
    await ensureNotificationColumns();
    await ensureCoreMeta();
    await sequelize.sync({ alter: true });
    console.log('Database synced');
    const server = app.listen(PORT, () => {
      try {
        const addr = server.address();
        // addr.address may be '::' for IPv6 or '0.0.0.0' when bound to all interfaces
        console.log(`Server listening on ${addr.address || '0.0.0.0'}:${addr.port}`);
      } catch (e) {
        console.log(`Server running on port ${PORT}`);
      }
    });
  } catch (err) {
    console.error(err);
  }
})();
