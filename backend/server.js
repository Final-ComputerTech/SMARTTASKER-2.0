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

const PORT = process.env.PORT || 3000;

// Ensure timestamp columns exist with safe defaults to avoid MySQL strict-mode errors
async function ensureTimestampColumns() {
  const tables = ['Users', 'Auths', 'Tasks', 'Notifications'];
  for (const table of tables) {
    try {
      const [rows] = await sequelize.query(`SHOW COLUMNS FROM \`${table}\` LIKE 'createdAt'`);
      if (!rows || rows.length === 0) {
        // Add createdAt and updatedAt with safe defaults
        await sequelize.query(`ALTER TABLE \`${table}\` \
          ADD COLUMN \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, \
          ADD COLUMN \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);
        console.log(`Added timestamp columns to ${table}`);
      }
    } catch (e) {
      // If table doesn't exist yet, ignore error and continue
      // Log unexpected errors for visibility
      if (e && e.original && e.original.errno) {
        // MySQL error - likely table missing; skip
      } else {
        console.warn(`Could not ensure timestamps for ${table}:`, e.message || e);
      }
    }
  }
}

(async () => {
  try {
    await ensureTimestampColumns();
    await sequelize.sync({ alter: true });
    console.log('Database synced');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (err) {
    console.error(err);
  }
})();
