// Kalau halaman dibuka dari server backend (port 5001) pakai alamat relatif,
// kalau dibuka dengan cara lain (Live Server / file) arahkan ke backend lokal.
const ORIGIN = location.protocol.startsWith('http') && location.port === '5001' ? '' : 'http://localhost:5001';
const API_URL = ORIGIN + '/api';
let searchQuery = '';

// Escape teks dari pengguna supaya tidak bisa menyisipkan HTML/script (XSS)
function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function mediaSrc(url) {
    return ORIGIN + encodeURI(url);
}

// Gambar/video berita; kalau tidak ada media tampilkan sampul berwarna sesuai kategori
function coverHTML(item, cls) {
    if (item.media_url && item.media_type === 'video') {
        return `<video src="${mediaSrc(item.media_url)}#t=0.1" class="${cls}" muted preload="metadata"></video>`;
    }
    if (item.media_url) {
        return `<img src="${mediaSrc(item.media_url)}" alt="${esc(item.title)}" class="${cls}" loading="lazy" data-category="${esc(item.category)}" onerror="imageFailed(this)">`;
    }
    return fallbackCover(item.category, cls);
}

// Kalau file gambar hilang/rusak, ganti dengan sampul kategori
function imageFailed(img) {
    img.onerror = null;
    const holder = document.createElement('div');
    holder.innerHTML = fallbackCover(img.dataset.category, img.className);
    img.replaceWith(holder.firstElementChild);
}

function fallbackCover(category, cls) {
    const key = String(category || 'news').toLowerCase().replace(/[^a-z]/g, '');
    return `<div class="${cls} cover-fallback cat-${key}"><span>${esc(category || 'News')}</span></div>`;
}

function emptyCard() {
    return '<div class="news-card placeholder"><div class="news-card-content"><p class="placeholder-text">No news yet</p></div></div>';
}

function cardMeta(item) {
    return `<div class="news-card-meta">
        <span>♥ ${item.likes_count}</span>
        <span>💬 ${item.comments_count}</span>
        <span>↗ ${item.shares_count}</span>
    </div>`;
}
let currentUser = null;
let currentNewsId = null;
let selectedCategory = 'all';
let hotNewsData = [];
let autoScrollInterval = null;
let isEditMode = false;
let editingNewsId = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    loadHotNews();
    loadNewsByCategory();
    initializeEventListeners();
});

// Event Listeners
function initializeEventListeners() {
    // Auth
    document.getElementById('loginBtn').addEventListener('click', () => openAuthModal('login'));
    document.getElementById('registerBtn').addEventListener('click', () => openAuthModal('register'));
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.querySelector('.close').addEventListener('click', closeAuthModal);
    document.getElementById('switchLink').addEventListener('click', switchAuthMode);
    document.getElementById('authForm').addEventListener('submit', handleAuth);

    // Category tabs
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            selectedCategory = e.target.dataset.category;
            loadNewsByCategory();
        });
    });

    // Search (tekan Enter atau berhenti mengetik)
    const searchBox = document.querySelector('.search-box');
    let searchTimer;
    searchBox.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            searchQuery = searchBox.value.trim();
            loadNewsByCategory();
        }, 300);
    });
    searchBox.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            clearTimeout(searchTimer);
            searchQuery = searchBox.value.trim();
            loadNewsByCategory();
            document.getElementById('category').scrollIntoView({ behavior: 'smooth' });
        }
    });

    // Drag & drop gambar/video ke kotak upload
    const uploadBox = document.getElementById('uploadBox');
    ['dragenter', 'dragover'].forEach(ev => uploadBox.addEventListener(ev, (e) => {
        e.preventDefault();
        if (currentUser) uploadBox.classList.add('dragover');
    }));
    ['dragleave', 'drop'].forEach(ev => uploadBox.addEventListener(ev, (e) => {
        e.preventDefault();
        uploadBox.classList.remove('dragover');
    }));
    uploadBox.addEventListener('drop', (e) => {
        if (!currentUser || !e.dataTransfer.files.length) return;
        const input = document.getElementById('mediaInput');
        input.files = e.dataTransfer.files;
        input.dispatchEvent(new Event('change'));
    });

    // Upload
    document.getElementById('uploadBox').addEventListener('click', () => {
        if (!currentUser) {
            alert('Please login to upload news');
            return;
        }
        document.getElementById('mediaInput').click();
    });
    document.getElementById('mediaInput').addEventListener('change', handleMediaUpload);
    document.getElementById('uploadNewsBtn').addEventListener('click', handleNewsSubmit);

    // Cancel Edit Button
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', () => cancelEdit());
    }

    // Comment
    document.getElementById('submitComment').addEventListener('click', handleCommentSubmit);
}

// Auth Functions
function checkAuth() {
    const token = localStorage.getItem('token');
    if (token) {
        fetch(`${API_URL}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
            .then(res => res.json())
            .then(data => {
                if (data.user) {
                    currentUser = data.user;
                    updateUIForAuth();
                } else {
                    localStorage.removeItem('token');
                }
            })
            .catch(() => {
                localStorage.removeItem('token');
            });
    }
}

function updateUIForAuth() {
    document.getElementById('authButtons').style.display = 'none';
    document.getElementById('userMenu').style.display = 'flex';
    document.getElementById('username').textContent = currentUser.username;

    // Enable Add section
    document.getElementById('newsTitle').disabled = false;
    document.getElementById('categorySelect').disabled = false;
    document.getElementById('newsContent').disabled = false;
    document.getElementById('mediaInput').disabled = false;
    document.getElementById('uploadNewsBtn').disabled = false;
    document.getElementById('uploadBox').classList.remove('disabled');
    document.querySelector('.upload-box .upload-hint:last-of-type').style.display = 'none';

    document.getElementById('commentForm').style.display = 'block';
    document.getElementById('commentLoginPrompt').style.display = 'none';
}

function openAuthModal(mode) {
    const modal = document.getElementById('authModal');
    const title = document.getElementById('modalTitle');
    const usernameField = document.getElementById('authUsername');
    const switchText = document.getElementById('authSwitch');
    const switchLink = document.getElementById('switchLink');

    if (mode === 'login') {
        title.textContent = 'Login';
        usernameField.style.display = 'none';
        usernameField.required = false;
        switchText.innerHTML = "Don't have an account? <span id='switchLink'>Register</span>";
    } else {
        title.textContent = 'Register';
        usernameField.style.display = 'block';
        usernameField.required = true;
        switchText.innerHTML = "Already have an account? <span id='switchLink'>Login</span>";
    }

    document.getElementById('switchLink').addEventListener('click', switchAuthMode);
    modal.style.display = 'block';
}

function closeAuthModal() {
    document.getElementById('authModal').style.display = 'none';
    document.getElementById('authForm').reset();
}

function switchAuthMode() {
    const title = document.getElementById('modalTitle').textContent;
    openAuthModal(title === 'Login' ? 'register' : 'login');
}

async function handleAuth(e) {
    e.preventDefault();
    const mode = document.getElementById('modalTitle').textContent.toLowerCase();
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    const username = document.getElementById('authUsername').value;

    const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
    const body = mode === 'login' ? { email, password } : { username, email, password };

    try {
        const res = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await res.json();

        if (res.ok) {
            localStorage.setItem('token', data.token);
            currentUser = data.user;
            updateUIForAuth();
            closeAuthModal();
            loadHotNews();
            loadNewsByCategory();
            if (currentNewsId) selectNews(currentNewsId); // muat ulang agar tombol Like/Share muncul
        } else {
            alert(data.message || 'Authentication failed');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

function logout() {
    localStorage.removeItem('token');
    currentUser = null;
    document.getElementById('authButtons').style.display = 'flex';
    document.getElementById('userMenu').style.display = 'none';

    // Disable Add section
    document.getElementById('newsTitle').disabled = true;
    document.getElementById('categorySelect').disabled = true;
    document.getElementById('newsContent').disabled = true;
    document.getElementById('mediaInput').disabled = true;
    document.getElementById('uploadNewsBtn').disabled = true;
    document.getElementById('uploadBox').classList.add('disabled');

    document.getElementById('commentForm').style.display = 'none';
    document.getElementById('commentLoginPrompt').style.display = 'block';
    location.reload();
}

// News Functions
async function loadHotNews() {
    try {
        const res = await fetch(`${API_URL}/news/hot`);
        const data = await res.json();
        hotNewsData = data.news;
        displayHotNews(data.news);
    } catch (error) {
        console.error('Error loading hot news:', error);
    }
}

function displayHotNews(news) {
    const carousel = document.getElementById('hotNewsCarousel');

    // Create exactly 7 cards (either news or placeholders)
    let displayCards = [];

    if (news.length === 0) {
        displayCards = Array(7).fill(null).map(() => ({
            isPlaceholder: true
        }));
    } else {
        displayCards = news.slice(0, 7);
        // Fill remaining with placeholders if less than 7
        while (displayCards.length < 7) {
            displayCards.push({ isPlaceholder: true });
        }
    }

    // Triple the cards for seamless infinite loop
    const tripleCards = [...displayCards, ...displayCards, ...displayCards];

    const cardsHTML = tripleCards.map((item, index) => {
        if (item.isPlaceholder) {
            return `
                <div class="news-card placeholder">
                    <div class="news-card-content">
                        <p class="placeholder-text">No news yet</p>
                    </div>
                </div>
            `;
        }
        return `
            <div class="news-card" onclick="selectNews(${item.id}, true)">
                ${coverHTML(item, 'news-card-media')}
                <div class="news-card-content">
                    <span class="news-card-tag">${esc(item.category)}</span>
                    <h3>${esc(item.title)}</h3>
                    <p class="news-card-excerpt">${esc(item.content)}</p>
                    ${cardMeta(item)}
                </div>
            </div>
        `;
    }).join('');

    carousel.innerHTML = cardsHTML;

    // Set initial scroll position to middle set (card 8 - which is duplicate of card 1)
    const wrapper = document.querySelector('.carousel-wrapper');
    const cardWidth = 520;
    wrapper.scrollLeft = 7 * cardWidth;

    // Start auto-scroll
    setTimeout(() => startAutoScroll(), 100);
}

async function loadNewsByCategory() {
    try {
        const params = new URLSearchParams();
        if (selectedCategory !== 'all') params.set('category', selectedCategory);
        if (searchQuery) params.set('q', searchQuery);
        const qs = params.toString();

        const res = await fetch(`${API_URL}/news${qs ? '?' + qs : ''}`);
        const data = await res.json();
        displayCategoryNews(data.news);
    } catch (error) {
        console.error('Error loading news:', error);
    }
}

function displayCategoryNews(news) {
    const container = document.getElementById('categoryNews');

    if (news.length === 0) {
        const msg = searchQuery ? `Tidak ada hasil untuk "${esc(searchQuery)}"` : 'No news yet';
        container.innerHTML = Array(12).fill(0).map((_, i) =>
            `<div class="news-card placeholder"><div class="news-card-content"><p class="placeholder-text">${i === 0 ? msg : 'No news yet'}</p></div></div>`
        ).join('');
        return;
    }

    // Show actual news, fill remaining with placeholders up to 12
    const cards = news.map(item => `
        <div class="news-card" onclick="selectNews(${item.id}, true)">
            ${coverHTML(item, 'news-card-media')}
            <div class="news-card-content">
                <h3>${esc(item.title)}</h3>
                ${cardMeta(item)}
            </div>
        </div>
    `);

    // Fill remaining slots with placeholders
    const remaining = 12 - news.length;
    for (let i = 0; i < remaining; i++) {
        cards.push(emptyCard());
    }

    container.innerHTML = cards.join('');
}

async function selectNews(id, scrollToDetail = false) {
    currentNewsId = id;
    if (scrollToDetail) {
        document.getElementById('current').scrollIntoView({ behavior: 'smooth' });
    }

    try {
        const res = await fetch(`${API_URL}/news/${id}`);
        const data = await res.json();
        displayNewsDetail(data.news);
        loadComments(id);

        if (currentUser) {
            checkUserInteraction(id);
        }
    } catch (error) {
        console.error('Error loading news detail:', error);
    }
}

async function checkUserInteraction(newsId) {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/interactions/${newsId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await res.json();

        const likeBtn = document.querySelector('.like-btn');
        if (data.liked) {
            likeBtn.classList.add('liked');
        }
    } catch (error) {
        console.error('Error checking interaction:', error);
    }
}

function displayNewsDetail(news) {
    const container = document.getElementById('newsDetail');
    const isOwner = currentUser && currentUser.id === news.user_id;

    container.innerHTML = `
        ${news.media_url
            ? (news.media_type === 'video'
                ? `<video controls src="${mediaSrc(news.media_url)}" class="news-detail-media"></video>`
                : `<img src="${mediaSrc(news.media_url)}" alt="${esc(news.title)}" class="news-detail-media">`)
            : fallbackCover(news.category, 'news-detail-media')}
        <h2>${esc(news.title)}</h2>
        <div class="news-detail-info">
            <span>By ${esc(news.username)}</span>
            <span>${esc(news.category)}</span>
            <span>${new Date(news.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            ${new Date(news.updated_at) - new Date(news.created_at) > 1000 ? `<span>(Edited)</span>` : ''}
        </div>
        <div class="news-detail-content">
            <p>${esc(news.content)}</p>
        </div>
        <div class="news-detail-actions">
            ${currentUser ? `
                <button class="action-btn like-btn" onclick="toggleLike()">Like (${news.likes_count})</button>
                <button class="action-btn" onclick="shareNews()">Share (${news.shares_count})</button>
            ` : `<span class="login-hint">Login untuk like, share, dan komentar · ${news.likes_count} likes · ${news.shares_count} shares</span>`}
            ${isOwner ? `
                <button class="action-btn edit-btn" onclick="editNews(${news.id})">Edit</button>
                <button class="action-btn delete-btn" onclick="deleteNews(${news.id})">Delete</button>
            ` : ''}
        </div>
    `;
}

// EDIT FUNCTIONALITY
async function editNews(id) {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/news/${id}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await res.json();

        if (res.ok) {
            // Masuk ke mode edit
            isEditMode = true;
            editingNewsId = id;

            // Isi form dengan data berita yang akan diedit
            document.getElementById('newsTitle').value = data.news.title;
            document.getElementById('categorySelect').value = data.news.category;
            document.getElementById('newsContent').value = data.news.content;
            document.getElementById('formTitle').textContent = 'Edit News';

            // Ganti tombol "Add news here!" menjadi "Update News"
            document.getElementById('uploadNewsBtn').textContent = 'Update News';

            // Tampilkan preview media jika ada
            const preview = document.getElementById('mediaPreview');
            if (data.news.media_url) {
                const isVideo = data.news.media_type === 'video';
                preview.innerHTML = isVideo
                    ? `<video src="${mediaSrc(data.news.media_url)}" controls></video>`
                    : `<img src="${mediaSrc(data.news.media_url)}" alt="Preview">`;
            } else {
                preview.innerHTML = '';
            }

            // Tambah tombol cancel edit
            const addRight = document.querySelector('.add-right');
            if (!document.getElementById('cancelEditBtn')) {
                const cancelBtn = document.createElement('button');
                cancelBtn.id = 'cancelEditBtn';
                cancelBtn.className = 'btn-secondary';
                cancelBtn.textContent = 'Cancel Edit';
                cancelBtn.style.marginTop = '10px';
                cancelBtn.addEventListener('click', () => cancelEdit());
                addRight.appendChild(cancelBtn);
            }

            // Scroll ke section Add
            document.getElementById('add').scrollIntoView({ behavior: 'smooth' });
        }
    } catch (error) {
        console.error('Error loading news for edit:', error);
        alert('Failed to load news for editing');
    }
}

function cancelEdit(silent = false) {
    isEditMode = false;
    editingNewsId = null;

    // Reset form
    document.getElementById('newsTitle').value = '';
    document.getElementById('categorySelect').value = '';
    document.getElementById('newsContent').value = '';
    document.getElementById('mediaInput').value = '';
    document.getElementById('mediaPreview').innerHTML = '';
    document.getElementById('formTitle').textContent = 'News Title';
    document.getElementById('uploadNewsBtn').textContent = 'Add news here!';

    // Hapus tombol cancel edit
    const cancelBtn = document.getElementById('cancelEditBtn');
    if (cancelBtn) {
        cancelBtn.remove();
    }

    if (silent !== true) alert('Edit mode canceled');
}

async function handleNewsSubmit() {
    const title = document.getElementById('newsTitle').value;
    const content = document.getElementById('newsContent').value;
    const category = document.getElementById('categorySelect').value;
    const btn = document.getElementById('uploadNewsBtn');
    const mediaFile = document.getElementById('mediaInput').files[0];

    if (!title || !content || !category) {
        alert('Please fill all fields');
        return;
    }

    btn.disabled = true;
    const formData = new FormData();
    formData.append('title', title);
    formData.append('content', content);
    formData.append('category', category);
    if (mediaFile) {
        formData.append('media', mediaFile);
    }

    try {
        const token = localStorage.getItem('token');
        let endpoint = `${API_URL}/news`;
        let method = 'POST';

        // Jika dalam mode edit, gunakan endpoint update
        if (isEditMode && editingNewsId) {
            endpoint = `${API_URL}/news/${editingNewsId}`;
            method = 'PUT';
        }

        const res = await fetch(endpoint, {
            method: method,
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (res.ok) {
            const wasEdit = isEditMode;
            const savedId = editingNewsId;
            const result = await res.json();
            alert(wasEdit ? 'News updated successfully!' : 'News created successfully!');

            // Reset form (tanpa alert tambahan)
            cancelEdit(true);

            // Reload data
            loadHotNews();
            loadNewsByCategory();

            // Tampilkan berita yang baru dibuat / diedit di bagian Current
            const showId = wasEdit ? savedId : result.news && result.news.id;
            if (showId) selectNews(showId, true);
        } else {
            const error = await res.json();
            alert(error.message || 'Failed to save news');
        }
    } catch (error) {
        console.error('Error saving news:', error);
        alert('Error: ' + error.message);
    } finally {
        btn.disabled = !currentUser;
    }
}

async function toggleLike() {
    if (!currentUser) {
        alert('Please login to like');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/interactions/like`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ news_id: currentNewsId })
        });

        if (res.ok) {
            selectNews(currentNewsId);
            loadHotNews();
        }
    } catch (error) {
        console.error('Error toggling like:', error);
    }
}

async function shareNews() {
    if (!currentUser) {
        alert('Please login to share');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/interactions/share`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ news_id: currentNewsId })
        });

        if (res.ok) {
            alert('News shared!');
            selectNews(currentNewsId);
            loadHotNews();
        }
    } catch (error) {
        console.error('Error sharing news:', error);
    }
}

async function deleteNews(id) {
    if (!confirm('Are you sure you want to delete this news?')) return;

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/news/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (res.ok) {
            alert('News deleted successfully');
            document.getElementById('newsDetail').innerHTML = '<div class="placeholder-detail"><p>Select any news to see detail!</p></div>';
            loadHotNews();
            loadNewsByCategory();

            // Jika sedang dalam mode edit untuk berita yang dihapus, cancel edit
            if (isEditMode && editingNewsId === id) {
                cancelEdit();
            }
        }
    } catch (error) {
        console.error('Error deleting news:', error);
    }
}

// Comments
async function loadComments(newsId) {
    try {
        const res = await fetch(`${API_URL}/comments/news/${newsId}`);
        const data = await res.json();
        displayComments(data.comments);
    } catch (error) {
        console.error('Error loading comments:', error);
    }
}

function displayComments(comments) {
    const container = document.getElementById('commentsList');

    if (comments.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666;">No comments yet</p>';
        return;
    }

    container.innerHTML = comments.map(comment => {
        const date = new Date(comment.created_at);
        const timeAgo = getTimeAgo(date);
        return `
            <div class="comment-item">
                <div class="comment-author">${esc(comment.username)}</div>
                <div class="comment-time">${timeAgo}</div>
                <p>${esc(comment.content)}</p>
            </div>
        `;
    }).join('');

    // Auto scroll to bottom
    container.scrollTop = container.scrollHeight;
}

function getTimeAgo(date) {
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return Math.floor(diff / 60) + ' minutes ago';
    if (diff < 86400) return Math.floor(diff / 3600) + ' hours ago';
    if (diff < 604800) return Math.floor(diff / 86400) + ' days ago';

    return date.toLocaleDateString();
}

async function handleCommentSubmit() {
    const content = document.getElementById('commentInput').value;

    if (!currentNewsId) {
        alert('Pilih berita dulu untuk berkomentar');
        return;
    }
    if (!content.trim()) {
        alert('Please enter a comment');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                content,
                news_id: currentNewsId
            })
        });

        if (res.ok) {
            document.getElementById('commentInput').value = '';
            loadComments(currentNewsId);
            selectNews(currentNewsId);
            loadHotNews();
        } else {
            const err = await res.json().catch(() => ({}));
            alert(err.message || 'Failed to post comment');
        }
    } catch (error) {
        console.error('Error posting comment:', error);
    }
}

// Upload & Create News
function handleMediaUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
        alert('Ukuran file maksimal 10MB');
        e.target.value = '';
        return;
    }

    const preview = document.getElementById('mediaPreview');
    const reader = new FileReader();

    reader.onload = (event) => {
        const isVideo = file.type.startsWith('video/');
        preview.innerHTML = isVideo
            ? `<video src="${event.target.result}" controls></video>`
            : `<img src="${event.target.result}" alt="Preview">`;
    };

    reader.readAsDataURL(file);
}

// Auto-scroll carousel with seamless infinity loop
function startAutoScroll() {
    const wrapper = document.querySelector('.carousel-wrapper');
    if (!wrapper) return;

    // Clear existing interval
    if (autoScrollInterval) {
        clearInterval(autoScrollInterval);
    }

    const cardWidth = 520;
    const totalCards = 7; // Original 7 cards

    // DIUBAH: Interval dipercepat lagi dari 1500ms menjadi 1200ms
    autoScrollInterval = setInterval(() => {
        wrapper.scrollBy({ left: cardWidth, behavior: 'smooth' });

        // Check position and reset if needed (seamless loop)
        setTimeout(() => {
            const currentPos = wrapper.scrollLeft;
            const resetThreshold = (totalCards * 2) * cardWidth; // End of second set
            const resetPosition = totalCards * cardWidth; // Start of second set

            if (currentPos >= resetThreshold - 50) {
                wrapper.style.scrollBehavior = 'auto';
                wrapper.scrollLeft = resetPosition;
                setTimeout(() => {
                    wrapper.style.scrollBehavior = 'smooth';
                }, 50);
            }
        }, 600);
    }, 1200); // DIUBAH: dari 1500ms menjadi 1200ms (1.2 detik)

    // Handle manual scroll
    let scrollTimeout;
    wrapper.addEventListener('scroll', () => {
        const currentPos = wrapper.scrollLeft;
        const cardWidth = 520;
        const totalCards = 7;
        const resetThreshold = (totalCards * 2) * cardWidth;
        const resetPosition = totalCards * cardWidth;
        const startThreshold = cardWidth;

        // Reset if scrolled too far right
        if (currentPos >= resetThreshold - 50) {
            wrapper.style.scrollBehavior = 'auto';
            wrapper.scrollLeft = resetPosition;
            setTimeout(() => {
                wrapper.style.scrollBehavior = 'smooth';
            }, 50);
        }

        // Reset if scrolled too far left
        if (currentPos <= startThreshold) {
            wrapper.style.scrollBehavior = 'auto';
            wrapper.scrollLeft = resetPosition;
            setTimeout(() => {
                wrapper.style.scrollBehavior = 'smooth';
            }, 50);
        }

        clearInterval(autoScrollInterval);
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            startAutoScroll();
        }, 5000);
    }, { passive: true });
}