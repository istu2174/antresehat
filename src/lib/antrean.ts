import type { Enums } from "@/lib/database.types";
import { formatJam } from "@/lib/time";

export type Status = Enums<"status_antrean">;

export const STATUS_LABEL: Record<Status, string> = {
  menunggu: "Menunggu",
  check_in: "Check-in",
  dipanggil: "Dipanggil",
  diperiksa: "Diperiksa",
  selesai: "Selesai",
  dilewati: "Dilewati",
  batal: "Batal",
  tidak_datang: "Tidak datang",
};

/** Aturan 1: "<prefix>-<3 digit>", sama dengan lpad() di ambil_nomor_antrean(). 7 → "U-007". */
export function formatNomor(prefix: string, nomor: number): string {
  return `${prefix}-${String(nomor).padStart(3, "0")}`;
}

export const STATUS_AKTIF: Status[] = ["menunggu", "check_in", "dipanggil", "diperiksa", "dilewati"];

/** Sesi ditentukan dari jam mulai: sebelum 12.00 pagi, selebihnya sore (PRD 5.2). */
export function namaSesi(jamMulai: string): "Pagi" | "Sore" {
  return Number(jamMulai.slice(0, 2)) < 12 ? "Pagi" : "Sore";
}

export function labelSesi(j: { jam_mulai: string; jam_selesai: string }): string {
  return `${namaSesi(j.jam_mulai)}, ${formatJam(j.jam_mulai)}–${formatJam(j.jam_selesai)}`;
}

/** "2026-11-21T02:30:00Z" → "09.30" WIB. */
export function formatJamWib(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jakarta" })
    .format(new Date(iso))
    .replace(":", ".");
}

// Kode error dari fungsi Postgres → pesan ramah.
const PESAN: Record<string, string> = {
  BELUM_MASUK: "Silakan masuk dulu.",
  AKSES_DITOLAK: "Kamu tidak punya akses untuk tindakan ini.",
  JADWAL_TIDAK_ADA: "Jadwal ini tidak tersedia. Pilih jadwal lain.",
  TANGGAL_DI_LUAR_JANGKAUAN: "Booking hanya bisa untuk hari ini sampai 7 hari ke depan.",
  BOOKING_DITUTUP: "Booking sesi ini sudah ditutup (30 menit sebelum sesi berakhir).",
  LIBUR: "Dokter tidak praktik di tanggal ini.",
  SUDAH_BOOKING: "Kamu sudah punya booking aktif di poli ini pada tanggal tersebut.",
  KUOTA_HABIS: "Kuota sesi ini baru saja habis. Pilih sesi atau tanggal lain.",
  TIKET_TIDAK_ADA: "Tiket tidak ditemukan.",
  TIDAK_BISA_DIBATALKAN: "Tiket ini tidak bisa dibatalkan lagi.",
  BATAS_BATAL_LEWAT: "Pembatalan hanya bisa sampai 1 jam sebelum sesi dimulai.",
};

export function pesanError(error: { message: string; code?: string }): string {
  if (PESAN[error.message]) return PESAN[error.message];
  if (error.code === "23505") return PESAN.SUDAH_BOOKING; // index unik bentrok
  return "Terjadi kesalahan. Coba lagi.";
}
