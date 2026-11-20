const SATUAN = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];

/** Angka 0–999 dalam kata bahasa Indonesia (12 → "dua belas"). Cukup untuk nomor antrean 3 digit. */
export function terbilang(n: number): string {
  if (n === 0) return "nol";
  if (n < 12) return SATUAN[n];
  if (n < 20) return `${SATUAN[n - 10]} belas`;
  if (n < 100) return [`${SATUAN[Math.floor(n / 10)]} puluh`, SATUAN[n % 10]].filter(Boolean).join(" ");
  const ratus = Math.floor(n / 100) === 1 ? "seratus" : `${SATUAN[Math.floor(n / 100)]} ratus`;
  return n % 100 === 0 ? ratus : `${ratus} ${terbilang(n % 100)}`;
}

/** "U-012" + "Poli Umum" → "Nomor antrean U, dua belas, silakan ke Poli Umum." */
export function kalimatPanggilan(nomorLabel: string, poli: string): string {
  const [prefix, angka] = nomorLabel.split("-");
  return `Nomor antrean ${prefix}, ${terbilang(Number(angka))}, silakan ke ${poli}.`;
}
