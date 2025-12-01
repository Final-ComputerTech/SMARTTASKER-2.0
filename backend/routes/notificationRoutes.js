const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { verifyToken } = require('../middleware/authMiddleware');

router.get('/', verifyToken(), notificationController.listNotifications);
router.put('/:id/read', verifyToken(), notificationController.markAsRead);
router.put('/mark-all', verifyToken(), notificationController.markAllRead);

module.exports = router;
