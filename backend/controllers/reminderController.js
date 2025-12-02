const Reminder = require('../models/Reminder');

exports.listForTask = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[debug] reminderController.listForTask called for task_id=${id} by user=${req.user ? req.user.user_id : 'anon'}`);
    const reminders = await Reminder.findAll({ where: { task_id: id }, order: [['reminder_at', 'ASC']] });
    res.json({ data: reminders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createForTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { reminder_at, method } = req.body;
    if (!reminder_at) return res.status(400).json({ error: 'reminder_at is required' });
    const r = await Reminder.create({ task_id: id, reminder_at, method: method || 'email' });
    res.status(201).json(r);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const { reminderId } = req.params;
    const r = await Reminder.findByPk(reminderId);
    if (!r) return res.status(404).json({ error: 'Reminder not found' });
    await r.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
