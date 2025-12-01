const User = require('../models/User.js');
const Auth = require('../models/Auth.js');
const bcrypt = require('bcrypt');

module.exports = {
  async createUser({name,email,password,role}) {
    const existing = await User.findOne({ where: { email } });
    if (existing) throw new Error("Email already exists");

    const user = await User.create({ name, email });
    // Hash password before storing in Auth
    const hashed = await bcrypt.hash(password, 10);
    await Auth.create({ user_id: user.user_id, password_hash: hashed, role });
    return user.toPublicJSON();
  },

  async getUserById(id) {
    const user = await User.findByPk(id);
    if(!user) throw new Error("User not found");
    const auth = await Auth.findOne({ where: { user_id: id } });
    const pub = user.toPublicJSON();
    pub.role = auth ? auth.role : 'member';
    return pub;
  },

  async getAllUsers() {
    const users = await User.findAll();
    const results = [];
    for (const u of users) {
      const auth = await Auth.findOne({ where: { user_id: u.user_id } });
      const pu = u.toPublicJSON();
      pu.role = auth ? auth.role : 'member';
      results.push(pu);
    }
    return results;
  },

  async updateUser(id, {name,email,role}) {
    const user = await User.findByPk(id);
    if(!user) throw new Error("User not found");
    await user.update({ name, email });
    if(role){
      const auth = await Auth.findOne({ where: { user_id:id } });
      await auth.update({ role });
    }
    return user.toPublicJSON();
  }
};
