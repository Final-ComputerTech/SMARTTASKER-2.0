const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken } = require('../middleware/authMiddleware');

router.post('/', verifyToken(['Admin']), userController.create);
router.get('/', verifyToken(['Admin']), userController.getAll);
router.get('/:id', verifyToken(['Admin','Manager','Member']), userController.getById);
router.put('/:id', verifyToken(['Admin','Manager','Member']), userController.update);

module.exports = router;
