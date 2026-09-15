const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const { verifyToken } = require('../middleware/authMiddleware');

// Proteger todas las rutas de ventas
router.use(verifyToken);

router.post('/', salesController.createSale);

module.exports = router;
