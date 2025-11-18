const User = require('../models/User.js');
const Auth = require('../models/Auth.js');

module.exports = {
  async createUser({name,email,password,role}) {
    const existing = await User.findOne({ where: { email } });
    if(existing) throw new Error("Email already exists");

    const user = await User.create({ name, email });
    await Auth.create({ user_id: user.user_id, password_hash: password, role });
    return user.toPublicJSON();
  },

  async getUserById(id) {
    const user = await User.findByPk(id, { include: [{ model: Auth, attributes: ['role'] }] });
    if(!user) throw new Error("User not found");
    return user.toPublicJSON();
  },

  async getAllUsers() {
    const users = await User.findAll({ include: [{ model: Auth, attributes: ['role'] }] });
    return users.map(u => u.toPublicJSON());
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
