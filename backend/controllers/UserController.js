const userService = require('../services/UserService.js');

module.exports = {
  create: async (req,res) => {
    try{
      // Pass the actor so service can enforce manager restrictions
      const user = await userService.createUser(req.body, req.user);
      res.status(201).json({ message:"User created", user });
    }catch(err){
      if (err && err.message === 'Forbidden') return res.status(403).json({ error: err.message });
      res.status(400).json({ error: err.message });
    }
  },

  getAll: async (req,res) => {
    const { search, role, page, limit } = req.query;
    const users = await userService.getAllUsers({ search, role, page: parseInt(page) || 1, limit: parseInt(limit) || 50 });
    res.json(users);
  },

  getById: async (req,res) => {
    try{
      const user = await userService.getUserById(req.params.id);
      res.json(user);
    } catch (err) { res.status(404).json({ error: err.message }); } },
  stats: async (req,res) => {
    const stats = await userService.getStats();
    res.json(stats);
  },

  update: async (req,res) => {
    try{
      const user = await userService.updateUser(req.params.id, req.body, req.user);
      res.json({ message: 'User updated', user });
    }catch(err){
      if (err && err.message === 'Forbidden') return res.status(403).json({ error: err.message });
      res.status(400).json({ error: err.message });
    }
  },

  resetPassword: async (req,res) => {
    try{
      const { password } = req.body;
      await userService.resetPassword(req.params.id, password);
      res.json({ message: 'Password reset' });
    }catch(err){ res.status(400).json({ error: err.message }); }
  },

  setRole: async (req,res) => {
    try{
      const { role } = req.body;
      await userService.setRole(req.params.id, role, req.user);
      res.json({ message: 'Role updated' });
    }catch(err){
      if (err && err.message === 'Forbidden') return res.status(403).json({ error: err.message });
      res.status(400).json({ error: err.message });
    }
  },

  suspend: async (req,res) => {
    try{
      await userService.suspendUser(req.params.id, req.user);
      res.json({ message: 'User suspended' });
    }catch(err){
      if (err && err.message === 'Forbidden') return res.status(403).json({ error: err.message });
      res.status(400).json({ error: err.message });
    }
  },

  remove: async (req,res) => {
    try{
      await userService.deleteUser(req.params.id, req.user);
      res.json({ message: 'User deleted' });
    }catch(err){
      if (err && err.message === 'Forbidden') return res.status(403).json({ error: err.message });
      res.status(400).json({ error: err.message });
    }
  },

  logs: async (req,res) => {
    try{
      const logs = await userService.getLogs(req.params.id, req.query, req.user);
      res.json(logs);
    }catch(err){
      if (err && err.message === 'Forbidden') return res.status(403).json({ error: err.message });
      res.status(400).json({ error: err.message });
    }
  }
  ,
  generateTemp: async (req,res) => {
    try{
      const temp = await userService.generateTempPassword(req.params.id);
      res.json({ temp });
    }catch(err){ res.status(400).json({ error: err.message }); }
  }
};
