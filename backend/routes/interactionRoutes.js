const express = require('express');
const router = express.Router();
const interactionController = require('../controllers/interactionController');
const authMiddleware = require('../middleware/auth');

// POST /api/interactions/like
router.post('/like', authMiddleware, interactionController.toggleLike);

// POST /api/interactions/share
router.post('/share', authMiddleware, interactionController.createShare);

// GET /api/interactions/:news_id
router.get('/:news_id', authMiddleware, interactionController.getUserInteractions);

module.exports = router;