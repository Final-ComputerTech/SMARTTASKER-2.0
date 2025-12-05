const notifCtrl = require('../controllers/notificationController');
const sequelize = require('../config/db');
const User = require('../models/User');

(async ()=>{
  try {
    await sequelize.authenticate();
    const user = await User.findOne({ raw: true });
    if (!user) { console.log('No user found'); process.exit(1); }
    const req = { user: { user_id: user.user_id, role: 'member' }, query: { page: '1', limit: '5' } };
    const res = {
      status(code) { return { json: (payload) => { console.log('RES status', code, payload); } }; },
      json(payload) { console.log('RES json', payload); }
    };
    console.log('Invoking controller.listNotifications with user:', req.user.user_id);
    await notifCtrl.listNotifications(req, res);
    process.exit(0);
  } catch (e) {
    console.error('Runner error', e);
    process.exit(2);
  }
})();
