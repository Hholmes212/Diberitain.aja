const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

const CATEGORIES = ['Technology', 'Business', 'Sports', 'Politics', 'Entertainment'];

// Hapus file media lama dari folder uploads (aman: hanya file di dalam /uploads)
const removeMedia = (mediaUrl) => {
    if (!mediaUrl || !mediaUrl.startsWith('/uploads/')) return;
    const file = path.join(__dirname, '..', 'uploads', path.basename(mediaUrl));
    fs.unlink(file, () => { });
};

const validate = (body) => {
    const title = (body.title || '').trim();
    const content = (body.content || '').trim();
    const category = body.category;
    if (!title || !content || !category) return 'Judul, isi, dan kategori wajib diisi';
    if (title.length > 255) return 'Judul maksimal 255 karakter';
    if (!CATEGORIES.includes(category)) return 'Kategori tidak valid';
    return null;
};

// Create news
exports.createNews = async (req, res) => {
    try {
        const error = validate(req.body);
        if (error) {
            if (req.file) removeMedia(`/uploads/${req.file.filename}`);
            return res.status(400).json({ message: error });
        }
        const title = req.body.title.trim();
        const content = req.body.content.trim();
        const category = req.body.category;
        const mediaUrl = req.file ? `/uploads/${req.file.filename}` : null;
        const mediaType = req.file ? req.file.mimetype.split('/')[0] : null;

        const newNews = await pool.query(
            'INSERT INTO news (title, content, category, media_url, media_type, user_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [title, content, category, mediaUrl, mediaType, req.user.id]
        );

        res.status(201).json({
            message: 'News created successfully',
            news: newNews.rows[0]
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Get all news
exports.getAllNews = async (req, res) => {
    try {
        const { category, q } = req.query;

        let query = `
      SELECT n.*, u.username, 
        (SELECT COUNT(*) FROM likes WHERE news_id = n.id) as likes_count,
        (SELECT COUNT(*) FROM comments WHERE news_id = n.id) as comments_count,
        (SELECT COUNT(*) FROM shares WHERE news_id = n.id) as shares_count
      FROM news n
      JOIN users u ON n.user_id = u.id
    `;

        const params = [];
        const where = [];
        if (category) {
            params.push(category);
            where.push(`n.category = $${params.length}`);
        }
        if (q && q.trim()) {
            params.push(`%${q.trim()}%`);
            where.push(`(n.title ILIKE $${params.length} OR n.content ILIKE $${params.length})`);
        }
        if (where.length) query += ' WHERE ' + where.join(' AND ');

        query += ' ORDER BY n.created_at DESC';

        const news = await pool.query(query, params);
        res.json({ news: news.rows });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Get hot news
exports.getHotNews = async (req, res) => {
    try {
        const news = await pool.query(`
      SELECT n.*, u.username,
        (SELECT COUNT(*) FROM likes WHERE news_id = n.id) as likes_count,
        (SELECT COUNT(*) FROM comments WHERE news_id = n.id) as comments_count,
        (SELECT COUNT(*) FROM shares WHERE news_id = n.id) as shares_count,
        ((SELECT COUNT(*) FROM likes WHERE news_id = n.id) * 3 +
         (SELECT COUNT(*) FROM comments WHERE news_id = n.id) * 2 +
         (SELECT COUNT(*) FROM shares WHERE news_id = n.id) * 4) as hot_score
      FROM news n
      JOIN users u ON n.user_id = u.id
      ORDER BY hot_score DESC, n.created_at DESC
      LIMIT 7
    `);

        res.json({ news: news.rows });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Get single news
exports.getNewsById = async (req, res) => {
    try {
        const { id } = req.params;

        const news = await pool.query(`
      SELECT n.*, u.username,
        (SELECT COUNT(*) FROM likes WHERE news_id = n.id) as likes_count,
        (SELECT COUNT(*) FROM comments WHERE news_id = n.id) as comments_count,
        (SELECT COUNT(*) FROM shares WHERE news_id = n.id) as shares_count
      FROM news n
      JOIN users u ON n.user_id = u.id
      WHERE n.id = $1
    `, [id]);

        if (news.rows.length === 0) {
            return res.status(404).json({ message: 'News not found' });
        }

        res.json({ news: news.rows[0] });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Update news
exports.updateNews = async (req, res) => {
    try {
        const { id } = req.params;
        const error = validate(req.body);
        if (error) {
            if (req.file) removeMedia(`/uploads/${req.file.filename}`);
            return res.status(400).json({ message: error });
        }
        const title = req.body.title.trim();
        const content = req.body.content.trim();
        const category = req.body.category;

        const newsCheck = await pool.query(
            'SELECT * FROM news WHERE id = $1 AND user_id = $2',
            [id, req.user.id]
        );

        if (newsCheck.rows.length === 0) {
            if (req.file) removeMedia(`/uploads/${req.file.filename}`);
            return res.status(404).json({ message: 'News not found or unauthorized' });
        }
        if (req.file) removeMedia(newsCheck.rows[0].media_url);

        const mediaUrl = req.file ? `/uploads/${req.file.filename}` : newsCheck.rows[0].media_url;
        const mediaType = req.file ? req.file.mimetype.split('/')[0] : newsCheck.rows[0].media_type;

        const updatedNews = await pool.query(
            'UPDATE news SET title = $1, content = $2, category = $3, media_url = $4, media_type = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6 RETURNING *',
            [title, content, category, mediaUrl, mediaType, id]
        );

        res.json({
            message: 'News updated successfully',
            news: updatedNews.rows[0]
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Delete news
exports.deleteNews = async (req, res) => {
    try {
        const { id } = req.params;

        const newsCheck = await pool.query(
            'SELECT * FROM news WHERE id = $1 AND user_id = $2',
            [id, req.user.id]
        );

        if (newsCheck.rows.length === 0) {
            return res.status(404).json({ message: 'News not found or unauthorized' });
        }

        await pool.query('DELETE FROM news WHERE id = $1', [id]);
        removeMedia(newsCheck.rows[0].media_url);

        res.json({ message: 'News deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};