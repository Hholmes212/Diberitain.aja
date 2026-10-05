const { pool } = require('../config/database');

// Create comment
exports.createComment = async (req, res) => {
    try {
        const { content, news_id } = req.body;

        const newsExists = await pool.query('SELECT id FROM news WHERE id = $1', [news_id]);

        if (newsExists.rows.length === 0) {
            return res.status(404).json({ message: 'News not found' });
        }

        const newComment = await pool.query(
            'INSERT INTO comments (content, news_id, user_id) VALUES ($1, $2, $3) RETURNING *',
            [content, news_id, req.user.id]
        );

        const commentWithUser = await pool.query(
            'SELECT c.*, u.username FROM comments c JOIN users u ON c.user_id = u.id WHERE c.id = $1',
            [newComment.rows[0].id]
        );

        res.status(201).json({
            message: 'Comment created successfully',
            comment: commentWithUser.rows[0]
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Get comments by news
exports.getCommentsByNews = async (req, res) => {
    try {
        const { news_id } = req.params;

        const comments = await pool.query(
            'SELECT c.*, u.username FROM comments c JOIN users u ON c.user_id = u.id WHERE c.news_id = $1 ORDER BY c.created_at DESC',
            [news_id]
        );

        res.json({ comments: comments.rows });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Update comment
exports.updateComment = async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;

        const commentCheck = await pool.query(
            'SELECT * FROM comments WHERE id = $1 AND user_id = $2',
            [id, req.user.id]
        );

        if (commentCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Comment not found or unauthorized' });
        }

        const updatedComment = await pool.query(
            'UPDATE comments SET content = $1 WHERE id = $2 RETURNING *',
            [content, id]
        );

        res.json({
            message: 'Comment updated successfully',
            comment: updatedComment.rows[0]
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Delete comment
exports.deleteComment = async (req, res) => {
    try {
        const { id } = req.params;

        const commentCheck = await pool.query(
            'SELECT * FROM comments WHERE id = $1 AND user_id = $2',
            [id, req.user.id]
        );

        if (commentCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Comment not found or unauthorized' });
        }

        await pool.query('DELETE FROM comments WHERE id = $1', [id]);

        res.json({ message: 'Comment deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};