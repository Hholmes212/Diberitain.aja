const { pool } = require('../config/database');

// Toggle like
exports.toggleLike = async (req, res) => {
    try {
        const { news_id } = req.body;

        const newsExists = await pool.query('SELECT id FROM news WHERE id = $1', [news_id]);

        if (newsExists.rows.length === 0) {
            return res.status(404).json({ message: 'News not found' });
        }

        const existingLike = await pool.query(
            'SELECT * FROM likes WHERE news_id = $1 AND user_id = $2',
            [news_id, req.user.id]
        );

        if (existingLike.rows.length > 0) {
            await pool.query(
                'DELETE FROM likes WHERE news_id = $1 AND user_id = $2',
                [news_id, req.user.id]
            );
            return res.json({ message: 'Like removed', liked: false });
        } else {
            await pool.query(
                'INSERT INTO likes (news_id, user_id) VALUES ($1, $2)',
                [news_id, req.user.id]
            );
            return res.json({ message: 'News liked', liked: true });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Create share
exports.createShare = async (req, res) => {
    try {
        const { news_id } = req.body;

        const newsExists = await pool.query('SELECT id FROM news WHERE id = $1', [news_id]);

        if (newsExists.rows.length === 0) {
            return res.status(404).json({ message: 'News not found' });
        }

        await pool.query(
            'INSERT INTO shares (news_id, user_id) VALUES ($1, $2)',
            [news_id, req.user.id]
        );

        res.status(201).json({ message: 'News shared successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Get user interactions
exports.getUserInteractions = async (req, res) => {
    try {
        const { news_id } = req.params;

        const liked = await pool.query(
            'SELECT id FROM likes WHERE news_id = $1 AND user_id = $2',
            [news_id, req.user.id]
        );

        res.json({
            liked: liked.rows.length > 0
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};