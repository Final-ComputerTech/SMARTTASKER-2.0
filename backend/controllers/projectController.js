const Project = require('../models/Project');
const Task = require('../models/Task');
const Collaborator = require('../models/Collaborator');
const User = require('../models/User');

exports.getProjects = async (req, res) => {
  try {
    const projects = await Project.findAll();
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createProject = async (req, res) => {
  try {
    const { project_name, description, category_id, owner_id } = req.body;
    const project = await Project.create({ project_name, description, category_id, owner_id });
    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await Project.findByPk(id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    // load tasks belonging to the project with useful associations
    const TaskCollaborator = require('../models/TaskCollaborator');
    const DueDate = require('../models/DueDate');
    const Priority = require('../models/Priority');
    const Status = require('../models/Status');
    const tasks = await Task.findAll({ where: { project_id: id }, include: [DueDate, Priority, Status, TaskCollaborator] });
    // load collaborators (users) via Collaborator model if available
    let members = [];
    try {
      const Collaborator = require('../models/Collaborator');
      const User = require('../models/User');
      const cols = await Collaborator.findAll({ where: { project_id: id } });
      const userIds = (cols || []).map(c => c.user_id).filter(Boolean);
      if (userIds.length) {
        members = await User.findAll({ where: { user_id: userIds } });
      }
    } catch (e) {
      // if collaborator model not present or join fails, return empty members
      console.warn('Could not load collaborators for project', e && e.message ? e.message : e);
      members = [];
    }
    res.json({ project, tasks, members });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await Project.findByPk(id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
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
    await project.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Summary endpoint: returns total projects and tasks per project (basic)
exports.summary = async (req, res) => {
  try {
    const projects = await Project.findAll();
    const result = [];
    for (const p of projects) {
      const taskCount = await Task.count({ where: { project_id: p.project_id } });
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
    // avoid duplicates
    const exists = await Collaborator.findOne({ where: { project_id: id, user_id: user.user_id } });
    if (exists) return res.status(200).json({ message: 'Already a collaborator', user });
    const coll = await Collaborator.create({ project_id: id, user_id: user.user_id });
    res.status(201).json({ collaborator: coll, user });
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
    const coll = await Collaborator.findOne({ where: { project_id: id, user_id: userId } });
    if (!coll) return res.status(404).json({ error: 'Collaborator not found' });
    await coll.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
