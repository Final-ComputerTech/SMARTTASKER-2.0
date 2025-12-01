const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Auth = require('../models/Auth');
const bcrypt = require('bcrypt');

exports.register = async (req, res) => {
  const { name, email, password } = req.body;
  try {
    // Public registration always creates a 'member' role. Admins should create other roles
    // using the protected /api/users endpoint.
    const role = 'member';
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
    const {
      name, email, bio, gender, dob, phone, address, timezone, language
    } = req.body;
    // Log incoming payload for debugging (non-sensitive fields only)
    try { console.log('updateMe payload:', { name, email, bio, gender, dob, phone, address, timezone, language }); } catch (e) {}
    // Build update payload only with provided fields
    const updates = {};
    if (typeof name !== 'undefined') updates.name = name || user.name;
    if (typeof email !== 'undefined') updates.email = email || user.email;
    if (typeof bio !== 'undefined') updates.bio = bio;
    if (typeof gender !== 'undefined') updates.gender = gender;
    if (typeof dob !== 'undefined') updates.dob = dob || null;
    if (typeof phone !== 'undefined') updates.phone = phone;
    if (typeof address !== 'undefined') updates.address = address;
    if (typeof timezone !== 'undefined') updates.timezone = timezone;
    if (typeof language !== 'undefined') updates.language = language;

    await user.update(updates);
    try { console.log('updateMe - resulting user:', user.toPublicJSON()); } catch (e) {}
    res.json(user.toPublicJSON());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Upload avatar as base64 JSON: { filename, data }
exports.uploadAvatar = async (req, res) => {
  try {
    // If multer processed a file, use req.file
    if (req.file) {
      const publicPath = `/assets/img/uploads/${req.file.filename}`;
      const User = require('../models/User');
      const user = await User.findByPk(req.user.user_id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      await user.update({ avatar: publicPath });
      return res.json({ success: true, avatar: publicPath });
    }

    const { filename, data } = req.body;
    if (!filename || !data) return res.status(400).json({ error: 'filename and data are required' });
    // Log request size info to help debug 413 Payload Too Large errors
    try {
      const cl = req.headers['content-length'];
      if (cl) console.log(`uploadAvatar: Content-Length header = ${cl}`);
    } catch (e) {}
    // Accept either a Data URL (data:<mime>;base64,XXXX) or a raw base64 string.
    if (typeof data !== 'string') return res.status(400).json({ error: 'Invalid data format' });
    let base64 = '';
    const dataUrlMatch = data.match(/^data:([\w/+.-]+);base64,(.*)$/s);
    if (dataUrlMatch) {
      base64 = dataUrlMatch[2];
    } else {
      // remove whitespace/newlines and validate characters
      const cleaned = data.replace(/\s+/g, '');
      if (/^[A-Za-z0-9+/=]+$/.test(cleaned)) {
        base64 = cleaned;
      } else {
        return res.status(400).json({ error: 'Invalid base64 data' });
      }
    }
    let buf;
    try {
      buf = Buffer.from(base64, 'base64');
      // approximate binary size and guard against too-large uploads
      const approxBytes = Math.floor((base64.length * 3) / 4);
      console.log(`uploadAvatar: approx upload size = ${approxBytes} bytes`);
      const MAX_BYTES = 50 * 1024 * 1024; // 50 MB
      if (approxBytes > MAX_BYTES) return res.status(413).json({ error: 'Payload too large' });
    } catch (e) {
      return res.status(400).json({ error: 'Invalid base64 string' });
    }
    const uploadsDir = require('path').join(__dirname, '..', '..', 'frontend', 'assets', 'img', 'uploads');
    const fs = require('fs');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    const safeName = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
    const outPath = require('path').join(uploadsDir, safeName);
    fs.writeFileSync(outPath, buf);
    // Save relative public path in user.avatar
    const publicPath = `/assets/img/uploads/${safeName}`;
    const User = require('../models/User');
    const user = await User.findByPk(req.user.user_id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await user.update({ avatar: publicPath });
    res.json({ success: true, avatar: publicPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Change password for current user
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both currentPassword and newPassword are required' });
    const auth = await Auth.findOne({ where: { user_id: req.user.user_id } });
    if (!auth) return res.status(404).json({ error: 'Auth record not found' });
    const valid = await bcrypt.compare(currentPassword, auth.password_hash);
    if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });
    const hashed = await bcrypt.hash(newPassword, 10);
    await auth.update({ password_hash: hashed });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete current user's account (protected)
exports.deleteMe = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Remove auth record first
    await Auth.destroy({ where: { user_id: userId } });

    // Optionally remove user-related data here (tasks, notifications) — not implemented
    await user.destroy();

    res.json({ success: true, message: 'Account deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

