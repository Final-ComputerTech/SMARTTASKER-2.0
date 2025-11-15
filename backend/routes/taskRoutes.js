const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');

router.get('/', taskController.getTask);
router.post('/', taskController.createTask);

module.exports = router;
