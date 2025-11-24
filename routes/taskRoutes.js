const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { verifyToken } = require('../middleware/authMiddleware');

router.get('/', verifyToken(), taskController.getTask);
router.post('/', verifyToken(), taskController.createTask);

module.exports = router;
