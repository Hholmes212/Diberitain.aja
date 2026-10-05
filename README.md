# Diberitain.aja

Portal berita berbasis web tempat pengguna bisa membaca, menulis, dan mendiskusikan berita. Dilengkapi gambar/video berita, kategori, pencarian, like, share, dan komentar.

<img width="1890" height="928" alt="image" src="https://github.com/user-attachments/assets/f8b05545-16a1-46f6-a4a5-ed4b063b4dfa" />

## Fitur

- **Akun pengguna**: daftar, login, dan logout memakai JWT; kata sandi disimpan dalam bentuk hash (bcrypt).
- **Hot News**: carousel otomatis berisi 7 berita terpopuler, dihitung dari like, komentar, dan share.
- **Kategori**: Technology, Business, Sports, Politics, Entertainment.
- **Pencarian**: cari berita berdasarkan judul atau isi.
- **Gambar & video berita**: unggah lewat klik atau drag & drop (JPG, PNG, GIF, WebP, MP4, MOV, WebM, maks. 10 MB). Berita tanpa gambar otomatis memakai sampul sesuai kategori.
- **Tambah, edit, dan hapus berita** (hanya oleh penulisnya).
- **Like, share, dan komentar** pada setiap berita.
- **Aman dari XSS**: teks dari pengguna di-escape sebelum ditampilkan.

## Tampilan

<img width="1886" height="423" alt="image" src="https://github.com/user-attachments/assets/2e3d612a-8b51-46b7-97b8-80e45d4119b1" />

## Teknologi

- **Frontend**: HTML, CSS, dan JavaScript (tanpa framework)
- **Backend**: Node.js, Express 5
- **Database**: PostgreSQL (library `pg`)
- **Lainnya**: JSON Web Token, bcryptjs, multer (upload file), dotenv

## Cara menjalankan

### Prasyarat
- [Node.js](https://nodejs.org) 18 atau lebih baru
- [PostgreSQL](https://www.postgresql.org/download/)

### Langkah

1. **Clone repo**

```bash
   git clone https://github.com/USERNAME/Diberitain.aja.git
   cd Diberitain.aja/backend
```

2. **Buat database** (lewat pgAdmin atau psql)

```sql
   CREATE DATABASE blog_news_db;
```

3. **Buat file `.env`** di folder `backend` dengan menyalin `.env.example`, lalu isi nilainya

```env
   PORT=5001
   DB_USER=postgres
   DB_PASSWORD=password_postgres_kamu
   DB_HOST=localhost
   DB_NAME=blog_news_db
   DB_PORT=5432
   JWT_SECRET=kalimat_rahasia_yang_panjang_dan_acak
   JWT_EXPIRE=7d
```

4. **Install dan jalankan**

```bash
   npm install
   npm run seed     # opsional: isi 11 berita contoh + akun demo
   npm start
```

5. Buka **http://localhost:5001**

Tabel database dibuat otomatis saat server pertama kali dijalankan.

**Akun demo** (dari `npm run seed`): `redaksi@diberitain.aja` / `demo1234`

## Struktur proyek

```
backend/
├── config/database.js        # koneksi PostgreSQL + pembuatan tabel
├── controllers/              # logika auth, berita, komentar, interaksi
├── middleware/auth.js        # verifikasi JWT
├── routes/                   # definisi endpoint API
├── seed-images/              # gambar sampul untuk data contoh
├── uploads/                  # file yang diunggah pengguna (tidak di-commit)
├── index.html, style.css, script.js   # frontend
├── seed.js                   # pengisi data contoh
└── server.js                 # titik masuk aplikasi
```

## API singkat

| Method | Endpoint | Keterangan | Login |
|---|---|---|---|
| POST | `/api/auth/register` | Daftar akun | - |
| POST | `/api/auth/login` | Login, mengembalikan token | - |
| GET | `/api/auth/me` | Data pengguna saat ini | ✔ |
| GET | `/api/news?category=&q=` | Daftar berita (filter kategori / kata kunci) | - |
| GET | `/api/news/hot` | 7 berita terpopuler | - |
| GET | `/api/news/:id` | Detail berita | - |
| POST | `/api/news` | Tambah berita (form-data + `media`) | ✔ |
| PUT | `/api/news/:id` | Edit berita milik sendiri | ✔ |
| DELETE | `/api/news/:id` | Hapus berita milik sendiri | ✔ |
| GET | `/api/comments/news/:id` | Komentar sebuah berita | - |
| POST | `/api/comments` | Tambah komentar | ✔ |
| POST | `/api/interactions/like` | Like / batal like | ✔ |
| POST | `/api/interactions/share` | Share berita | ✔ |

Endpoint yang butuh login memakai header `Authorization: Bearer <token>`.

## Catatan keamanan

- Jangan pernah meng-commit file `.env`; sudah masuk `.gitignore`.
- Ganti `JWT_SECRET` dengan nilai acak yang panjang sebelum dipakai di server publik.
- Folder `uploads` tidak ikut repo. Saat deploy, gunakan penyimpanan yang permanen untuk file unggahan.
