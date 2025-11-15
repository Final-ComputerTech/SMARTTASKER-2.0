const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

router.get('/', notificationController.listNotifications);
router.put('/:id/read', notificationController.markAsRead);

module.exports = router;
