const express = require('express');
const router = express.Router();
const metaController = require('../controllers/metaController');
const { verifyToken } = require('../middleware/authMiddleware');

router.get('/priorities', verifyToken(), metaController.priorities);
router.get('/statuses', verifyToken(), metaController.statuses);

module.exports = router;
