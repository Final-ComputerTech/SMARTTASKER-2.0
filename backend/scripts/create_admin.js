const bcrypt = require('bcrypt');
const sequelize = require('../config/db');
const User = require('../models/User');
const Auth = require('../models/Auth');

async function run() {
  const email = process.argv[2] || 'admin@smarttasker.com';
  const password = process.argv[3] || 'password';
  const name = process.argv[4] || 'Admin User';

  try {
    await sequelize.authenticate();
  } catch (e) {
    console.error('DB connection failed:', e && e.message ? e.message : e);
    process.exit(1);
  }

  let user = await User.findOne({ where: { email } });
  if (!user) {
    user = await User.create({ name, email });
    console.log('Created user', email, 'id=', user.user_id);
  } else {
    console.log('User already exists:', email, 'id=', user.user_id);
  }

  const hash = await bcrypt.hash(password, 10);
  let auth = await Auth.findOne({ where: { user_id: user.user_id } });
  if (!auth) {
    await Auth.create({ user_id: user.user_id, password_hash: hash, role: 'admin' });
    console.log('Created auth record for', email);
  } else {
    await auth.update({ password_hash: hash, role: 'admin' });
    console.log('Updated auth record for', email);
  }

  console.log('Done. You can now login with', email, 'and the password you provided.');
  process.exit(0);
}

run().catch(err => {
  console.error('create_admin failed:', err && err.stack ? err.stack : err);
  process.exit(1);
});
