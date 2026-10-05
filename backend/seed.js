// Mengisi database dengan berita contoh + gambar. Jalankan: npm run seed
// Aman dijalankan berkali-kali (berita yang judulnya sama tidak diduplikasi).
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { pool, createTables } = require('./config/database');

const DEMO_USER = { username: 'redaksi', email: 'redaksi@diberitain.aja', password: 'demo1234' };

const NEWS = [
    ['Technology', 'tech-1', 'Startup lokal luncurkan asisten AI berbahasa Indonesia',
        'Sebuah startup asal Bandung resmi meluncurkan asisten AI yang dilatih khusus untuk memahami bahasa Indonesia sehari-hari, termasuk bahasa gaul dan campuran bahasa daerah.\n\nPendiri startup menyebut aplikasi ini ditujukan untuk membantu pelajar dan pelaku UMKM menulis, merangkum, dan menerjemahkan dokumen dengan lebih cepat. Versi beta dapat dicoba gratis selama tiga bulan pertama.'],
    ['Technology', 'tech-2', 'Jaringan 5G mulai menjangkau lebih banyak kota di luar Jawa',
        'Operator seluler mempercepat pembangunan jaringan 5G ke kota-kota di luar Pulau Jawa. Dalam enam bulan terakhir, puluhan menara baru diaktifkan di Sumatra, Kalimantan, dan Sulawesi.\n\nPengamat menilai pemerataan jaringan akan mendorong layanan pendidikan dan kesehatan jarak jauh, meski harga perangkat yang kompatibel masih menjadi tantangan.'],
    ['Technology', 'tech-1', 'Tips menjaga keamanan akun: mulai dari kata sandi hingga verifikasi dua langkah',
        'Pakar keamanan siber mengingatkan pengguna untuk tidak memakai kata sandi yang sama di banyak layanan. Gunakan pengelola kata sandi dan aktifkan verifikasi dua langkah di akun penting seperti email dan perbankan.\n\nJangan mudah mengeklik tautan dari pesan yang tidak dikenal, karena penipuan lewat tautan palsu masih menjadi modus paling umum.'],
    ['Business', 'business-1', 'Pertumbuhan UMKM digital meningkat, penjualan daring jadi andalan',
        'Jumlah pelaku UMKM yang berjualan lewat platform digital terus bertambah. Banyak pelaku usaha mengaku omzet naik setelah memanfaatkan marketplace dan media sosial untuk promosi.\n\nAsosiasi pelaku usaha mendorong pelatihan pengelolaan keuangan dan pemotretan produk agar toko daring lebih menarik bagi pembeli.'],
    ['Business', 'business-2', 'Harga kebutuhan pokok relatif stabil menjelang akhir pekan',
        'Pantauan di sejumlah pasar tradisional menunjukkan harga beras, telur, dan minyak goreng cenderung stabil. Pedagang menyebut pasokan dari daerah sentra produksi berjalan lancar.\n\nPemerintah daerah akan terus memantau harga agar tidak terjadi lonjakan mendadak yang membebani masyarakat.'],
    ['Sports', 'sports-1', 'Tim nasional bersiap hadapi laga penting dengan latihan intensif',
        'Skuad tim nasional menjalani latihan intensif di pemusatan latihan menjelang pertandingan penting pekan depan. Pelatih menekankan kekompakan lini belakang dan efektivitas serangan balik.\n\nSejumlah pemain muda mendapat kesempatan menunjukkan kemampuan, sementara pemain senior diminta menjadi panutan di lapangan.'],
    ['Sports', 'sports-2', 'Turnamen bulu tangkis antarpelajar sukses digelar, ratusan atlet muda ambil bagian',
        'Ratusan pelajar dari berbagai daerah mengikuti turnamen bulu tangkis tingkat nasional. Selain mencari juara, ajang ini menjadi tempat pemandu bakat mencari atlet berprestasi untuk dibina lebih lanjut.\n\nPanitia berharap kegiatan serupa rutin diadakan agar regenerasi atlet tetap terjaga.'],
    ['Politics', 'politics-1', 'DPR bahas rancangan aturan baru terkait perlindungan data pribadi',
        'Komisi terkait di DPR mulai membahas rancangan aturan turunan mengenai perlindungan data pribadi. Pembahasan mencakup kewajiban penyelenggara layanan digital dalam mengelola dan mengamankan data pengguna.\n\nKelompok masyarakat sipil meminta proses pembahasan dibuka agar publik dapat memberi masukan.'],
    ['Politics', 'politics-2', 'Pemerintah daerah gelar musyawarah rencana pembangunan bersama warga',
        'Pemerintah daerah mengundang tokoh masyarakat, pemuda, dan perwakilan perempuan dalam musyawarah rencana pembangunan. Usulan warga mencakup perbaikan jalan, drainase, dan fasilitas kesehatan.\n\nHasil musyawarah akan menjadi bahan penyusunan anggaran tahun depan.'],
    ['Entertainment', 'entertainment-1', 'Festival musik akhir tahun umumkan deretan penampil dan harga tiket',
        'Panitia festival musik tahunan mengumumkan daftar penampil, mulai dari band indie hingga musisi papan atas. Penjualan tiket tahap pertama dibuka dengan harga khusus selama sepekan.\n\nSelain panggung musik, festival juga menghadirkan bazar kuliner dan pameran karya seniman lokal.'],
    ['Entertainment', 'entertainment-2', 'Film animasi karya sineas lokal tembus festival internasional',
        'Sebuah film animasi pendek karya sineas lokal terpilih untuk diputar di festival film internasional. Film berdurasi 12 menit itu bercerita tentang persahabatan anak-anak di kampung pesisir.\n\nSutradara berharap pencapaian ini membuka peluang bagi lebih banyak animator Indonesia untuk berkarya.'],
];

(async () => {
    try {
        await createTables();
        fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });

        let user = (await pool.query('SELECT id FROM users WHERE email = $1', [DEMO_USER.email])).rows[0];
        if (!user) {
            const hash = await bcrypt.hash(DEMO_USER.password, 10);
            user = (await pool.query(
                'INSERT INTO users (username, email, password) VALUES ($1,$2,$3) RETURNING id',
                [DEMO_USER.username, DEMO_USER.email, hash])).rows[0];
        }

        let added = 0;
        for (const [category, img, title, content] of NEWS) {
            const exists = await pool.query('SELECT 1 FROM news WHERE title = $1', [title]);
            if (exists.rows.length) continue;
            const filename = `seed-${img}.jpg`;
            fs.copyFileSync(path.join(__dirname, 'seed-images', `${img}.jpg`), path.join(__dirname, 'uploads', filename));
            // Jarak waktu berbeda-beda supaya urutan "terbaru" terlihat natural
            await pool.query(
                `INSERT INTO news (title, content, category, media_url, media_type, user_id, created_at, updated_at)
                 VALUES ($1,$2,$3,$4,'image',$5, NOW() - ($6 || ' hours')::interval, NOW() - ($6 || ' hours')::interval)`,
                [title, content, category, `/uploads/${filename}`, user.id, String(added * 5 + 1)]);
            added++;
        }
        console.log(`Selesai. ${added} berita contoh ditambahkan.`);
        console.log(`Akun demo -> email: ${DEMO_USER.email} | password: ${DEMO_USER.password}`);
    } catch (e) {
        console.error('Seed gagal:', e.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
})();
