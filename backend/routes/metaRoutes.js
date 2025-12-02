const express = require('express');
const router = express.Router();
const metaController = require('../controllers/metaController');
const { verifyToken } = require('../middleware/authMiddleware');

router.get('/priorities', verifyToken(), metaController.priorities);
router.get('/statuses', verifyToken(), metaController.statuses);
// Create status (any authenticated user)
router.post('/statuses', verifyToken(), metaController.createStatus);

module.exports = router;
