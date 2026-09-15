const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { verifyToken } = require('../middleware/authMiddleware');

router.use(verifyToken);

router.get('/stats', dashboardController.getStats);
router.get('/recent-movements', dashboardController.getRecentMovements);
router.get('/low-stock', dashboardController.getLowStock);
router.get('/movements-chart', dashboardController.getMovementsChart);

module.exports = router;
