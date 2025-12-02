const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const dashboardController = require('../controllers/dashboardControllerV2');

router.get('/summary', verifyToken(), dashboardController.summary);

module.exports = router;
