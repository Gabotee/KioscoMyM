const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');

// POST /api/auth/login
router.post('/login', authController.login);

// GET /api/auth/verify (protegida)
router.get('/verify', verifyToken, authController.verifyToken);

// PUT /api/auth/change-password (protegida)
router.put('/change-password', verifyToken, authController.changePassword);

module.exports = router;
