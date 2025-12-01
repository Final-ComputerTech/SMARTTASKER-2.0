const Project = require('../models/Project');
const Task = require('../models/Task');

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
    res.json(project);
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
