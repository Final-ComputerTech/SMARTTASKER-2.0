const express = require('express');
const router = express.Router();

const taskController = require('../controllers/taskController');
const { verifyToken } = require('../middleware/authMiddleware');
const { createTaskRules, updateTaskRules, getTasksRules } = require('../validators/taskValidator');
const { validationResult } = require('express-validator');

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

router.get('/', verifyToken(), getTasksRules, handleValidation, taskController.getTask);
router.post('/', verifyToken(), createTaskRules, handleValidation, taskController.createTask);
router.get('/:id', verifyToken(), taskController.getTaskById);
router.put('/:id', verifyToken(), updateTaskRules, handleValidation, taskController.updateTask);
router.delete('/:id', verifyToken(), taskController.deleteTask);

module.exports = router;
