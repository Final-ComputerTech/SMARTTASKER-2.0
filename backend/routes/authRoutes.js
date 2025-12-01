const express = require('express');
const router = express.Router();
const { register, login } = require('../controllers/authController');
const { getMe, updateMe } = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.get('/me', verifyToken(), getMe);
router.put('/me', verifyToken(), updateMe);

module.exports = router;
