const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController');
const authMiddleware = require('../middleware/auth');

// POST /api/comments
router.post('/', authMiddleware, commentController.createComment);

// GET /api/comments/news/:news_id
router.get('/news/:news_id', commentController.getCommentsByNews);

// PUT /api/comments/:id
router.put('/:id', authMiddleware, commentController.updateComment);

// DELETE /api/comments/:id
router.delete('/:id', authMiddleware, commentController.deleteComment);

module.exports = router;