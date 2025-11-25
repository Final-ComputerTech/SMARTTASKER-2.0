// validators/projectValidator.js
const { body, query } = require('express-validator');

exports.createProjectRules = [
  body('project_name').notEmpty().withMessage('Project name required'),
  body('category_id').optional().isUUID()
];

exports.updateProjectRules = [
  body('project_name').optional().isLength({ max: 255 })
];

exports.getProjectsRules = [
  query('page').optional().isInt({ min: 1 }).toInt()
];