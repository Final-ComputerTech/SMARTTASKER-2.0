const express = require('express');
const router = express.Router();

const taskController = require('../controllers/taskController');
const conversationController = require('../controllers/conversationController');
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
router.get('/:id/changes', verifyToken(), taskController.getTaskChanges);
// Conversations (comments) for tasks
router.get('/:id/conversations', verifyToken(), conversationController.listForTask);
router.post('/:id/conversations', verifyToken(), conversationController.createForTask);
router.delete('/conversations/:conversationId', verifyToken(), conversationController.delete);
// task assignment endpoints
router.post('/:id/assign', verifyToken(), taskController.assignUserToTask);
router.delete('/:id/assign/:userId', verifyToken(), taskController.unassignUserFromTask);
// Reminders endpoints
const reminderController = require('../controllers/reminderController');
router.get('/:id/reminders', verifyToken(), reminderController.listForTask);
router.post('/:id/reminders', verifyToken(), reminderController.createForTask);
router.delete('/reminders/:reminderId', verifyToken(), reminderController.delete);

// Attachments
const multer = require('multer');
const path = require('path');
const uploadsDir = path.join(__dirname, '..', '..', 'frontend', 'assets', 'img', 'uploads');
const storage = multer.diskStorage({ destination: uploadsDir, filename: (req, file, cb) => { const uniq = Date.now() + '-' + Math.round(Math.random()*1e9); cb(null, uniq + '-' + file.originalname); } });
const upload = multer({ storage });
const attachmentController = require('../controllers/attachmentController');
router.get('/:id/attachments', verifyToken(), attachmentController.listForTask);
router.post('/:id/attachments', verifyToken(), upload.array('attachments'), attachmentController.uploadForTask);
router.delete('/attachments/:attachmentId', verifyToken(), attachmentController.delete);
router.put('/:id', verifyToken(), updateTaskRules, handleValidation, taskController.updateTask);
router.delete('/:id', verifyToken(), taskController.deleteTask);

module.exports = router;
