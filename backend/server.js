const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sequelize = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const taskRoutes = require('./routes/taskRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();
app.use(cors());
app.use(bodyParser.json());

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

const PORT = process.env.PORT || 3000;

sequelize.sync({ alter: true }).then(() => {
  console.log('Database synced');
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch(err => console.log(err));
