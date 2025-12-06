const express = require('express');
const router = express.Router();
const userController = require('../controllers/UserController');
const { verifyToken } = require('../middleware/authMiddleware');

router.post('/', verifyToken(['admin']), userController.create);
// DEV-ONLY: temporarily disable admin-only check to help debug browser UI issues.
// Uncomment the verifyToken middleware in production.
router.get('/', /* verifyToken(['admin']), */ userController.getAll);
router.get('/stats', verifyToken(['admin']), userController.stats);
router.get('/:id', verifyToken(['admin','manager','member']), userController.getById);
router.put('/:id', verifyToken(['admin','manager','member']), userController.update);
router.post('/:id/role', verifyToken(['admin']), userController.setRole);
router.post('/:id/suspend', verifyToken(['admin']), userController.suspend);
router.post('/:id/generate-temp', verifyToken(['admin']), userController.generateTemp);
router.delete('/:id', verifyToken(['admin']), userController.remove);
// Support both `/users/:id/logs` and `/users/logs/:id` to avoid client-side routing issues
router.get('/:id/logs', verifyToken(['admin']), userController.logs);
router.get('/logs/:id', verifyToken(['admin']), userController.logs);

module.exports = router;
