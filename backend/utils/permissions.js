const Project = require('../models/Project');
const Collaborator = require('../models/Collaborator');

async function isAdmin(user) {
  try {
    return !!(user && user.role && String(user.role) === 'admin');
  } catch (e) { return false; }
}

// Returns true if the given userId is project owner
async function isProjectOwner(user, projectId) {
  try {
    if (!user || !user.user_id) return false;
    const p = await Project.findByPk(projectId);
    if (!p) return false;
    return p.owner_id && String(p.owner_id) === String(user.user_id);
  } catch (e) { return false; }
}

// Returns true if user is a project-level manager (owner OR collaborator.role === 'manager')
async function isProjectManagerOrAdmin(user, projectId) {
  try {
    if (!user || !user.user_id) return false;
    if (await isAdmin(user)) return true;
    const userId = String(user.user_id);
    const p = await Project.findByPk(projectId);
    if (!p) return false;
    if (p.owner_id && String(p.owner_id) === userId) return true;
    const coll = await Collaborator.findOne({ where: { project_id: projectId, user_id: userId } });
    if (coll && coll.role === 'manager') return true;
    return false;
  } catch (e) { return false; }
}

// Returns true if user is a participant in the project (owner OR any collaborator)
async function isProjectParticipant(user, projectId) {
  try {
    if (!user || !user.user_id) return false;
    const userId = String(user.user_id);
    const p = await Project.findByPk(projectId);
    if (!p) return false;
    if (p.owner_id && String(p.owner_id) === userId) return true;
    const coll = await Collaborator.findOne({ where: { project_id: projectId, user_id: userId } });
    if (coll) return true;
    return false;
  } catch (e) { return false; }
}

module.exports = {
  isAdmin,
  isProjectOwner,
  isProjectManagerOrAdmin
  , isProjectParticipant
};
