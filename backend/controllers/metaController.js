const Priority = require('../models/Priority');
const Status = require('../models/Status');

exports.priorities = async (req, res) => {
  try {
    const list = await Priority.findAll({ order: [['level', 'ASC']] });
    // If DB is empty, return a small sensible default list so clients can render filters
    if (!list || list.length === 0) {
      const defaults = [
        { priority_id: 'low', label: 'Low', level: 1 },
        { priority_id: 'medium', label: 'Medium', level: 2 },
        { priority_id: 'high', label: 'High', level: 3 }
      ];
      return res.json(defaults);
    }
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.statuses = async (req, res) => {
  try {
    const list = await Status.findAll({ order: [['label', 'ASC']] });
    // Provide defaults for empty DB so UI filters work without requiring seeding
    if (!list || list.length === 0) {
      const defaults = [
        { status_id: 'todo', label: 'To Do' },
        { status_id: 'in_progress', label: 'In Progress' },
        { status_id: 'done', label: 'Done' }
      ];
      return res.json(defaults);
    }
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createStatus = async (req, res) => {
  try {
    const { label } = req.body;
    if (!label || !String(label).trim()) return res.status(400).json({ error: 'label is required' });
    const created = await Status.create({ label: String(label).trim() });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = exports;
