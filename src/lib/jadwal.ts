import { formatJam, HARI_SINGKAT } from "@/lib/time";

type Sesi = { hari: number; jam_mulai: string; jam_selesai: string };

/**
 * Meringkas jadwal mingguan satu dokter jadi baris yang mudah dibaca:
 * hari berurutan (Senin → Minggu) dengan jam yang sama digabung.
 * Contoh: [{ hari: "Sen–Jum", jam: "08.00–12.00 · 16.00–20.00" }, { hari: "Sab", jam: "08.00–12.00" }]
 */
export function ringkasJadwal(sesi: Sesi[]): { hari: string; jam: string }[] {
  const urutanHari = [1, 2, 3, 4, 5, 6, 0];
  const jamPerHari = urutanHari.map((h) =>
    sesi
      .filter((s) => s.hari === h)
      .sort((a, b) => a.jam_mulai.localeCompare(b.jam_mulai))
      .map((s) => `${formatJam(s.jam_mulai)}–${formatJam(s.jam_selesai)}`)
      .join(" · "),
  );

  const hasil: { hari: string; jam: string }[] = [];
  let i = 0;
  while (i < urutanHari.length) {
    if (!jamPerHari[i]) { i++; continue; }
    let j = i;
    while (j + 1 < urutanHari.length && jamPerHari[j + 1] === jamPerHari[i]) j++;
    const awal = HARI_SINGKAT[urutanHari[i]];
    const akhir = HARI_SINGKAT[urutanHari[j]];
    hasil.push({ hari: i === j ? awal : j === i + 1 ? `${awal}, ${akhir}` : `${awal}–${akhir}`, jam: jamPerHari[i] });
    i = j + 1;
  }
  return hasil;
}
