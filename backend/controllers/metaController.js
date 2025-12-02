const Priority = require('../models/Priority');
const Status = require('../models/Status');

exports.priorities = async (req, res) => {
  try {
    const list = await Priority.findAll({ order: [['level', 'ASC']] });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.statuses = async (req, res) => {
  try {
    const list = await Status.findAll({ order: [['label', 'ASC']] });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = exports;
