# Diberitain.aja

Portal berita: login/register, tambah berita dengan gambar/video, like, share, komentar, kategori, dan pencarian.

## Cara menjalankan
1. Install Node.js dan PostgreSQL. Buat database: `CREATE DATABASE blog_news_db;`
2. Salin `.env.example` menjadi `.env` lalu isi `DB_USER`, `DB_PASSWORD`, dan `JWT_SECRET`.
3. Di folder `backend`:
   ```
   npm install
   npm run seed     (opsional: isi 11 berita contoh + akun demo)
   npm start
   ```
4. Buka http://localhost:5001

Akun demo dari `npm run seed`: `redaksi@diberitain.aja` / `demo1234`

Tabel database dibuat otomatis saat server start. Jangan upload file `.env` ke GitHub.
