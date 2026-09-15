const express = require('express');
const router = express.Router();
const movementsController = require('../controllers/movementsController');
const { verifyToken } = require('../middleware/authMiddleware');

router.use(verifyToken);

router.get('/', movementsController.getAll);
router.post('/', movementsController.create);
router.delete('/:id', movementsController.remove);

module.exports = router;
