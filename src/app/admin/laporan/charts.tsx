"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { angka, type Laporan } from "@/lib/laporan";
import { HARI } from "@/lib/time";

// Palet tervalidasi (skill dataviz): kategori lolos uji buta warna bila dipakai berurutan,
// sekuensial = satu hue biru terang → gelap. Teks tetap tinta, bukan warna seri.
const TINTA = "#16181b";
const GRID = "rgb(22 24 27 / 0.08)";
const TEKS = "#5d636d";
const BIRU = "#2a78d6";
const KATEGORI = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
const SEKUENSIAL = ["#cde2fb", "#b7d3f6", "#9ec5f4", "#86b6ef", "#6da7ec", "#5598e7", "#3987e5", "#2a78d6", "#256abf", "#1c5cab", "#184f95", "#104281", "#0d366b"];
const LAINNYA = "#898781";

function hue(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

/**
 * Warna tetap per poli (ikut entitas, bukan peringkat): tiap poli mendapat slot palet yang hue-nya
 * paling dekat dengan warna poli di DB, supaya serasi dengan titik warna di halaman lain.
 * Lebih dari 8 poli → abu-abu, bukan warna baru.
 */
function warnaPoli(polis: { nama: string; warna: string }[]): Map<string, string> {
  const sisa = [...KATEGORI];
  const hasil = new Map<string, string>();
  for (const p of [...polis].sort((a, b) => a.nama.localeCompare(b.nama))) {
    if (!sisa.length) { hasil.set(p.nama, LAINNYA); continue; }
    const jarak = (c: string) => { const d = Math.abs(hue(c) - hue(p.warna)); return Math.min(d, 360 - d); };
    const pilih = sisa.reduce((a, b) => (jarak(b) < jarak(a) ? b : a));
    sisa.splice(sisa.indexOf(pilih), 1);
    hasil.set(p.nama, pilih);
  }
  return hasil;
}

const tanggalPendek = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

function Kotak({ judul, sub, children }: { judul: string; sub?: string; children: React.ReactNode }) {
  return (
    <figure className="neu-raised min-w-0 rounded-3xl p-5">
      <figcaption>
        <span className="block font-semibold tracking-tight">{judul}</span>
        {sub && <span className="block text-xs text-muted-foreground">{sub}</span>}
      </figcaption>
      <div className="mt-4">{children}</div>
    </figure>
  );
}

function TooltipIsi({ active, payload, label, fmtLabel }: { active?: boolean; payload?: { value: number }[]; label?: string; fmtLabel: (l: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="neu-raised-sm rounded-xl bg-background px-3 py-2 text-xs">
      <p className="text-muted-foreground">{fmtLabel(String(label))}</p>
      <p className="mt-0.5 font-semibold tabular-nums">{angka(payload[0].value)} kunjungan</p>
    </div>
  );
}

export function GrafikLaporan({ data, polis }: { data: Laporan; polis: { nama: string; warna: string }[] }) {
  const warna = warnaPoli(polis);
  const maxHeat = Math.max(1, ...data.heatmap.map((h) => h.jumlah));
  const jamAda = data.heatmap.map((h) => h.jam);
  const jamList = jamAda.length ? Array.from({ length: Math.max(...jamAda) - Math.min(...jamAda) + 1 }, (_, i) => Math.min(...jamAda) + i) : [];
  const nilai = (hari: number, jam: number) => data.heatmap.find((h) => h.hari === hari && h.jam === jam)?.jumlah ?? 0;
  const urutanHari = [1, 2, 3, 4, 5, 6, 0];

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="xl:col-span-2">
        <Kotak judul="Kunjungan per hari" sub="Antrean berstatus selesai">
          <div className="h-56" role="img" aria-label="Grafik garis jumlah kunjungan per hari. Angka lengkap ada di tabel detail.">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.per_hari} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="tanggal" tickFormatter={tanggalPendek} tick={{ fill: TEKS, fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis allowDecimals={false} tick={{ fill: TEKS, fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip content={<TooltipIsi fmtLabel={tanggalPendek} />} cursor={{ stroke: TEKS, strokeDasharray: "3 3" }} />
                <Area type="linear" dataKey="kunjungan" stroke={BIRU} strokeWidth={2} fill={BIRU} fillOpacity={0.12} dot={false} activeDot={{ r: 4, fill: BIRU, stroke: "#eceef1", strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Kotak>
      </div>

      <Kotak judul="Kunjungan per poli">
        <div className="h-56" role="img" aria-label={`Grafik batang kunjungan per poli: ${data.per_poli.map((p) => `${p.poli} ${p.kunjungan}`).join(", ")}.`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.per_poli} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 8 }} barCategoryGap={10}>
              <CartesianGrid stroke={GRID} horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fill: TEKS, fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="poli" width={84} tick={{ fill: TINTA, fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip content={<TooltipIsi fmtLabel={(l) => l} />} cursor={{ fill: "rgb(22 24 27 / 0.04)" }} />
              <Bar
                dataKey="kunjungan"
                radius={[0, 4, 4, 0]}
                maxBarSize={28}
                label={{ position: "right", fill: TINTA, fontSize: 12, formatter: (v: number) => angka(v) }}
              >
                {data.per_poli.map((p) => (
                  <Cell key={p.poli} fill={warna.get(p.poli) ?? LAINNYA} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Kotak>

      <Kotak judul="Jam tersibuk" sub="Jumlah pasien datang (check-in) per hari × jam, WIB">
        {jamList.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada data.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-[3px] text-[11px]">
              <caption className="sr-only">Jumlah pasien datang per hari dan jam</caption>
              <thead>
                <tr>
                  <th scope="col" className="w-10" />
                  {jamList.map((j) => (
                    <th key={j} scope="col" className="font-normal text-muted-foreground tabular-nums">{String(j).padStart(2, "0")}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {urutanHari.map((h) => (
                  <tr key={h}>
                    <th scope="row" className="pr-1 text-left font-normal text-muted-foreground">{HARI[h].slice(0, 3)}</th>
                    {jamList.map((j) => {
                      const n = nilai(h, j);
                      // Sekuensial satu hue biru: makin banyak makin gelap.
                      const step = n ? Math.max(1, Math.round((n / maxHeat) * (SEKUENSIAL.length - 1))) : -1;
                      return (
                        <td
                          key={j}
                          title={`${HARI[h]} ${String(j).padStart(2, "0")}.00: ${n} pasien`}
                          className="h-7 min-w-6 rounded-[4px] text-center tabular-nums"
                          style={{
                            backgroundColor: step >= 0 ? SEKUENSIAL[step] : "rgb(22 24 27 / 0.03)",
                            color: step >= 8 ? "#ffffff" : "transparent",
                          }}
                        >
                          <span className="sr-only">{n}</span>
                          <span aria-hidden>{n || ""}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground" aria-hidden>
              Sedikit
              <span className="h-2 w-24 rounded-full" style={{ background: `linear-gradient(90deg, ${SEKUENSIAL[1]}, ${SEKUENSIAL[SEKUENSIAL.length - 1]})` }} />
              Banyak (maks {maxHeat})
            </p>
          </div>
        )}
      </Kotak>
    </div>
  );
}
