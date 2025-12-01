const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Auth = require('../models/Auth');
const bcrypt = require('bcrypt');

exports.register = async (req, res) => {
  const { name, email, password, role } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email });
    await Auth.create({ user_id: user.user_id, password_hash: hashed, role });
    const token = jwt.sign({ user_id: user.user_id, role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(400).json({ error: 'User not found' });
    const auth = await Auth.findOne({ where: { user_id: user.user_id } });
    const valid = await bcrypt.compare(password, auth.password_hash);
    if (!valid) return res.status(400).json({ error: 'Wrong password' });
    const token = jwt.sign({ user_id: user.user_id, role: auth.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.user_id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user.toPublicJSON());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.user_id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { name, email } = req.body;
    await user.update({ name: name || user.name, email: email || user.email });
    res.json(user.toPublicJSON());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.user_id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const auth = await Auth.findOne({ where: { user_id: user.user_id } });
    const publicUser = user.toPublicJSON();
    publicUser.role = auth ? auth.role : 'member';
    res.json(publicUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.user_id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { name, email } = req.body;
    await user.update({ name: name || user.name, email: email || user.email });
    res.json(user.toPublicJSON());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
