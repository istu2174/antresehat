import { addDays, todayWib } from "@/lib/time";

// Bentuk hasil fungsi Postgres public.laporan() (lihat migration 20261120000004_laporan.sql).
export type Laporan = {
  ringkasan: {
    total_antrean: number;
    kunjungan: number;
    tidak_datang: number;
    persen_tidak_datang: number;
    rata_tunggu_menit: number | null;
    rata_periksa_menit: number | null;
  };
  per_hari: { tanggal: string; kunjungan: number }[];
  per_poli: { poli: string; kunjungan: number }[];
  heatmap: { hari: number; jam: number; jumlah: number }[];
  detail: {
    tanggal: string;
    poli: string;
    dokter: string;
    antrean: number;
    kunjungan: number;
    tidak_datang: number;
    rata_tunggu_menit: number | null;
    rata_periksa_menit: number | null;
  }[];
};

export type FilterLaporan = { dari: string; sampai: string; poli: string; dokter: string };

const tgl = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const uuid = (v: unknown) => (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : "");

/** Baca filter dari query string; default 30 hari terakhir. */
export function bacaFilter(sp: Record<string, string | string[] | undefined>): FilterLaporan {
  const today = todayWib();
  const sampai = tgl(sp.sampai) ?? today;
  const dari = tgl(sp.dari) ?? addDays(sampai, -29);
  return { dari, sampai, poli: uuid(sp.poli), dokter: uuid(sp.dokter) };
}

export const argsRpc = (f: FilterLaporan) => ({
  p_dari: f.dari,
  p_sampai: f.sampai,
  p_poli_id: f.poli || undefined,
  p_dokter_id: f.dokter || undefined,
});

/** 48.3 → "48,3" (format layar = format ekspor CSV). */
export const angka = (n: number | null) => (n === null ? "—" : n.toLocaleString("id-ID", { maximumFractionDigits: 1 }));
