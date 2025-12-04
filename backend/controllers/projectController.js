const { Op } = require('sequelize');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Collaborator = require('../models/Collaborator');
const User = require('../models/User');
const perms = require('../utils/permissions');

exports.getProjects = async (req, res) => {
  try {
    // Admins see all projects
    if (req.user && req.user.role === 'admin') {
      const projects = await Project.findAll();
      // annotate admin view: admin has manager-level visibility
      const annotated = (projects || []).map(p => {
        const plain = p && p.toJSON ? p.toJSON() : p;
        plain.user_permission = 'manager';
        return plain;
      });
      return res.json(annotated);
    }
    // Non-admins: return projects the user owns or where they're a collaborator
    const userId = req.user ? req.user.user_id : null;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const collRows = await Collaborator.findAll({ where: { user_id: userId } });
    const collProjectIds = (collRows || []).map(c => c.project_id).filter(Boolean);
    const projects = await Project.findAll({ where: { [Op.or]: [{ owner_id: userId }, { project_id: { [Op.in]: collProjectIds.length ? collProjectIds : ['__none__'] } }] } });
    // annotate each project with the requesting user's permission for UI ('manager' if owner, 'member' if collaborator)
    const annotated = (projects || []).map(p => {
      const plain = p && p.toJSON ? p.toJSON() : p;
      if (plain.owner_id && String(plain.owner_id) === String(userId)) plain.user_permission = 'manager';
      else if (collProjectIds.includes(plain.project_id)) plain.user_permission = 'member';
      else plain.user_permission = '';
      return plain;
    });
    res.json(annotated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createProject = async (req, res) => {
  try {
    const { project_name, description, category_id, tasks } = req.body;
    // Owner assignment: default to requesting user. Only admin/manager may set owner to someone else.
    const requesterId = req.user ? req.user.user_id : null;
    if (!requesterId) return res.status(401).json({ error: 'Unauthorized' });
    let owner_id = req.body.owner_id;
    if (!owner_id) {
      owner_id = requesterId;
    } else {
      // If owner_id provided but requester is not privileged, disallow changing owner
      if (!(req.user && (req.user.role === 'admin' || req.user.role === 'manager'))) {
        owner_id = requesterId;
      }
    }

    // Run creation in a transaction: create project and optional tasks atomically
    const sequelize = require('../config/db');
    const created = await sequelize.transaction(async (tx) => {
      const project = await Project.create({ project_name, description, category_id, owner_id }, { transaction: tx });
      // ensure the owner appears in the collaborators table so they show up in project members
      try {
        await Collaborator.create({ project_id: project.project_id, user_id: owner_id, role: 'manager' }, { transaction: tx });
      } catch (e) {
        // ignore if already exists or not allowed
      }
      const createdTasks = [];
      if (Array.isArray(tasks) && tasks.length) {
        const Task = require('../models/Task');
        for (const t of tasks) {
          // each item can be a string (title) or object { title, description, due_date }
          const title = (typeof t === 'string') ? t : (t.title || '');
          if (!title) continue;
          const payload = {
            title,
            description: (typeof t === 'object' && t.description) ? t.description : null,
            project_id: project.project_id,
            priority_id: (typeof t === 'object' && t.priority_id) ? t.priority_id : null,
            status_id: (typeof t === 'object' && t.status_id) ? t.status_id : null,
            reminder_id: (typeof t === 'object' && t.reminder_id) ? t.reminder_id : null,
            user_id: requesterId
          };
          const createdTask = await Task.create(payload, { transaction: tx });
          // If a due_date is provided on the task object, create DueDate row
          if (typeof t === 'object' && t.due_date) {
            try {
              const DueDate = require('../models/DueDate');
              const due = await DueDate.create({ task_id: createdTask.task_id, due_date: t.due_date }, { transaction: tx });
              await createdTask.update({ due_date_id: due.due_date_id }, { transaction: tx });
            } catch (e) { /* ignore per-task due date errors */ }
          }
          createdTasks.push(createdTask);
        }
      }
      return { project, tasks: createdTasks };
    });

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await Project.findByPk(id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    // Access control: only owner, collaborators, or admin can view
    if (!(req.user && req.user.role === 'admin')) {
      const userId = req.user ? req.user.user_id : null;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const isOwner = project.owner_id && String(project.owner_id) === String(userId);
      const coll = await Collaborator.findOne({ where: { project_id: id, user_id: userId } });
      if (!isOwner && !coll) return res.status(403).json({ error: 'Forbidden' });
    }
    // load tasks belonging to the project with useful associations
    const TaskCollaborator = require('../models/TaskCollaborator');
    const DueDate = require('../models/DueDate');
    const Priority = require('../models/Priority');
    const Status = require('../models/Status');
    // Build includes defensively: only include TaskCollaborator if Task has an association to it
    const taskIncludes = [DueDate, Priority, Status];
    try {
      // Dev debug: print associations to help diagnose alias issues
      if (process.env.NODE_ENV !== 'production') {
        try { console.debug('projectController.getProjectById Task.associations:', Object.keys(Task.associations || {})); } catch (e) {}
      }
      let chosenAlias = null;
      if (Task && Task.associations) {
        for (const [k, a] of Object.entries(Task.associations)) {
          try {
            const targetName = a && a.target && (a.target.name || (a.target.options && a.target.options.name && a.target.options.name.singular));
            const asName = a && (a.as || (a.options && a.options.as));
            // prefer alias that references TaskCollaborator target
            if (targetName && String(targetName).toLowerCase().includes('taskcollabor')) {
              chosenAlias = asName || k;
              break;
            }
            if (asName && String(asName).toLowerCase().includes('taskcollabor')) {
              chosenAlias = asName;
              break;
            }
          } catch (e) {
            // continue
          }
        }
      }
      if (chosenAlias) {
        taskIncludes.push({ model: TaskCollaborator, as: chosenAlias });
      } else {
        // If we couldn't detect an alias, try adding model without alias and let Sequelize resolve it
        taskIncludes.push(TaskCollaborator);
      }
    } catch (e) {
      // ignore association check errors and proceed without TaskCollaborator
    }
    // Load tasks without relying on Sequelize's Task->TaskCollaborator include (avoids alias problems)
    let tasksRaw = [];
    try {
      // Remove TaskCollaborator from includes if present
      const includesNoTC = (taskIncludes || []).filter(i => {
        try {
          if (!i) return false;
          if (i.model && (i.model.name === 'TaskCollaborator' || (i.as && String(i.as).toLowerCase().includes('taskcollabor')))) return false;
          if (i === TaskCollaborator) return false;
        } catch (e) {}
        return true;
      });
      tasksRaw = await Task.findAll({ where: { project_id: id }, include: includesNoTC });
    } catch (e) {
      console.error('Failed to load tasks for project (initial):', e && e.stack ? e.stack : e);
      tasksRaw = [];
    }

    // Convert to plain objects and attach TaskCollaborators by querying them separately to avoid alias mismatch
    let tasks = (tasksRaw || []).map(t => (t && t.toJSON) ? t.toJSON() : t);
    try {
      const taskIds = tasks.map(t => t.task_id).filter(Boolean);
      if (taskIds.length) {
        const tcs = await TaskCollaborator.findAll({ where: { task_id: taskIds } });
        const byTask = {};
        (tcs || []).forEach(tc => {
          const plain = tc && tc.toJSON ? tc.toJSON() : tc;
          if (!byTask[plain.task_id]) byTask[plain.task_id] = [];
          byTask[plain.task_id].push(plain);
        });
        tasks = tasks.map(t => Object.assign({}, t, { TaskCollaborators: byTask[t.task_id] || [] }));
      } else {
        tasks = tasks.map(t => Object.assign({}, t, { TaskCollaborators: [] }));
      }
    } catch (e) {
      console.warn('Could not load TaskCollaborators separately:', e && e.message ? e.message : e);
      // ensure tasks still have the property to avoid frontend errors
      tasks = tasks.map(t => Object.assign({}, t, { TaskCollaborators: [] }));
    }
    // load collaborators (users) via Collaborator model if available
    let members = [];
    try {
      const Collaborator = require('../models/Collaborator');
      const User = require('../models/User');
      const cols = await Collaborator.findAll({ where: { project_id: id } });
      const userIds = (cols || []).map(c => c.user_id).filter(Boolean);
      let users = [];
      if (userIds.length) {
        users = await User.findAll({ where: { user_id: userIds } });
      }
      // Ensure project owner is included in members even if no collaborator row exists
      if (project.owner_id && !userIds.find(u => String(u) === String(project.owner_id))) {
        try {
          const ownerUser = await User.findByPk(project.owner_id);
          if (ownerUser) users.push(ownerUser);
          // also add a synthetic collaborator entry so role merge below can pick up 'manager'
          cols.push({ project_id: id, user_id: project.owner_id, role: 'manager' });
        } catch (e) {
          // ignore owner fetch failures
        }
      }
      // merge collaborator role into returned users for UI convenience
      members = (users || []).map(u => {
        const plain = u && u.toJSON ? u.toJSON() : u;
        const col = (cols || []).find(c => String(c.user_id) === String(plain.user_id));
        plain.user_permission = col && col.role ? col.role : (plain.user_id && project.owner_id && String(plain.user_id) === String(project.owner_id) ? 'manager' : 'member');
        return plain;
      });
    } catch (e) {
      // if collaborator model not present or join fails, return empty members
      console.warn('Could not load collaborators for project', e && e.message ? e.message : e);
      members = [];
    }
    // annotate members with permission: owner -> manager, others -> member
    try {
      members = (members || []).map(m => {
        const plain = m && m.toJSON ? m.toJSON() : m;
        plain.user_permission = (plain.user_id && project.owner_id && String(plain.user_id) === String(project.owner_id)) ? 'manager' : (plain.user_permission || 'member');
        return plain;
      });
      // Ensure owner is included (defensive): if owner_id exists but not in members, fetch and add
      try {
        const ownerIdStr = project.owner_id ? String(project.owner_id) : null;
        const hasOwner = members.find(m => String(m.user_id) === ownerIdStr);
        if (ownerIdStr && !hasOwner) {
          try {
            const Owner = require('../models/User');
            const ownerUser = await Owner.findByPk(project.owner_id);
            if (ownerUser) {
              const op = ownerUser && ownerUser.toJSON ? ownerUser.toJSON() : ownerUser;
              op.user_permission = 'manager';
              members.unshift(op);
            }
          } catch (e) { console.debug('Could not fetch owner user for members augmentation', e && e.message ? e.message : e); }
        }
      } catch (e) { /* ignore */ }
    } catch (e) { /* ignore */ }
    // annotate project with current user's permission for convenience
    let projectOut = project && project.toJSON ? project.toJSON() : project;
    try {
      const reqUserId = req.user && req.user.user_id ? String(req.user.user_id) : null;
      // log debug info to help troubleshoot missing owner/membership cases
      if (process.env.NODE_ENV !== 'production') {
        try {
          console.debug('projectController.getProjectById debug:', {
            reqUserId,
            reqUserRole: req.user && req.user.role,
            projectOwner: projectOut.owner_id,
            members: (members || []).map(m => ({ user_id: m.user_id, user_permission: m.user_permission }))
          });
        } catch (e) { /* ignore logging errors */ }
      }
      if (projectOut.owner_id && reqUserId && String(projectOut.owner_id) === reqUserId) projectOut.user_permission = 'manager';
      else if (Array.isArray(members) && members.find(m => String(m.user_id) === reqUserId)) {
        const found = members.find(m => String(m.user_id) === reqUserId);
        projectOut.user_permission = found && found.user_permission ? found.user_permission : 'member';
      } else projectOut.user_permission = '';
    } catch (e) { projectOut.user_permission = ''; }
    // Include `current_user` info so frontends don't have to decode JWTs.
    const current_user = req.user ? { user_id: req.user.user_id, role: req.user.role } : null;
    // If debug query flag is present, include a debug object to help diagnose membership/permission issues
    if (req.query && String(req.query.debug) === '1') {
      try {
        const dbg = {
          requestUser: req.user ? { user_id: req.user.user_id, role: req.user.role } : null,
          projectOwner: projectOut.owner_id || null,
          members: (members || []).map(m => ({ user_id: m.user_id, user_permission: m.user_permission }))
        };
        return res.json({ project: projectOut, tasks, members, _debug: dbg, current_user });
      } catch (e) {
        return res.json({ project: projectOut, tasks, members, current_user });
      }
    }
    res.json({ project: projectOut, tasks, members, current_user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await Project.findByPk(id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    // Authorization: allow admin, project owner, or project-level manager collaborators to update
    const reqUserId = req.user && req.user.user_id ? String(req.user.user_id) : null;
    if (!reqUserId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const allowed = await perms.isProjectManagerOrAdmin(req.user, id);
      if (!allowed) return res.status(403).json({ error: 'Forbidden' });
    } catch (e) { return res.status(500).json({ error: e && e.message ? e.message : 'Server error' }); }
    const updates = {};
    ['project_name','description','category_id','owner_id'].forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    await project.update(updates);
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await Project.findByPk(id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    // Only admin or owner can delete
    if (!(req.user && req.user.role === 'admin')) {
      const userId = req.user ? req.user.user_id : null;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const isOwner = project.owner_id && String(project.owner_id) === String(userId);
      if (!isOwner) return res.status(403).json({ error: 'Forbidden' });
    }
    await project.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Summary endpoint: returns total projects and tasks per project (basic)
exports.summary = async (req, res) => {
  try {
    // Respect access: admins see all, others see owned or collaborator projects
    let projects = [];
    if (req.user && req.user.role === 'admin') {
      projects = await Project.findAll();
    } else {
      const userId = req.user ? req.user.user_id : null;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const collRows = await Collaborator.findAll({ where: { user_id: userId } });
      const collProjectIds = (collRows || []).map(c => c.project_id).filter(Boolean);
      projects = await Project.findAll({ where: { [Op.or]: [{ owner_id: userId }, { project_id: { [Op.in]: collProjectIds.length ? collProjectIds : ['__none__'] } }] } });
    }
    const result = [];
    const reqUserId = req.user && req.user.user_id ? String(req.user.user_id) : null;
    for (const p of projects) {
      let taskCount = 0;
      if (req.user && req.user.role === 'admin') {
        taskCount = await Task.count({ where: { project_id: p.project_id } });
      } else {
        // For non-admins, count only tasks assigned to the requesting user within the project
        taskCount = await Task.count({ where: { project_id: p.project_id, user_id: reqUserId } });
      }
      result.push({ project_id: p.project_id, project_name: p.project_name, taskCount });
    }
    res.json({ totalProjects: projects.length, projects: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Add a collaborator to a project by user_id or email
exports.addCollaborator = async (req, res) => {
  try {
    const { id } = req.params; // project id
    const { user_id, email } = req.body;
    const project = await Project.findByPk(id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    let user = null;
    if (user_id) user = await User.findByPk(user_id);
    else if (email) user = await User.findOne({ where: { email: email.toLowerCase().trim() } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    // Authorization: only admin, owner, or project-level manager may add collaborators
    try {
      const allowed = await perms.isProjectManagerOrAdmin(req.user, id);
      if (!allowed) return res.status(403).json({ error: 'Forbidden' });
    } catch (e) { return res.status(500).json({ error: e && e.message ? e.message : 'Server error' }); }

    // avoid duplicates
    const exists = await Collaborator.findOne({ where: { project_id: id, user_id: user.user_id } });
    if (exists) {
      const perm = exists.role || ((user.user_id && project.owner_id && String(user.user_id) === String(project.owner_id)) ? 'manager' : 'member');
      return res.status(200).json({ message: 'Already a collaborator', user: Object.assign({}, user.toJSON ? user.toJSON() : user, { user_permission: perm }) });
    }
    // create collaborator with optional role (default member)
    const createRole = req.body.role && (req.body.role === 'manager') ? 'manager' : 'member';
    const coll = await Collaborator.create({ project_id: id, user_id: user.user_id, role: createRole });
    // compute and return permission for UI convenience
    const userPlain = user && user.toJSON ? user.toJSON() : user;
    userPlain.user_permission = createRole;
    res.status(201).json({ collaborator: coll, user: userPlain });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Remove a collaborator from a project
exports.removeCollaborator = async (req, res) => {
  try {
    const { id, userId } = req.params;
    const project = await Project.findByPk(id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    // Authorization: only admin, owner, or project-level manager may remove collaborators
    try {
      const allowed = await perms.isProjectManagerOrAdmin(req.user, id);
      if (!allowed) return res.status(403).json({ error: 'Forbidden' });
    } catch (e) { return res.status(500).json({ error: e && e.message ? e.message : 'Server error' }); }
    const coll = await Collaborator.findOne({ where: { project_id: id, user_id: userId } });
    if (!coll) return res.status(404).json({ error: 'Collaborator not found' });
    await coll.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update a collaborator's role (promote/demote)
exports.updateCollaborator = async (req, res) => {
  try {
    const { id, userId } = req.params;
    const { role } = req.body;
    if (!role || (role !== 'member' && role !== 'manager')) return res.status(400).json({ error: 'Invalid role' });
    const project = await Project.findByPk(id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Authorization: only admin, owner, or project-level manager may update collaborator roles
    const reqUserId = req.user && req.user.user_id ? String(req.user.user_id) : null;
    if (!reqUserId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const allowed = await perms.isProjectManagerOrAdmin(req.user, id);
      if (!allowed) return res.status(403).json({ error: 'Forbidden' });
    } catch (e) { return res.status(500).json({ error: e && e.message ? e.message : 'Server error' }); }

    // Prevent changing the project owner's role
    if (project.owner_id && String(project.owner_id) === String(userId)) {
      return res.status(400).json({ error: 'Cannot change project owner role' });
    }

    const coll = await Collaborator.findOne({ where: { project_id: id, user_id: userId } });
    if (!coll) return res.status(404).json({ error: 'Collaborator not found' });
    await coll.update({ role });

    // Return updated user info with permission for convenience
    const user = await User.findByPk(userId);
    const userPlain = user && user.toJSON ? user.toJSON() : user;
    userPlain.user_permission = role;
    res.json({ collaborator: coll, user: userPlain });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
