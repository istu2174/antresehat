// Semua waktu memakai Asia/Jakarta (PRD aturan 8), di server maupun browser.
export const TZ = "Asia/Jakarta";

export const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"] as const;
export const HARI_SINGKAT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"] as const;

/** Tanggal hari ini di WIB, format YYYY-MM-DD. */
export function todayWib(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(now);
}

/** Geser tanggal YYYY-MM-DD sebanyak n hari. */
export function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
}

/** 0 = Minggu … 6 = Sabtu (sama dengan jadwal_praktik.hari). */
export function dayOfWeek(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** "08:00:00" → "08.00" (gaya penulisan jam Indonesia). */
export function formatJam(time: string): string {
  return time.slice(0, 5).replace(":", ".");
}

/** "2026-11-23" → "Senin, 23 Nov". */
export function formatTanggalPendek(date: string): string {
  return new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" })
    .format(new Date(`${date}T00:00:00Z`));
}
