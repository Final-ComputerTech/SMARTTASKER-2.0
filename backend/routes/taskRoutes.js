const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { verifyToken } = require('../middleware/authMiddleware');
const { createTaskRules } = require('../validators/taskValidator');
const { validationResult } = require('express-validator');

const handleValidation = (req, res, next) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
	next();
};

router.get('/', verifyToken(), taskController.getTask);
router.post('/', verifyToken(), createTaskRules, handleValidation, taskController.createTask);

module.exports = router;
