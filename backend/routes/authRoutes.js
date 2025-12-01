const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { register, login, getMe, updateMe, changePassword, uploadAvatar } = authController;
const { deleteMe } = authController;
const { verifyToken } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ensure uploads dir and configure multer storage
const uploadsDir = path.join(__dirname, '..', '..', 'frontend', 'assets', 'img', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const storage = multer.diskStorage({
	destination: function (req, file, cb) { cb(null, uploadsDir); },
	filename: function (req, file, cb) {
		const safe = `${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
		cb(null, safe);
	}
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

router.post('/register', register);
router.post('/login', login);
router.get('/me', verifyToken(), getMe);
router.put('/me', verifyToken(), updateMe);
router.put('/change-password', verifyToken(), changePassword);
// Accept multipart/form-data POST for avatar (file field 'avatar')
router.post('/me/avatar', verifyToken(), upload.single('avatar'), uploadAvatar);
// Keep PUT for backward compatibility with older frontends
router.put('/me/avatar', verifyToken(), upload.single('avatar'), uploadAvatar);
router.delete('/me', verifyToken(), deleteMe);

module.exports = router;
