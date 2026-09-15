const express = require('express');
const router = express.Router();
const productsController = require('../controllers/productsController');
const { verifyToken } = require('../middleware/authMiddleware');

// Todas las rutas de productos requieren autenticación
router.use(verifyToken);

router.get('/', productsController.getAll);
router.get('/categories', productsController.getCategories);
router.get('/barcode/:barcode', productsController.getByBarcode);
router.get('/:id', productsController.getById);
router.post('/', productsController.create);
router.put('/:id', productsController.update);
router.delete('/:id', productsController.remove);

module.exports = router;
