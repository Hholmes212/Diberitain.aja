const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { createTables } = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const newsRoutes = require('./routes/newsRoutes');
const commentRoutes = require('./routes/commentRoutes');
const interactionRoutes = require('./routes/interactionRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Pastikan folder uploads ada
fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });

// Serve static files (uploads folder dan frontend files)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname)));

// Initialize database tables
createTables();

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/interactions', interactionRoutes);

// Test API route
app.get('/api', (req, res) => {
    res.json({ message: 'Diberitain.aja API is running' });
});

// Serve frontend - this should be AFTER API routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'Ukuran file maksimal 10MB' });
    }
    if (err.name === 'MulterError' || err.message === 'Only images and videos are allowed') {
        return res.status(400).json({ message: 'File harus berupa gambar (jpg, png, gif, webp) atau video (mp4, mov, webm)' });
    }
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Frontend: http://localhost:${PORT}`);
    console.log(`API: http://localhost:${PORT}/api`);
});