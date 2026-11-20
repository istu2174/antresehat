import type { Status } from "@/lib/antrean";
import { wib } from "@/lib/booking";

// Kolom antrean yang boleh dibaca anon (lihat grant di migration RLS) — tanpa pasien_id & kode_tiket.
export const PUBLIC_COLUMNS =
  "id, tanggal, poli_id, dokter_id, jadwal_id, nomor, nomor_label, sumber, status, urutan, jumlah_dilewati, estimasi_jam, waktu_dipanggil, waktu_mulai, waktu_selesai";

export type PublicAntrean = {
  id: string;
  tanggal: string;
  poli_id: string;
  dokter_id: string;
  jadwal_id: string;
  nomor: number;
  nomor_label: string;
  status: Status;
  urutan: number;
  jumlah_dilewati: number;
  estimasi_jam: string | null;
  waktu_dipanggil: string | null;
  waktu_mulai: string | null;
  waktu_selesai: string | null;
};

export const STATUS_MENUNGGU: Status[] = ["menunggu", "check_in", "dilewati"];
const STATUS_DILAYANI: Status[] = ["dipanggil", "diperiksa"];

type Change<T> = { eventType: "INSERT" | "UPDATE" | "DELETE"; new: Partial<T>; old: Partial<T> };

/**
 * Terapkan satu event Postgres Changes ke state lokal (upsert / hapus berdasarkan id).
 * Payload Realtime tidak membawa relasi (mis. profiles), jadi data lama digabung supaya tidak hilang.
 */
export function applyChange<T extends { id: string; tanggal: string }>(rows: T[], change: Change<T>, tanggal: string): T[] {
  if (change.eventType === "DELETE") return rows.filter((r) => r.id !== change.old.id);
  const lama = rows.find((r) => r.id === change.new.id);
  const row = { ...lama, ...change.new } as T;
  const tanpa = rows.filter((r) => r.id !== row.id);
  return row.tanggal === tanggal ? [...tanpa, row] : tanpa;
}

/** Nomor yang terakhir dipanggil/diperiksa di antara baris yang diberikan. */
export function sedangDilayani<T extends Pick<PublicAntrean, "status" | "waktu_dipanggil" | "nomor_label">>(rows: T[]): T | null {
  return (
    rows
      .filter((r) => STATUS_DILAYANI.includes(r.status) && r.waktu_dipanggil)
      .sort((a, b) => b.waktu_dipanggil!.localeCompare(a.waktu_dipanggil!))[0] ?? null
  );
}

/** Ringkasan per poli untuk widget "Antrean hari ini". */
export function ringkasPerPoli<P extends { id: string }>(
  polis: P[],
  rows: Pick<PublicAntrean, "poli_id" | "status" | "waktu_dipanggil" | "nomor_label">[],
) {
  return polis.map((p) => {
    const milik = rows.filter((r) => r.poli_id === p.id);
    return {
      ...p,
      dilayani: sedangDilayani(milik)?.nomor_label ?? null,
      sisa: milik.filter((r) => STATUS_MENUNGGU.includes(r.status)).length,
    };
  });
}

export type Posisi = {
  saya: PublicAntrean | null;
  dilayani: string | null;
  didepan: number;
  estimasi: Date | null;
};

/**
 * Posisi pasien di antrean sesinya + estimasi jam dilayani (aturan 5):
 * - sesi belum berjalan: jam mulai + posisi × menit per pasien
 * - sesi sudah berjalan: sekarang + antrean di depan × rata-rata durasi periksa hari itu
 *   (fallback ke menit per pasien kalau belum ada yang selesai)
 */
export function hitungPosisi(
  rows: PublicAntrean[],
  myId: string,
  jadwal: { jam_mulai: string; menit_per_pasien: number },
  now: Date,
): Posisi {
  const saya = rows.find((r) => r.id === myId) ?? null;
  if (!saya) return { saya: null, dilayani: null, didepan: 0, estimasi: null };

  const sesi = rows.filter((r) => r.jadwal_id === saya.jadwal_id);
  const dilayani = sedangDilayani(sesi);
  const menunggu = STATUS_MENUNGGU.includes(saya.status);
  const didepan = menunggu
    ? sesi.filter((r) => r.id !== saya.id && STATUS_MENUNGGU.includes(r.status) && r.urutan < saya.urutan).length
    : 0;

  if (!menunggu) return { saya, dilayani: dilayani?.nomor_label ?? null, didepan, estimasi: null };

  const selesai = sesi.filter((r) => r.status === "selesai" && r.waktu_mulai && r.waktu_selesai);
  const rataMenit = selesai.length
    ? selesai.reduce((n, r) => n + (Date.parse(r.waktu_selesai!) - Date.parse(r.waktu_mulai!)) / 60e3, 0) / selesai.length
    : jadwal.menit_per_pasien;

  const mulai = wib(saya.tanggal, jadwal.jam_mulai);
  const berjalan = now >= mulai && (dilayani !== null || selesai.length > 0);

  let estimasi: Date;
  if (berjalan) {
    estimasi = new Date(now.getTime() + (didepan + (dilayani ? 1 : 0)) * rataMenit * 60e3);
  } else {
    const posisi = sesi.filter((r) => r.id !== saya.id && !["batal", "tidak_datang"].includes(r.status) && r.urutan < saya.urutan).length;
    estimasi = new Date(Math.max(now.getTime(), mulai.getTime() + posisi * jadwal.menit_per_pasien * 60e3));
  }
  return { saya, dilayani: dilayani?.nomor_label ?? null, didepan, estimasi };
}

// ───────────── Resepsionis ─────────────

/** Status yang bisa dipanggil "Panggil berikutnya": sudah check-in, atau dilewati lalu digeser ke belakang. */
export const STATUS_SIAP_DIPANGGIL: Status[] = ["check_in", "dilewati"];

/**
 * Nomor berikutnya untuk satu dokter: sesi paling awal dulu, lalu urutan terkecil (aturan 2).
 * Yang belum check-in (MENUNGGU) dilompati karena belum ada di klinik.
 */
export function pilihBerikutnya<T extends { status: Status; urutan: number; jam_mulai: string }>(rows: T[]): T | null {
  return (
    rows
      .filter((r) => STATUS_SIAP_DIPANGGIL.includes(r.status))
      .sort((a, b) => a.jam_mulai.localeCompare(b.jam_mulai) || a.urutan - b.urutan)[0] ?? null
  );
}

/**
 * Aturan 6: pasien yang dilewati dipindah 3 posisi ke belakang di antrean sesinya.
 * `antre` = baris lain di sesi yang sama yang masih menunggu. Mengembalikan urutan baru.
 */
export function urutanSetelahLewati(urutan: number, antre: { urutan: number }[]): number {
  const dibelakang = antre.map((r) => r.urutan).filter((u) => u > urutan).sort((a, b) => a - b);
  if (dibelakang.length === 0) return urutan; // sudah paling belakang
  if (dibelakang.length < 4) return dibelakang[dibelakang.length - 1] + 1;
  return (dibelakang[2] + dibelakang[3]) / 2; // di antara posisi ke-3 dan ke-4 sesudahnya
}

/** Dilewati ke-2 kalinya → TIDAK DATANG (aturan 6). */
export const BATAS_DILEWATI = 2;

// Kolom untuk staf (termasuk data pasien — dilindungi RLS: hanya resepsionis/admin).
export const STAFF_COLUMNS =
  "id, tanggal, poli_id, dokter_id, jadwal_id, kode_tiket, nomor, nomor_label, sumber, status, urutan, jumlah_dilewati, estimasi_jam, waktu_booking, waktu_checkin, waktu_dipanggil, waktu_mulai, waktu_selesai, profiles(nama, no_hp)";

// Kolom untuk halaman dokter (RLS: dokter hanya melihat antreannya sendiri).
export const DOKTER_COLUMNS =
  "id, tanggal, poli_id, dokter_id, jadwal_id, pasien_id, nomor, nomor_label, sumber, status, urutan, jumlah_dilewati, estimasi_jam, waktu_checkin, waktu_dipanggil, waktu_mulai, waktu_selesai, profiles(nama, tgl_lahir, jenis_kelamin)";
