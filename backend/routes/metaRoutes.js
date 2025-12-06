const express = require('express');
const router = express.Router();
const metaController = require('../controllers/metaController');
const { verifyToken } = require('../middleware/authMiddleware');

// Public read endpoints for client-side filters
router.get('/priorities', metaController.priorities);
router.get('/statuses', metaController.statuses);
// Create status (requires auth)
router.post('/statuses', verifyToken(), metaController.createStatus);

module.exports = router;
