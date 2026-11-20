# Prompt Bertahap — AntreSehat

Cara pakai di VS Code (Claude Code / Copilot Chat / Cursor):

1. Buka folder `D:\agent ai\antresehat` di VS Code.
2. Pastikan `docs/PRD.md` ada di folder itu, karena semua prompt merujuk ke file tersebut.
3. Kirim **Prompt 0** sekali di awal. Setelah itu kirim prompt **satu per satu sesuai urutan**. Jangan lanjut sebelum tahap yang sedang dikerjakan jalan dan sudah kamu cek.
4. Setelah tiap tahap: jalankan app, coba fiturnya, lalu `git commit`.
5. Kalau ada error, kirim pesan error-nya ke AI dengan prompt **"Perbaiki"** (bagian paling bawah).

> Tips: kalau pakai Claude Code, simpan Prompt 0 sebagai `CLAUDE.md` di root proyek supaya otomatis terbaca di setiap sesi.

---

## Prompt 0 — Konteks proyek (kirim pertama / simpan sebagai CLAUDE.md)

```
Kamu membantu saya membangun "AntreSehat", web app booking & antrean klinik yang realtime.
Spesifikasi lengkap ada di @docs/PRD.md — baca seluruhnya dan jadikan sumber kebenaran.

Aturan kerja:
- Stack: Next.js 15 (App Router, Server Actions) + TypeScript strict, Tailwind + shadcn/ui,
  Supabase (Postgres, Auth, RLS, Realtime), Zod, Recharts, exceljs. Jangan ganti stack tanpa bertanya.
- Bahasa UI: Bahasa Indonesia. Nama variabel/kode: bahasa Inggris.
- Zona waktu selalu Asia/Jakarta.
- Keamanan dicek di database (RLS) dan server, bukan hanya disembunyikan di UI.
- Validasi semua input dengan Zod di server.
- Mobile-first untuk halaman pasien; dashboard staf untuk laptop/tablet.
- Kerjakan HANYA tahap yang saya minta. Di akhir tiap tahap: ringkas file yang diubah,
  cara menjalankan/mengecek, dan apa yang belum dikerjakan.
- Jangan menambah fitur di luar PRD. Kalau ada keputusan yang tidak jelas, tanya dulu.
- Tulis kode yang sederhana dan mudah dibaca; hindari abstraksi yang tidak perlu.
```

---

## Prompt 1 — Setup proyek

```
Tahap 1a: setup proyek.
- Buat proyek Next.js 15 + TypeScript strict + Tailwind + ESLint di folder ini (src/ directory, App Router).
- Pasang dan inisialisasi shadcn/ui (button, input, card, dialog, select, badge, table, tabs, toast, dropdown-menu).
- Pasang @supabase/supabase-js dan @supabase/ssr. Buat helper client untuk browser, server component,
  dan server action, plus middleware untuk refresh session.
- Buat .env.example berisi NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
- Buat layout dasar: font Inter, tema warna hijau-teal kalem (kesan klinik), header sederhana.
- Tulis README singkat cara menjalankan.
Jelaskan langkah yang harus saya lakukan sendiri di dashboard Supabase (buat project, ambil key).
```

## Prompt 2 — Skema database, RLS, dan seed

```
Tahap 1b: database. Ikuti bagian 9 (Model Data) dan 6 (Aturan Bisnis) di @docs/PRD.md.
- Buat migration SQL di supabase/migrations/: tabel profiles, polis, dokters, jadwal_praktik, libur,
  antrean, kunjungan, audit_log, lengkap dengan enum status, foreign key, index unik
  (tanggal, poli_id, nomor) dan unik parsial untuk 1 booking aktif per pasien per poli per hari.
- Trigger: buat row profiles otomatis saat user baru daftar (role default 'pasien').
- Fungsi Postgres `ambil_nomor_antrean(...)` yang membuat nomor berikutnya per poli per hari secara aman
  dari race condition (pakai lock/transaksi), cek kuota, cek libur, lalu insert antrean dan return row-nya.
- Row Level Security untuk SEMUA tabel sesuai role di PRD bagian 4 dan aturan 9
  (catatan medis hanya dokter, admin, dan pasien pemiliknya).
- Aktifkan Realtime untuk tabel antrean.
- Seed (supabase/seed.sql atau script TS dengan service role) sesuai bagian 11:
  5 akun demo, 3 poli, 4 dokter + jadwal Senin–Sabtu, 20 pasien fiktif, antrean hari ini
  dalam berbagai status, dan riwayat kunjungan 30 hari ke belakang.
- Generate tipe TypeScript dari database.
Beri cara menjalankan migration + seed, dan satu query SQL untuk mengecek RLS bekerja.
```

## Prompt 3 — Auth + login demo

```
Tahap 1c: autentikasi.
- Halaman /login dan /daftar (email + password) dengan validasi Zod dan pesan error Bahasa Indonesia.
- Di /login tambahkan panel "Masuk sebagai (demo)" berisi tombol untuk tiap akun demo
  (Admin, Resepsionis, Dokter Umum, Dokter Gigi, Pasien) — sekali klik langsung login.
- Setelah login, arahkan sesuai role: pasien → /booking, resepsionis → /resepsionis,
  dokter → /dokter, admin → /admin.
- Middleware/guard: role yang salah dilempar ke halaman miliknya, yang belum login ke /login.
- Halaman profil pasien (nama, no HP, tgl lahir, jenis kelamin, NIK disamarkan saat ditampilkan).
- Tombol keluar di header.
```

## Prompt 4 — Landing publik

```
Tahap 2a: halaman publik "/".
- Hero klinik (nama "Klinik AntreSehat", alamat fiktif, jam buka) + tombol "Booking Sekarang".
- Kartu poli dengan warna masing-masing; daftar dokter (foto placeholder, spesialis, jadwal minggu ini).
- Widget "Antrean hari ini" per poli: nomor yang sedang dilayani + sisa antrean (data asli dari DB).
- Catatan kecil di footer: "Demo portofolio — data fiktif, bukan untuk penggunaan medis."
Desain bersih, mobile-first, aksesibel.
```

## Prompt 5 — Wizard booking + tiket QR

```
Tahap 2b: booking pasien. Ikuti PRD 5.2 dan aturan bisnis 3–5.
- /booking wizard 4 langkah dengan indikator progres: Poli → Dokter → Tanggal (hari ini s/d H+7,
  tanggal libur/penuh nonaktif) → Sesi (tampilkan sisa kuota) → Konfirmasi.
- Server action memanggil fungsi `ambil_nomor_antrean`; tangani error kuota habis / sudah punya booking
  dengan pesan yang ramah.
- Setelah sukses, redirect ke /tiket/[kode]: nomor besar (mis. U-012), QR code berisi kode tiket,
  poli, dokter, tanggal, sesi, estimasi jam dilayani, tombol "Simpan ke galeri" (unduh PNG)
  dan "Batalkan" (hanya jika ≥ 1 jam sebelum sesi).
- /riwayat: daftar booking & kunjungan pasien dengan statusnya.
```

## Prompt 6 — Antrean realtime (inti proyek)

```
Tahap 3a: realtime. Ini fitur paling penting — pastikan benar-benar realtime tanpa refresh.
- Buat hook `useAntreanRealtime(filter)` yang subscribe ke perubahan tabel antrean via Supabase Realtime
  dan memperbarui state lokal; reconnect otomatis kalau koneksi putus.
- Di /tiket/[kode]: tampilkan "Sedang dilayani: U-008", "Posisi kamu: 4 orang lagi", estimasi waktu
  (aturan bisnis 5), dan status besar berwarna. Minta izin Notification API lalu kirim notifikasi saat
  tinggal 3 nomor dan saat DIPANGGIL (plus getar di HP jika didukung).
Jelaskan cara saya mengetes dengan 2 tab browser.
```

## Prompt 7 — Dashboard resepsionis

```
Tahap 3b: /resepsionis. Ikuti PRD 5.3 dan aturan bisnis 6.
- Tabel antrean hari ini (realtime) dengan filter poli/dokter dan badge status berwarna.
- Tombol aksi: Panggil berikutnya (1 klik, mengambil nomor CHECK-IN terkecil), Panggil ulang,
  Lewati (pindah 3 posisi, setelah 2x jadi TIDAK DATANG), Tandai tidak datang.
  Semua aksi lewat server action yang mengecek role, menulis audit_log, dan mencatat timestamp.
- Check-in: scan QR pakai kamera (html5-qrcode / @zxing/browser) atau input kode manual.
- Pasien walk-in: cari pasien (nama/no HP) atau buat baru → langsung dapat nomor.
- Unduh tiket walk-in sebagai PDF ukuran struk 58mm.
- Shortcut keyboard: Spasi = panggil berikutnya, R = panggil ulang.
```

## Prompt 8 — Layar TV /display + suara

```
Tahap 3c: /display (publik, tanpa login) untuk TV ruang tunggu.
- Layout fullscreen landscape: kartu besar per poli berisi nomor yang sedang dipanggil + nama dokter,
  panel "5 panggilan terakhir", jam & tanggal berjalan, nama klinik.
- Realtime: saat ada status DIPANGGIL baru, kartu poli itu berkedip/animasi, bunyi bel singkat,
  lalu suara Web Speech API bahasa Indonesia: "Nomor antrean U dua belas, silakan ke Poli Umum".
  Antre-kan pengumuman supaya tidak bertumpuk kalau ada 2 panggilan sekaligus.
- Tombol "Aktifkan suara" di awal (browser butuh interaksi pengguna sebelum boleh memutar audio).
- Huruf sangat besar & kontras tinggi; tidak ada scroll.
```

## Prompt 9 — Halaman dokter

```
Tahap 4: /dokter. Ikuti PRD 5.4.
- Daftar pasien hari ini milik dokter yang login, urut antrean, realtime.
- "Mulai periksa" → status DIPERIKSA + waktu_mulai; buka form catatan kunjungan: keluhan, tensi, suhu,
  berat, diagnosis (teks + pilih kode ICD-10 dari daftar pendek ±30 diagnosis umum), tindakan, resep, saran.
- "Selesai" → simpan kunjungan, status SELESAI, waktu_selesai (durasi dihitung otomatis).
- Panel samping: riwayat kunjungan pasien sebelumnya (hanya baca).
- Pastikan RLS: dokter hanya bisa menulis kunjungan untuk pasien di antreannya.
```

## Prompt 10 — Admin: master data

```
Tahap 5a: /admin. Ikuti PRD 5.5.
- Sidebar admin. CRUD Poli (nama, prefix, warna), Dokter (data + poli + akun login),
  Jadwal praktik (hari, jam, kuota, menit/pasien) dengan tampilan grid mingguan,
  Hari libur/cuti dokter (kalender) — saat ditambah, booking yang terdampak dibatalkan + pasien diberi tahu.
- Kelola akun staf (buat resepsionis/dokter, reset password) memakai service role di server saja.
- Halaman audit log dengan filter aksi & tanggal.
- Tombol "Reset data demo" (konfirmasi dulu) yang menjalankan ulang seed.
```

## Prompt 11 — Laporan

```
Tahap 5b: /admin/laporan.
- Filter rentang tanggal, poli, dokter.
- Kartu ringkasan: total kunjungan, rata-rata waktu tunggu (booking/check-in → dipanggil),
  rata-rata durasi periksa, persentase tidak datang.
- Grafik (Recharts): kunjungan per hari (line), per poli (bar), heatmap jam tersibuk (hari × jam).
- Tabel detail + ekspor .xlsx (exceljs) dan .csv dengan angka yang sama persis dengan di layar.
- Hitung agregasi di database (view/RPC), bukan di browser.
```

## Prompt 12 — Aturan otomatis + test

```
Tahap 6a: otomatisasi & pengujian.
- Aturan bisnis 7 (auto TIDAK DATANG 15 menit lewat estimasi): pg_cron di Supabase, atau Vercel Cron
  yang memanggil route API terproteksi secret. Kembalikan kuota.
- Vitest untuk logika murni: format nomor, perhitungan estimasi, aturan lewati, validasi Zod.
- Test konkurensi: 20 booking paralel ke sesi yang sama → semua nomor unik & tidak melebihi kuota.
- Playwright E2E: pasien booking → resepsionis check-in & panggil → tiket pasien berubah DIPANGGIL
  → dokter selesai → muncul di riwayat pasien.
- GitHub Actions: lint + typecheck + vitest di setiap push.
```

## Prompt 13 — Polish, deploy, README

```
Tahap 6b: siap portofolio.
- Rapikan UI: loading skeleton, empty state, toast sukses/gagal, halaman 404, favicon & manifest PWA.
- Cek semua halaman pasien di lebar 360px dan perbaiki yang berantakan. Target Lighthouse ≥ 90.
- Panduan deploy ke Vercel (env vars, domain) + menjalankan migration & seed di Supabase production.
- README lengkap: deskripsi, screenshot, fitur per role, stack, arsitektur singkat (diagram mermaid),
  akun demo, "Skenario demo 1 menit" (buka /display dan /resepsionis berdampingan lalu klik Panggil),
  cara menjalankan lokal, dan cara test.
- Badge GitHub Actions di README.
```

---

## Prompt cadangan

**Perbaiki error**
```
Ada error berikut saat <aksi yang saya lakukan>:
<tempel pesan error / screenshot>
Cari penyebab utamanya dulu (jangan tebak-tebakan), jelaskan singkat, lalu perbaiki.
Pastikan perbaikan tidak merusak tahap sebelumnya.
```

**Review sebelum lanjut tahap**
```
Review semua perubahan di tahap ini terhadap @docs/PRD.md: apa yang belum sesuai, bug yang mungkin
muncul, dan celah keamanan (terutama RLS dan pengecekan role). Perbaiki yang penting saja.
```

**Cek tampilan HP**
```
Periksa semua halaman pasien di lebar 360px dan 390px. Perbaiki teks yang terpotong, tombol yang terlalu
kecil (minimal 44px), dan elemen yang membuat halaman bisa di-scroll ke samping.
```
