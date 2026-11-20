Kamu membantu saya membangun "AntreSehat", web app booking & antrean klinik yang realtime.
Spesifikasi lengkap ada di @docs/PRD.md — baca seluruhnya dan jadikan sumber kebenaran.
Urutan tahap ada di @docs/PROMPTS.md.

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

Desain (menggantikan "hijau-teal" di PROMPTS.md, atas permintaan pemilik):
- Neumorphism putih: permukaan #eceef1, bayangan ganda (terang kiri-atas, gelap kanan-bawah).
  Utility di src/app/globals.css: `neu-raised`, `neu-raised-sm`, `neu-inset`, `neu-ink`.
- Gradasi hitam (`neu-ink`) hanya untuk aksi utama & elemen penting (nomor antrean, tombol primer).
- Hindari "AI slop": tidak ada gradasi ungu/biru, emoji, ikon sparkle, blob dekoratif, copy generik.
  Tipografi Inter, angka antrean pakai `tabular-nums`, hierarki lewat ukuran & berat, bukan warna.
- Warna poli (dari DB) dipakai sebagai aksen kecil saja (titik/garis), bukan latar penuh.
