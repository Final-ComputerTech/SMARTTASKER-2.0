const Task = require('../models/Task');
const User = require('../models/User');
const Project = require('../models/Project');
const Priority = require('../models/Priority');
const Status = require('../models/Status');
const DueDate = require('../models/DueDate');
const Reminder = require('../models/Reminder');
const Changes = require('../models/Changes');
const Notification = require('../models/Notification');

exports.createTask = async (req, res) => {
  try {
    const payload = {
      title: req.body.title,
      description: req.body.description || null,
      project_id: req.body.project_id || null,
      priority_id: req.body.priority_id || null,
      status_id: req.body.status_id || null,
      reminder_id: req.body.reminder_id || null,
      user_id: req.user.user_id
    };
    const task = await Task.create(payload);
    // Log creation
    try {
      await Changes.create({ task_id: task.task_id, user_id: req.user.user_id, field: 'created', old_value: null, new_value: task.title });
    } catch (e) { console.warn('Could not log create change', e.message || e); }
    // Notification for creator
    try {
      await Notification.create({ user_id: req.user.user_id, task_id: task.task_id, message: `Task \"${task.title}\" created.` });
    } catch (e) { console.warn('Could not create notification', e.message || e); }

    // If a due_date was provided, create a DueDate row and link it
    if (req.body.due_date) {
      try {
        const due = await DueDate.create({ task_id: task.task_id, due_date: req.body.due_date });
        try {
          await task.update({ due_date_id: due.due_date_id });
        } catch (e) { console.warn('Could not update task with due_date_id', e.message || e); }
        try {
          await Changes.create({ task_id: task.task_id, user_id: req.user.user_id, field: 'due_date', old_value: null, new_value: String(req.body.due_date) });
        } catch (e) { console.warn('Could not log due_date change', e.message || e); }
        // Notification for due date
        try {
          await Notification.create({ user_id: req.user.user_id, task_id: task.task_id, message: `Due date set for task \"${task.title}\": ${String(req.body.due_date)}` });
        } catch (e) { console.warn('Could not create due date notification', e.message || e); }
      } catch (e) {
        console.warn('Could not create due date', e.message || e);
      }
    }

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
    const trackedFields = ['title', 'description', 'project_id', 'priority_id', 'status_id', 'due_date_id', 'reminder_id'];
    const updates = {};
    trackedFields.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    // Prepare change entries
    const changeEntries = [];
    for (const k of Object.keys(updates)) {
      const oldVal = task[k] === undefined || task[k] === null ? null : String(task[k]);
      const newVal = updates[k] === undefined || updates[k] === null ? null : String(updates[k]);
      if (oldVal !== newVal) changeEntries.push({ task_id: id, user_id: req.user.user_id, field: k, old_value: oldVal, new_value: newVal });
    }
    await task.update(updates);
    // Save change entries
    try { for (const ce of changeEntries) await Changes.create(ce); } catch (e) { console.warn('Could not write change entries', e.message || e); }
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
    try { await Changes.create({ task_id: id, user_id: req.user.user_id, field: 'deleted', old_value: task.title || null, new_value: null }); } catch (e) { console.warn('Could not log delete change', e.message || e); }
    await task.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getTaskChanges = async (req, res) => {
  try {
    const { id } = req.params;
    const changes = await Changes.findAll({ where: { task_id: id }, order: [['createdAt', 'DESC']] });
    res.json({ data: changes });
  } catch (err) {
    console.error('taskController.getTaskChanges error', err);
    res.status(500).json({ error: err.message });
  }
};
