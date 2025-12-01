const Task = require('../models/Task');
const User = require('../models/User');
const Project = require('../models/Project');
const Priority = require('../models/Priority');
const Status = require('../models/Status');
const DueDate = require('../models/DueDate');
const Reminder = require('../models/Reminder');

exports.createTask = async (req, res) => {
  try {
    const payload = {
      title: req.body.title,
      description: req.body.description || null,
      project_id: req.body.project_id || null,
      priority_id: req.body.priority_id || null,
      status_id: req.body.status_id || null,
      due_date_id: req.body.due_date_id || null,
      reminder_id: req.body.reminder_id || null,
      user_id: req.user.user_id
    };
    const task = await Task.create(payload);
    const taskWithIncludes = await Task.findByPk(task.task_id, { include: [User, Project, Priority, Status, DueDate, Reminder] });
    res.status(201).json(taskWithIncludes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getTask = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const where = {};
    // non-admin users see only their tasks
    if (req.user.role !== 'admin') where.user_id = req.user.user_id;
    const { count, rows } = await Task.findAndCountAll({ where, include: [User, Project, Priority, Status, DueDate, Reminder], limit: parseInt(limit, 10), offset });
    res.json({ total: count, page: parseInt(page, 10), pageSize: rows.length, tasks: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getTaskById = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findByPk(id, { include: [User, Project, Priority, Status, DueDate, Reminder] });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (req.user.role !== 'admin' && task.user_id !== req.user.user_id) return res.status(403).json({ error: 'Forbidden' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findByPk(id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (req.user.role !== 'admin' && task.user_id !== req.user.user_id) return res.status(403).json({ error: 'Forbidden' });
    const updates = {};
    ['title', 'description', 'project_id', 'priority_id', 'status_id', 'due_date_id', 'reminder_id'].forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    await task.update(updates);
    const updated = await Task.findByPk(id, { include: [User, Project, Priority, Status, DueDate, Reminder] });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findByPk(id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (req.user.role !== 'admin' && task.user_id !== req.user.user_id) return res.status(403).json({ error: 'Forbidden' });
    await task.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
