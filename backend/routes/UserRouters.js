const express = require('express');
const router = express.Router();
const userController = require('../controllers/UserController');
const { verifyToken } = require('../middleware/authMiddleware');

// Allow managers to create users (they will be restricted from creating admin/manager accounts)
router.post('/', verifyToken(['admin','manager']), userController.create);
// DEV-ONLY: temporarily disable admin-only check to help debug browser UI issues.
// Uncomment the verifyToken middleware in production.
router.get('/', /* verifyToken(['admin']), */ userController.getAll);
router.get('/stats', verifyToken(['admin']), userController.stats);
router.get('/:id', verifyToken(['admin','manager','member']), userController.getById);
router.put('/:id', verifyToken(['admin','manager','member']), userController.update);
// Allow managers to perform role changes and suspensions as well as admins.
// Keep delete and other destructive operations admin-only.
router.post('/:id/role', verifyToken(['admin','manager']), userController.setRole);
router.post('/:id/suspend', verifyToken(['admin','manager']), userController.suspend);
// Only admins may generate temporary passwords.
router.post('/:id/generate-temp', verifyToken(['admin']), userController.generateTemp);
// Allow managers to delete non-admin/member users and view logs for members.
router.delete('/:id', verifyToken(['admin','manager']), userController.remove);
// Support both `/users/:id/logs` and `/users/logs/:id` to avoid client-side routing issues
router.get('/:id/logs', verifyToken(['admin','manager']), userController.logs);
router.get('/logs/:id', verifyToken(['admin','manager']), userController.logs);

module.exports = router;
