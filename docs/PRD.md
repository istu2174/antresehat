# PRD — AntreSehat

**Booking & antrean klinik online yang realtime.**
Versi 1.0 · Pemilik: Istu Amlu Baihaqqi · Status: siap dikerjakan

---

## 1. Ringkasan

AntreSehat adalah web app untuk klinik pratama / klinik kecil. Pasien booking jadwal dokter dari HP dan mendapat nomor antrean. Mereka bisa memantau posisi antrean secara **realtime**, jadi tidak perlu menunggu berjam-jam di ruang tunggu. Resepsionis memanggil pasien dari dashboard, dan layar TV di ruang tunggu menampilkan serta **menyuarakan** nomor yang dipanggil. Dokter mencatat hasil pemeriksaan singkat, sedangkan admin melihat laporan kunjungan dan waktu tunggu.

Tujuan portofolio: menunjukkan kemampuan di bidang baru (kesehatan), fitur **realtime**, alur multi-role, dan desain mobile-first. Demonya bisa dicoba HRD dalam 1 menit.

## 2. Masalah

| Masalah | Dampak |
|---|---|
| Pasien datang pagi lalu menunggu 1–3 jam tanpa tahu kapan dipanggil | Ruang tunggu penuh, pasien kesal |
| Antrean dicatat manual di buku/kertas | Nomor dobel, ada pasien terlewat, sulit direkap |
| Klinik tidak tahu jam sibuk dan rata-rata waktu tunggu | Sulit mengatur jadwal dokter |
| Pasien tidak datang (no-show) tapi slotnya tetap terkunci | Kuota terbuang |

## 3. Tujuan & Metrik Sukses

- Pasien bisa booking dalam **≤ 60 detik** dari halaman utama.
- Perubahan antrean tampil di semua layar dalam **≤ 2 detik** (realtime).
- Resepsionis memanggil pasien berikutnya dengan **1 klik**.
- Laporan menampilkan rata-rata waktu tunggu, jumlah kunjungan, dan tingkat no-show.
- HRD/reviewer bisa mencoba **semua role** lewat tombol "Masuk sebagai…" tanpa daftar.

## 4. Pengguna & Role

| Role | Kebutuhan utama |
|---|---|
| **Pasien** | Booking, ambil nomor, pantau antrean, riwayat kunjungan |
| **Resepsionis** | Check-in, daftar pasien walk-in, panggil/lewati/tunda nomor |
| **Dokter** | Lihat pasien hari ini, mulai & selesai periksa, catat hasil |
| **Admin Klinik** | Kelola poli, dokter, jadwal, kuota, hari libur; lihat laporan |
| **Layar Publik (tanpa login)** | Tampilan TV ruang tunggu: nomor yang dipanggil + suara |

## 5. Ruang Lingkup MVP

### 5.1 Publik (tanpa login)
- Landing page klinik: profil, daftar poli, dokter, dan jadwal praktik minggu ini.
- Status antrean hari ini per poli (nomor yang sedang dilayani, sisa antrean).
- `/display`: layar TV fullscreen. Menampilkan nomor yang sedang dipanggil per poli dan 5 panggilan terakhir. Ada suara panggilan otomatis via Web Speech API, misalnya *"Nomor antrean U-012, silakan ke Poli Umum"*, dan bunyi bel.

### 5.2 Pasien
- Daftar/masuk (email + password). Profil: nama, NIK opsional (disamarkan), tanggal lahir, jenis kelamin, no. HP.
- **Booking**: pilih poli → dokter → tanggal (hari ini s/d H+7) → sesi (pagi/sore). Sisa kuota terlihat. Jadwal yang penuh atau libur tidak bisa dipilih.
- Setelah booking: **tiket antrean** berisi nomor (mis. `U-012`), QR code, poli, dokter, tanggal/sesi, dan estimasi jam dilayani.
- **Pantau antrean realtime**: nomor yang sedang dilayani, posisi saya ("4 orang lagi"), dan estimasi waktu. Ada notifikasi di browser saat tinggal 3 nomor lagi dan saat dipanggil.
- Batalkan booking (maksimal 1 jam sebelum sesi dimulai).
- Riwayat kunjungan beserta ringkasan dari dokter.

### 5.3 Resepsionis
- Dashboard antrean hari ini, difilter per poli/dokter. Status: `MENUNGGU`, `CHECK-IN`, `DIPANGGIL`, `DIPERIKSA`, `SELESAI`, `DILEWATI`, `BATAL`, `TIDAK DATANG`.
- **Check-in**: scan QR tiket dari kamera atau ketik kode tiket.
- **Pasien walk-in**: daftarkan pasien yang datang langsung (cari pasien lama atau buat baru), lalu nomor langsung keluar.
- Tombol **Panggil berikutnya**, **Panggil ulang**, **Lewati** (pindah ke belakang / ditunda), dan **Tandai tidak datang**.
- Cetak/unduh tiket antrean walk-in (PDF ukuran struk 58mm).

### 5.4 Dokter
- Daftar pasien hari ini sesuai urutan antrean.
- **Mulai periksa** → form catatan kunjungan: keluhan, pemeriksaan (tensi, suhu, berat), diagnosis (teks + kode ICD-10 opsional dari daftar pendek), tindakan, resep (teks bebas), dan saran kontrol.
- **Selesai** → status menjadi SELESAI, durasi pemeriksaan tercatat otomatis.
- Riwayat kunjungan pasien sebelumnya, hanya baca.

### 5.5 Admin Klinik
- CRUD **Poli** (nama, kode prefix antrean, warna), **Dokter** (nama, spesialis, foto, poli), dan **Jadwal praktik** (hari, jam mulai–selesai, kuota per sesi, estimasi menit per pasien).
- **Hari libur / dokter cuti**: booking di tanggal tersebut otomatis ditutup, dan pasien yang sudah booking mendapat notifikasi.
- Kelola akun staf (resepsionis, dokter) dan reset password.
- **Laporan**: kunjungan per hari/poli/dokter, rata-rata waktu tunggu (booking → dipanggil) dan waktu periksa, persentase no-show, dan jam tersibuk (heatmap). Bisa diekspor ke Excel/CSV.
- Audit log: siapa melakukan apa dan kapan (panggil, lewati, ubah jadwal).

## 6. Aturan Bisnis

1. **Format nomor**: `<prefix poli>-<3 digit>`, misalnya `U-001` (Umum), `G-001` (Gigi), `A-001` (Anak). Nomor **di-reset tiap hari per poli**.
2. Urutan antrean: pasien booking dan walk-in masuk ke satu antrean per dokter per sesi, diurutkan berdasarkan nomor.
3. Satu pasien hanya boleh punya **1 booking aktif per poli per hari**.
4. Booking dibuka H-7 dan ditutup ketika kuota sesi habis atau 30 menit sebelum sesi berakhir.
5. **Estimasi waktu dilayani** = jam mulai sesi + (posisi antrean × estimasi menit per pasien). Kalau sesi sudah berjalan, estimasi memakai rata-rata durasi periksa hari itu.
6. Pasien yang **DILEWATI** dipindahkan ke 3 posisi berikutnya. Kalau dilewati 2×, statusnya berubah menjadi TIDAK DATANG.
7. Booking yang belum check-in sampai 15 menit setelah estimasinya otomatis ditandai **TIDAK DATANG**, dan kuotanya dikembalikan.
8. Semua waktu memakai zona **Asia/Jakarta (WIB)**.
9. Catatan medis hanya bisa dilihat oleh dokter, admin, dan pasien yang bersangkutan.

## 7. Kebutuhan Non-Fungsional

- **Realtime**: perubahan status antrean dikirim ke pasien, resepsionis, dan layar TV tanpa refresh (target ≤ 2 detik).
- **Mobile-first**: halaman pasien nyaman di layar 360px, sedangkan dashboard staf dioptimalkan untuk laptop/tablet.
- **Keamanan**: hak akses dicek di server/database (Row Level Security), bukan hanya disembunyikan di UI. Password di-hash dan semua input divalidasi (Zod).
- **Privasi**: NIK disamarkan (`3271********0001`). Semua data demo **fiktif**. Ada catatan *"Bukan untuk penggunaan medis sungguhan"*.
- **Aksesibilitas**: kontras cukup, ukuran huruf besar di layar TV, bisa dinavigasi dengan keyboard, dan ada label untuk pembaca layar.
- **Performa**: halaman pasien tampil < 2 detik di 4G; Lighthouse ≥ 90 (Performance & Accessibility).
- **Tanpa cold start**: deploy di Vercel + Supabase supaya demo langsung terbuka (tidak tidur seperti Render).

## 8. Teknologi

| Bagian | Pilihan |
|---|---|
| Frontend + Backend | Next.js 15 (App Router, Server Actions) + TypeScript strict |
| UI | Tailwind CSS + shadcn/ui, ikon lucide-react |
| Database & Auth | Supabase (PostgreSQL, Auth, Row Level Security) |
| Realtime | Supabase Realtime (Postgres Changes) |
| Validasi | Zod |
| QR | `qrcode` (generate), `@zxing/browser` atau `html5-qrcode` (scan) |
| Grafik | Recharts |
| Ekspor | `exceljs` (xlsx) + CSV |
| PDF tiket | `@react-pdf/renderer` atau `pdf-lib` |
| Suara panggilan | Web Speech API (`speechSynthesis`, suara `id-ID`) |
| Test | Vitest (aturan bisnis) + Playwright (alur booking → panggil) |
| Deploy | Vercel (web) + Supabase (database), CI dengan GitHub Actions |

## 9. Model Data (ringkas)

```
profiles        id (= auth.users.id), role [pasien|resepsionis|dokter|admin], nama, no_hp,
                tgl_lahir, jenis_kelamin, nik_terenkripsi, created_at
polis           id, nama, kode_prefix, warna, aktif
dokters         id, profile_id, poli_id, nama, spesialis, foto_url, aktif
jadwal_praktik  id, dokter_id, hari (0-6), jam_mulai, jam_selesai, kuota, menit_per_pasien
libur           id, tanggal, dokter_id (null = klinik libur), keterangan
antrean         id, kode_tiket (unik, untuk QR), tanggal, poli_id, dokter_id, jadwal_id,
                pasien_id, nomor (int), nomor_label ("U-012"), sumber [booking|walkin],
                status, jumlah_dilewati, estimasi_jam,
                waktu_booking, waktu_checkin, waktu_dipanggil, waktu_mulai, waktu_selesai
kunjungan       id, antrean_id, dokter_id, pasien_id, keluhan, tensi, suhu, berat,
                diagnosis, icd10, tindakan, resep, saran, created_at
audit_log       id, actor_id, aksi, entitas, entitas_id, data (jsonb), created_at
```

Index unik: `(tanggal, poli_id, nomor)` dan `(tanggal, poli_id, pasien_id)` untuk status aktif.
Nomor antrean dibuat lewat **fungsi Postgres dalam transaksi** supaya tidak dobel saat dua orang booking bersamaan.

## 10. Halaman / Route

| Route | Akses | Isi |
|---|---|---|
| `/` | publik | Landing, poli, dokter, status antrean hari ini |
| `/display` | publik | Layar TV ruang tunggu + suara |
| `/login`, `/daftar` | publik | Auth + tombol **Masuk sebagai (demo)** |
| `/booking` | pasien | Wizard 4 langkah |
| `/tiket/[kode]` | pasien | Tiket + QR + pantau realtime |
| `/riwayat` | pasien | Riwayat kunjungan |
| `/resepsionis` | resepsionis | Dashboard antrean, check-in, walk-in |
| `/dokter` | dokter | Pasien hari ini + form pemeriksaan |
| `/admin/*` | admin | Poli, dokter, jadwal, libur, staf, laporan, audit |

## 11. Akun Demo (seed)

| Role | Email | Password |
|---|---|---|
| Admin | admin@antresehat.test | demo1234 |
| Resepsionis | resepsionis@antresehat.test | demo1234 |
| Dokter Umum | dr.umum@antresehat.test | demo1234 |
| Dokter Gigi | dr.gigi@antresehat.test | demo1234 |
| Pasien | pasien@antresehat.test | demo1234 |

Seed berisi 3 poli (Umum, Gigi, Anak), 4 dokter dengan jadwal Senin–Sabtu, 20 pasien fiktif, antrean hari ini dalam berbagai status, dan riwayat 30 hari ke belakang supaya laporan langsung berisi.
Tombol **"Reset data demo"** (khusus admin) mengembalikan data ke kondisi awal.

## 12. Kriteria Penerimaan (contoh utama)

- [ ] Pasien booking Poli Umum hari ini → mendapat `U-xxx` dengan QR. Kuota berkurang 1.
- [ ] Dua booking bersamaan **tidak pernah** mendapat nomor yang sama (diuji dengan test paralel).
- [ ] Resepsionis klik "Panggil berikutnya" → status pasien jadi DIPANGGIL. Tiket pasien dan `/display` berubah ≤ 2 detik, lalu `/display` menyuarakan nomornya.
- [ ] Pasien tidak bisa membuka catatan kunjungan milik pasien lain, meskipun ID-nya diganti di URL atau API (dicek RLS).
- [ ] Dokter klik Selesai → durasi periksa tercatat dan muncul di laporan.
- [ ] Hari libur yang ditambahkan admin membuat tanggal itu tidak bisa dipilih saat booking.
- [ ] Laporan bisa diekspor ke `.xlsx` dengan angka yang sama dengan yang tampil di layar.
- [ ] Semua halaman pasien rapi di lebar 360px.

## 13. Di Luar Lingkup (v1)

Pembayaran online, integrasi BPJS/SATUSEHAT, telemedicine/video call, aplikasi Android native, notifikasi WhatsApp/SMS sungguhan (cukup notifikasi browser + tombol "kirim ke WhatsApp" berupa link `wa.me`), dan multi-cabang.

## 14. Tahapan Pengerjaan

| Tahap | Isi | Perkiraan |
|---|---|---|
| 1 | Setup proyek, Supabase, skema DB, RLS, seed, auth + login demo | 1–2 hari |
| 2 | Landing publik + wizard booking + tiket QR | 1–2 hari |
| 3 | Realtime antrean: tiket pasien, dashboard resepsionis, `/display` + suara | 2 hari |
| 4 | Halaman dokter + catatan kunjungan + riwayat | 1 hari |
| 5 | Admin: poli, dokter, jadwal, libur, staf, laporan + ekspor, audit log | 2 hari |
| 6 | Aturan otomatis (no-show, lewati), test, polish UI, deploy, README | 1–2 hari |

## 15. Untuk Portofolio

- Demo live di Vercel (tanpa cold start) + tombol "Masuk sebagai…" untuk tiap role.
- Skenario demo singkat di README: buka `/display` di satu tab dan `/resepsionis` di tab lain, lalu klik Panggil dan lihat layar TV berubah sambil bersuara.
- Screenshot untuk mockup: dashboard resepsionis (laptop) + tiket antrean pasien (HP).
