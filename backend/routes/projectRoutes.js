const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { verifyToken } = require('../middleware/authMiddleware');
const { createProjectRules, updateProjectRules } = require('../validators/projectValidator');

router.get('/', verifyToken(), projectController.getProjects);
router.get('/summary', verifyToken(), projectController.summary);
router.post('/', verifyToken(['admin','manager']), createProjectRules, projectController.createProject);
router.get('/:id', verifyToken(), projectController.getProjectById);
router.put('/:id', verifyToken(['admin','manager']), updateProjectRules, projectController.updateProject);
router.delete('/:id', verifyToken(['admin']), projectController.deleteProject);

module.exports = router;