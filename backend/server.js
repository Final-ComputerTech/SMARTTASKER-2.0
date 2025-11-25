const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sequelize = require('./config/db');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const taskRoutes = require('./routes/taskRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
// scheduled jobs
require('./cron/notificationCron');

const app = express();
app.use(cors());
app.use(bodyParser.json());
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
