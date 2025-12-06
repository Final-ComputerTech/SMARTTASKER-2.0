const User = require('../models/User.js');
const Auth = require('../models/Auth.js');
const Changes = require('../models/Changes.js');
const bcrypt = require('bcrypt');
const { Op } = require('sequelize');

module.exports = {
  async createUser({name,email,password,role}, actor = null) {
    const existing = await User.findOne({ where: { email } });
    if (existing) throw new Error("Email already exists");

    // Managers cannot create admin/manager accounts
    if (actor && actor.role === 'manager') {
      if (role === 'admin' || role === 'manager') throw new Error('Forbidden');
    }

    const user = await User.create({ name, email });
    // Hash password before storing in Auth
    const hashed = await bcrypt.hash(password, 10);
    const assignedRole = role || 'member';
    await Auth.create({ user_id: user.user_id, password_hash: hashed, role: assignedRole });
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

  // Supports optional filters: search (name/email), role, pagination
  async getAllUsers({ search, role, page = 1, limit = 50 } = {}) {
    const where = {};
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }

    const offset = (Math.max(1, page) - 1) * limit;
    const users = await User.findAll({ where, limit, offset, order: [['createdAt','DESC']] });
    const results = [];
    for (const u of users) {
      const auth = await Auth.findOne({ where: { user_id: u.user_id } });
      const pu = u.toPublicJSON();
      pu.role = auth ? auth.role : 'member';
      pu.last_login = auth ? auth.last_login : null;
      results.push(pu);
    }
    return results;
  },

  async getStats() {
    const total = await User.count();
    const authRows = await Auth.findAll({ attributes: ['role'] });
    const counts = { total, admin: 0, manager: 0, member: 0, suspended: 0 };
    for (const a of authRows) {
      const r = a.role || 'member';
      if (counts[r] !== undefined) counts[r]++;
    }
    return counts;
  },

  async resetPassword(id, newPassword) {
    const auth = await Auth.findOne({ where: { user_id: id } });
    if (!auth) throw new Error('Auth record not found');
    const hashed = await bcrypt.hash(newPassword, 10);
    await auth.update({ password_hash: hashed, last_password_change: new Date() });
    // record change
    await Changes.create({ task_id: null, user_id: id, field: 'password', old_value: null, new_value: '***' });
    return true;
  },

  // Generate a temporary password, set it for the user, and return the plaintext once
  async generateTempPassword(id, actor = null) {
    const auth = await Auth.findOne({ where: { user_id: id } });
    if (!auth) throw new Error('Auth record not found');
    const targetRole = auth.role || 'member';
    // Managers are not allowed to generate temp passwords for admins or other managers
    if (actor && actor.role === 'manager') {
      if (targetRole === 'admin' || targetRole === 'manager') throw new Error('Forbidden');
    }
    // generate a reasonably strong temporary password
    const temp = Math.random().toString(36).slice(-10) + Math.random().toString(36).toUpperCase().slice(-2);
    const hashed = await bcrypt.hash(temp, 10);
    await auth.update({ password_hash: hashed, last_password_change: new Date() });
    await Changes.create({ task_id: null, user_id: id, field: 'password_temp_generated', old_value: null, new_value: '***' });
    return temp;
  },

  async setRole(id, role) {
    // actor: optional { user_id, role }
    const actor = arguments.length > 2 ? arguments[2] : null;
    const auth = await Auth.findOne({ where: { user_id: id } });
    if (!auth) throw new Error('Auth record not found');
    const old = auth.role;
    // Managers cannot change roles of admins or other managers, nor assign admin/manager roles
    if (actor && actor.role === 'manager') {
      if (old === 'admin' || old === 'manager') throw new Error('Forbidden');
      if (role === 'admin' || role === 'manager') throw new Error('Forbidden');
    }
    await auth.update({ role });
    await Changes.create({ task_id: null, user_id: id, field: 'role', old_value: old, new_value: role });
    return true;
  },

  async suspendUser(id) {
    const actor = arguments.length > 1 ? arguments[1] : null;
    // reuse setRole permission checks
    return this.setRole(id, 'suspended', actor);
  },

  async deleteUser(id) {
    // actor: optional { user_id, role }
    const actor = arguments.length > 1 ? arguments[1] : null;
    const user = await User.findByPk(id);
    if (!user) throw new Error('User not found');
    const auth = await Auth.findOne({ where: { user_id: id } });
    const targetRole = auth ? auth.role : 'member';
    // Only admin can delete admins or other managers. Managers may delete members only.
    if (actor && actor.role === 'manager') {
      if (targetRole === 'admin' || targetRole === 'manager') throw new Error('Forbidden');
      // prevent manager deleting themselves
      if (actor.user_id === id) throw new Error('Forbidden');
    }
    // if no actor provided default to admin-like behavior (allow)
    // Delete related notifications first to avoid FK constraint errors
    const Notification = require('../models/Notification');
    await Notification.destroy({ where: { user_id: id } });
    await Auth.destroy({ where: { user_id: id } });
    await user.destroy();
    await Changes.create({ task_id: null, user_id: id, field: 'deleted', old_value: null, new_value: 'true' });
    return true;
  },

  async getLogs(id, { limit = 50 } = {}) {
    // actor: optional { user_id, role }
    const actor = arguments.length > 2 ? arguments[2] : null;
    const auth = await Auth.findOne({ where: { user_id: id } });
    const targetRole = auth ? auth.role : 'member';
    // Managers cannot view logs for admins or other managers
    if (actor && actor.role === 'manager') {
      if (targetRole === 'admin' || targetRole === 'manager') throw new Error('Forbidden');
    }
    const logs = await Changes.findAll({ where: { user_id: id }, limit, order: [['createdAt','DESC']] });
    return logs;
  },

  async updateUser(id, {name,email,role}) {
    // actor: optional third argument
    const actor = arguments.length > 2 ? arguments[2] : null;
    const user = await User.findByPk(id);
    if(!user) throw new Error("User not found");
    const auth = await Auth.findOne({ where: { user_id:id } });
    const currentRole = auth ? auth.role : 'member';
    // Managers cannot edit admins or other managers
    if (actor && actor.role === 'manager') {
      if (currentRole === 'admin' || currentRole === 'manager') throw new Error('Forbidden');
      // also prevent manager from changing role to admin/manager
      if (role === 'admin' || role === 'manager') throw new Error('Forbidden');
    }
    await user.update({ name, email });
    if(role){
      if (!auth) throw new Error('Auth record not found');
      await auth.update({ role });
    }
    return user.toPublicJSON();
  }
};
