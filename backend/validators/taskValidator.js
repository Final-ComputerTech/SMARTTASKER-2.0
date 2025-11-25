// validators/taskValidator.js
const { body, param, query } = require('express-validator');

exports.createTaskRules = [
  body('title').notEmpty().withMessage('Title is required').isLength({ max: 255 }),
  body('project_id').optional().isUUID().withMessage('project_id must be UUID'),
  body('due_date').optional().isISO8601().toDate(),
  body('reminder_at').optional().isISO8601().toDate(),
  // collaborators: optional array of UUIDs
  body('collaborators').optional().isArray(),
];

exports.updateTaskRules = [
  body('title').optional().isLength({ max: 255 }),
  body('due_date').optional().isISO8601().toDate(),
  body('reminder_at').optional().isISO8601().toDate(),
  body('collaborators').optional().isArray(),
];

exports.getTasksRules = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1 }).toInt()
];