const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const newsController = require('../controllers/newsController');
const authMiddleware = require('../middleware/auth');

// Multer configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '..', 'uploads'));
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 40) || 'file';
        cb(null, `${Date.now()}-${base}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif|webp|mp4|mov|webm|quicktime/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = /^(image|video)\//.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only images and videos are allowed'));
        }
    }
});

// GET /api/news
router.get('/', newsController.getAllNews);

// GET /api/news/hot
router.get('/hot', newsController.getHotNews);

// GET /api/news/:id
router.get('/:id', newsController.getNewsById);

// POST /api/news
router.post('/', authMiddleware, upload.single('media'), newsController.createNews);

// PUT /api/news/:id
router.put('/:id', authMiddleware, upload.single('media'), newsController.updateNews);

// DELETE /api/news/:id
router.delete('/:id', authMiddleware, newsController.deleteNews);

module.exports = router;