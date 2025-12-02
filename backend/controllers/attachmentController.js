const path = require('path');
const fs = require('fs');
const Attachment = require('../models/Attachment');

exports.listForTask = async (req, res) => {
  try {
    const { id } = req.params;
    const list = await Attachment.findAll({ where: { task_id: id }, order: [['createdAt','DESC']] });
    res.json({ data: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.uploadForTask = async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });
    const created = [];
    for (const f of req.files) {
      const relPath = path.relative(path.join(__dirname, '..', '..', 'frontend'), f.path).replace(/\\/g, '/');
      const a = await Attachment.create({ task_id: id, filename: f.originalname, filepath: `/${relPath}`, mime: f.mimetype, size: f.size, uploaded_by: req.user ? req.user.user_id : null });
      created.push(a);
    }
    res.status(201).json({ data: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const { attachmentId } = req.params;
    const a = await Attachment.findByPk(attachmentId);
    if (!a) return res.status(404).json({ error: 'Attachment not found' });
    // only uploader or admin may delete
    if (req.user && req.user.role !== 'admin' && a.uploaded_by && a.uploaded_by !== req.user.user_id) return res.status(403).json({ error: 'Forbidden' });
    const absPath = path.join(__dirname, '..', '..', 'frontend', a.filepath);
    try { fs.unlinkSync(absPath); } catch (e) { /* ignore if missing */ }
    await a.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
