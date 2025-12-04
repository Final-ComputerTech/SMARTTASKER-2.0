const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { verifyToken } = require('../middleware/authMiddleware');
const { createProjectRules, updateProjectRules } = require('../validators/projectValidator');

router.get('/', verifyToken(), projectController.getProjects);
router.get('/summary', verifyToken(), projectController.summary);
// Allow any authenticated user to create a project; controller enforces owner assignment rules
router.post('/', verifyToken(), createProjectRules, projectController.createProject);
router.post('/:id/collaborators', verifyToken(), projectController.addCollaborator);
router.delete('/:id/collaborators/:userId', verifyToken(), projectController.removeCollaborator);
router.put('/:id/collaborators/:userId', verifyToken(), projectController.updateCollaborator);
router.get('/:id', verifyToken(), projectController.getProjectById);
// Allow any authenticated user to reach the controller; controller enforces project-level permissions
router.put('/:id', verifyToken(), updateProjectRules, projectController.updateProject);
router.delete('/:id', verifyToken(['admin']), projectController.deleteProject);

module.exports = router;