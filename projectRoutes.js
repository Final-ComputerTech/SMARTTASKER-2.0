const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { verifyToken } = require('../middleware/authMiddleware');
const { createProjectRules, updateProjectRules } = require('../validators/projectValidator');

router.get('/', verifyToken(), projectController.getProjects);
router.post('/', verifyToken(['Admin','Manager']), createProjectRules, projectController.createProject);
router.get('/:id', verifyToken(), projectController.getProjectById);
router.put('/:id', verifyToken(['Admin','Manager']), updateProjectRules, projectController.updateProject);
router.delete('/:id', verifyToken(['Admin']), projectController.deleteProject);

module.exports = router;
