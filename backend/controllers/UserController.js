const userService = require('../services/UserService.js');

module.exports = {
  create: async (req,res) => {
    try{
      const user = await userService.createUser(req.body);
      res.status(201).json({ message:"User created", user });
    }catch(err){ res.status(400).json({ error: err.message }); }
  },

  getAll: async (req,res) => {
    const users = await userService.getAllUsers();
    res.json(users);
  },

  getById: async (req,res) => {
    try{
      const user = await userService.getUserById(req.params.id);
      res.json(user);
    }catch(err){ res.status(404).json({ error: err.message }); }
  },

  update: async (req,res) => {
    try{
      const user = await userService.updateUser(req.params.id, req.body);
      res.json({ message:"User updated", user });
    }catch(err){ res.status(400).json({ error: err.message }); }
  }
};
