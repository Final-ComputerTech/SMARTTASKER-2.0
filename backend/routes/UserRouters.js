const express = require('express');
const router = express.Router();
const userController = require('../controllers/UserController');
const { verifyToken } = require('../middleware/authMiddleware');

router.post('/', verifyToken(['admin']), userController.create);
router.get('/', verifyToken(['admin']), userController.getAll);
router.get('/:id', verifyToken(['admin','manager','member']), userController.getById);
router.put('/:id', verifyToken(['admin','manager','member']), userController.update);

module.exports = router;
