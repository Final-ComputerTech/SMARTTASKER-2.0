const Task = require('../models/Task');
const User = require('../models/User');
const Project = require('../models/Project');
const Priority = require('../models/Priority');
const Status = require('../models/Status');
const DueDate = require('../models/DueDate');
const Reminder = require('../models/Reminder');
const Attachment = require('../models/Attachment');
const Changes = require('../models/Changes');
const Notification = require('../models/Notification');
const { Op } = require('sequelize');
const TaskCollaborator = require('../models/TaskCollaborator');

// Helper: normalize include entries so Sequelize always receives objects of form { model, as?, where?, required? }
function normalizeIncludes(arr) {
  if (!Array.isArray(arr)) return arr;
  return arr.map(i => {
    try {
      // If it's already an include object with a model, ensure Attachment has the alias
      if (i && typeof i === 'object' && i.model) {
        if (i.model === Attachment && !i.as) return Object.assign({}, i, { as: 'Attachments' });
        return i;
      }
      // If the entry is a bare model (function/object), wrap it
      if (i === Attachment) return { model: Attachment, as: 'Attachments' };
      if (i) return { model: i };
      return i;
    } catch (e) {
      return i;
    }
  }).filter(Boolean);
}

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

    const taskWithIncludes = await Task.findByPk(task.task_id, { include: [User, Project, Priority, Status, DueDate, Reminder, { model: Attachment, as: 'Attachments' }] });
    res.status(201).json(taskWithIncludes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getTask = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, priority, status, project, from, to, mine, attachments, overdue, sort_by, order, type } = req.query;
    const offset = (page - 1) * limit;
    const where = {};

    // default access: non-admin users see only their tasks
    if (req.user.role !== 'admin') where.user_id = req.user.user_id;
    // explicit "mine" filter (overrides admin view)
    if (mine === 'true' || mine === '1') where.user_id = req.user.user_id;

    // simple equality filters
    if (priority) where.priority_id = priority;
    if (status) where.status_id = status;
    if (project) where.project_id = project;
    // filter by task type: 'project' (assigned to project) or 'reminder' (standalone reminder tasks)
    // by default, return all types
    if (type === 'project') {
      where.project_id = { [Op.ne]: null };
    } else if (type === 'reminder' || type === 'single') {
      // require tasks that have a reminder row or reminder_id set
      // We'll later mark the Reminder include as required to ensure only tasks with reminders are returned
      // mark a flag for include handling below
      req._requireReminder = true;
    }

    // text search (title or description)
    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    // Build includes dynamically so we can add where clauses for DueDate/Attachment if needed
    // Build includes and allow making Reminder include required when filtering by type
    const includes = [User, Project, Priority, Status];
    // add Reminder include, possibly required if type filter asked for reminders only
    if (req._requireReminder) includes.push({ model: Reminder, required: true }); else includes.push(Reminder);
    // due date filters (from/to are expected to be ISO date strings)
    const dueWhere = {};
    if (from) dueWhere.due_date = { ...(dueWhere.due_date || {}), [Op.gte]: new Date(from) };
    if (to) dueWhere.due_date = { ...(dueWhere.due_date || {}), [Op.lte]: new Date(to) };
    if (overdue === 'true' || overdue === '1') {
      dueWhere.due_date = { ...(dueWhere.due_date || {}), [Op.lt]: new Date() };
    }
    if (Object.keys(dueWhere).length > 0) {
      includes.push({ model: DueDate, where: dueWhere, required: overdue === 'true' || overdue === '1' });
    } else {
      includes.push(DueDate);
    }

    // attachments filter: require tasks that have at least one attachment
    if (attachments === 'true' || attachments === '1') {
      includes.push({ model: Attachment, as: 'Attachments', required: true });
    } else {
      includes.push({ model: Attachment, as: 'Attachments' });
    }

    // sorting: map known frontend sort keys to actual columns (including associations)
    let orderArr = [['createdAt', 'DESC']];
    if (sort_by) {
      const dir = (order && order.toUpperCase() === 'ASC') ? 'ASC' : 'DESC';
      switch (sort_by) {
        case 'title': orderArr = [['title', dir]]; break;
        case 'project': orderArr = [[{ model: Project }, 'project_name', dir]]; break;
        case 'priority': orderArr = [[{ model: Priority }, 'label', dir]]; break;
        case 'status': orderArr = [[{ model: Status }, 'label', dir]]; break;
        case 'due':
          // Order by due date. Use a lightweight subquery to avoid depending on the
          // include alias that Sequelize may generate for the DueDate association.
          // Use the actual table name from the DueDate model (e.g. 'due_dates') and
          // quote it to avoid identifier/quoting issues across environments.
          try {
            // Use the explicit table name defined in the DueDate model to avoid
            // any surprises coming from getTableName() returning schema-qualified objects.
            const dueTableName = 'due_dates';
            orderArr = [[Task.sequelize.literal(`(SELECT due_date FROM ${dueTableName} WHERE ${dueTableName}.task_id = Task.task_id LIMIT 1)`), dir]];
          } catch (e) {
            // fallback to association ordering if literal isn't available
            orderArr = [[{ model: DueDate }, 'due_date', dir]];
          }
          break;
        case 'updated': orderArr = [['updatedAt', dir]]; break;
        default: orderArr = [[sort_by, dir]]; break;
      }
    }

    // Diagnostic: log includes shape to help debug alias errors
    try {
      console.debug('taskController.getTask includes:', includes.map(i => ({ model: i.model ? i.model.name || i.model.toString() : (i.name || i), as: i.as || null, required: i.required || false })));
    } catch (e) { console.debug('Could not stringify includes', e); }

    // Defensive: normalize includes so that Attachment is always included with the correct alias
      const normalizedIncludes = normalizeIncludes(includes);

    const { count, rows } = await Task.findAndCountAll({ where, include: normalizedIncludes, limit: parseInt(limit, 10), offset, order: orderArr });
    // Annotate tasks with a computed `task_type` so frontend can easily split views
    const annotated = (rows || []).map(r => {
      const t = r.toJSON ? r.toJSON() : r;
      let task_type = 'standalone';
      if (t.project_id) task_type = 'project';
      else if (t.Reminder || t.reminder_id) task_type = 'reminder';
      return Object.assign({}, t, { task_type });
    });
    res.json({ total: count, page: parseInt(page, 10), pageSize: annotated.length, tasks: annotated });
  } catch (err) {
    console.error('taskController.getTask error', err && err.stack ? err.stack : err);
    // expose error message for frontend, but include a hint to check server logs for details
    res.status(500).json({ error: (err && err.message) ? err.message : 'Server error' });
  }
};

exports.getTaskById = async (req, res) => {
  try {
    const { id } = req.params;
      const task = await Task.findByPk(id, { include: normalizeIncludes([User, Project, Priority, Status, DueDate, Reminder]) });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (req.user.role !== 'admin' && task.user_id !== req.user.user_id) return res.status(403).json({ error: 'Forbidden' });
    // attach task_type for convenience
    const t = task.toJSON ? task.toJSON() : task;
    let task_type = 'standalone';
    if (t.project_id) task_type = 'project';
    else if (t.Reminder || t.reminder_id) task_type = 'reminder';
    res.json(Object.assign({}, t, { task_type }));
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
      const updated = await Task.findByPk(id, { include: normalizeIncludes([User, Project, Priority, Status, DueDate, Reminder, { model: Attachment, as: 'Attachments' }]) });
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

// Assign a user to a task (many-to-many)
exports.assignUserToTask = async (req, res) => {
  try {
    const { id } = req.params; // task id
    const { user_id } = req.body;
    const task = await Task.findByPk(id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    // permissions: allow admins or owner
    if (req.user.role !== 'admin' && task.user_id !== req.user.user_id) return res.status(403).json({ error: 'Forbidden' });
    // avoid duplicates
    const exists = await TaskCollaborator.findOne({ where: { task_id: id, user_id } });
    if (exists) return res.status(200).json({ message: 'Already assigned' });
    const rec = await TaskCollaborator.create({ task_id: id, user_id });
    res.status(201).json({ assigned: rec });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Unassign a user from a task
exports.unassignUserFromTask = async (req, res) => {
  try {
    const { id, userId } = req.params; // task id, user id
    const task = await Task.findByPk(id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (req.user.role !== 'admin' && task.user_id !== req.user.user_id) return res.status(403).json({ error: 'Forbidden' });
    const rec = await TaskCollaborator.findOne({ where: { task_id: id, user_id: userId } });
    if (!rec) return res.status(404).json({ error: 'Assignment not found' });
    await rec.destroy();
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
