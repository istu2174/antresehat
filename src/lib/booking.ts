import { formatJamWib } from "@/lib/antrean";
import { addDays, dayOfWeek } from "@/lib/time";

type Jadwal = {
  id: string;
  dokter_id: string;
  hari: number;
  jam_mulai: string;
  jam_selesai: string;
  kuota: number;
  menit_per_pasien: number;
};
type Libur = { tanggal: string; dokter_id: string | null };
type Terpakai = { jadwal_id: string; tanggal: string; terisi: number };

export type SlotStatus = "ok" | "penuh" | "tutup" | "libur";
export type Slot = {
  jadwal_id: string;
  dokter_id: string;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  kuota: number;
  sisa: number;
  estimasi: string; // "09.30" WIB
  status: SlotStatus;
};

export const HARI_BOOKING = 8; // hari ini s/d H+7 (aturan 4)

/** Waktu WIB dari tanggal + jam lokal. */
export const wib = (tanggal: string, jam: string) => new Date(`${tanggal}T${jam.slice(0, 5)}:00+07:00`);

/**
 * Semua sesi yang bisa dipilih dalam 8 hari ke depan beserta statusnya.
 * Ini hanya untuk tampilan — fungsi ambil_nomor_antrean() tetap memeriksa ulang semuanya.
 */
export function hitungSlot(jadwal: Jadwal[], terpakai: Terpakai[], libur: Libur[], today: string, now: Date): Slot[] {
  const slots: Slot[] = [];
  for (let i = 0; i < HARI_BOOKING; i++) {
    const tanggal = addDays(today, i);
    for (const j of jadwal.filter((x) => x.hari === dayOfWeek(tanggal))) {
      const terisi = terpakai.find((t) => t.jadwal_id === j.id && t.tanggal === tanggal)?.terisi ?? 0;
      const mulai = wib(tanggal, j.jam_mulai);
      const tutupBooking = new Date(wib(tanggal, j.jam_selesai).getTime() - 30 * 60e3);

      let status: SlotStatus = "ok";
      if (libur.some((l) => l.tanggal === tanggal && (l.dokter_id === null || l.dokter_id === j.dokter_id))) status = "libur";
      else if (now >= tutupBooking) status = "tutup";
      else if (terisi >= j.kuota) status = "penuh";

      // Aturan 5: jam mulai + posisi × menit per pasien, tidak lebih awal dari sekarang.
      const estimasi = new Date(Math.max(now.getTime(), mulai.getTime() + terisi * j.menit_per_pasien * 60e3));

      slots.push({
        jadwal_id: j.id,
        dokter_id: j.dokter_id,
        tanggal,
        jam_mulai: j.jam_mulai,
        jam_selesai: j.jam_selesai,
        kuota: j.kuota,
        sisa: Math.max(0, j.kuota - terisi),
        estimasi: formatJamWib(estimasi.toISOString()),
        status,
      });
    }
  }
  return slots.sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.jam_mulai.localeCompare(b.jam_mulai));
}
