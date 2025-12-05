const sequelize = require('../config/db');
const Notification = require('../models/Notification');
const User = require('../models/User');

(async function(){
  try {
    console.log('Connecting to DB...');
    await sequelize.authenticate();
    console.log('DB connected');
    const user = await User.findOne({ raw: true });
    if (!user) {
      console.log('No user found in DB');
      process.exit(1);
    }
    console.log('Using user_id:', user.user_id);
    console.log('Running Notification.findAll with logging to capture SQL...');
    const rows = await Notification.findAll({ where: { user_id: user.user_id }, limit: 5, logging: msg => console.log('[sequelize-debug]', msg), raw: true });
    console.log('Rows:', rows.length);
    process.exit(0);
  } catch (e) {
    console.error('Debug script error:', e);
    if (e && e.sql) console.error('err.sql:', e.sql);
    process.exit(2);
  }
})();
