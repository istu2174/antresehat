import { DownloadIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { angka, argsRpc, bacaFilter, type Laporan } from "@/lib/laporan";
import { createClient } from "@/lib/supabase/server";
import { formatTanggalPendek } from "@/lib/time";
import { GrafikLaporan } from "./charts";

export const metadata = { title: "Laporan" };

const pilihCls =
  "neu-inset h-11 w-full rounded-xl border border-transparent bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/60";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const f = bacaFilter(await searchParams);
  const supabase = await createClient();
  const [{ data, error }, { data: polis }, { data: dokters }] = await Promise.all([
    supabase.rpc("laporan", argsRpc(f)),
    supabase.from("polis").select("id, nama, warna").order("nama"),
    supabase.from("dokters").select("id, nama").order("nama"),
  ]);
  const lap = data as unknown as Laporan | null;
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  const r = lap?.ringkasan;

  return (
    <section aria-labelledby="judul">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="judul" className="text-2xl font-semibold tracking-tight">Laporan</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatTanggalPendek(f.dari)} – {formatTanggalPendek(f.sampai)}
          </p>
        </div>
        {lap && (
          <div className="flex gap-2">
            <a href={`/admin/laporan/ekspor?format=xlsx&${qs}`} className={buttonVariants()}>
              <DownloadIcon aria-hidden />
              Excel
            </a>
            <a href={`/admin/laporan/ekspor?format=csv&${qs}`} className={buttonVariants({ variant: "outline" })}>
              CSV
            </a>
          </div>
        )}
      </div>

      <form className="neu-raised mt-6 grid gap-3 rounded-3xl p-4 sm:grid-cols-2 lg:grid-cols-[9.5rem_9.5rem_1fr_1fr_auto] lg:items-end">
        <div className="grid gap-1.5">
          <label htmlFor="dari" className="text-xs text-muted-foreground">Dari</label>
          <Input id="dari" name="dari" type="date" defaultValue={f.dari} />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="sampai" className="text-xs text-muted-foreground">Sampai</label>
          <Input id="sampai" name="sampai" type="date" defaultValue={f.sampai} />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="poli" className="text-xs text-muted-foreground">Poli</label>
          <select id="poli" name="poli" defaultValue={f.poli} className={pilihCls}>
            <option value="">Semua poli</option>
            {(polis ?? []).map((p) => <option key={p.id} value={p.id}>{p.nama}</option>)}
          </select>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="dokter" className="text-xs text-muted-foreground">Dokter</label>
          <select id="dokter" name="dokter" defaultValue={f.dokter} className={pilihCls}>
            <option value="">Semua dokter</option>
            {(dokters ?? []).map((d) => <option key={d.id} value={d.id}>{d.nama}</option>)}
          </select>
        </div>
        <button type="submit" className={buttonVariants({ size: "lg" })}>Terapkan</button>
      </form>

      {error || !lap || !r ? (
        <p role="alert" className="neu-inset mt-6 rounded-2xl p-5 text-sm text-destructive">
          {error?.message === "RENTANG_TIDAK_VALID" ? "Rentang tanggal tidak valid (maksimal 1 tahun, tanggal akhir setelah tanggal awal)." : "Laporan gagal dimuat."}
        </p>
      ) : (
        <>
          <dl className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              ["Total kunjungan", angka(r.kunjungan), `dari ${angka(r.total_antrean)} antrean`],
              ["Rata-rata waktu tunggu", r.rata_tunggu_menit === null ? "—" : `${angka(r.rata_tunggu_menit)} mnt`, "check-in (atau booking) → dipanggil"],
              ["Rata-rata durasi periksa", r.rata_periksa_menit === null ? "—" : `${angka(r.rata_periksa_menit)} mnt`, "mulai → selesai periksa"],
              ["Tidak datang", `${angka(r.persen_tidak_datang)}%`, `${angka(r.tidak_datang)} pasien`],
            ].map(([k, v, sub]) => (
              <div key={k} className="neu-raised rounded-3xl p-5">
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{v}</dd>
                <dd className="mt-1 text-xs text-muted-foreground">{sub}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6">
            <GrafikLaporan data={lap} polis={polis ?? []} />
          </div>

          <section aria-labelledby="detail-title" className="neu-raised mt-6 rounded-3xl p-4 sm:p-5">
            <h2 id="detail-title" className="font-semibold tracking-tight">Detail per hari & dokter</h2>
            <p className="text-xs text-muted-foreground">Angka yang sama persis dengan file Excel/CSV.</p>
            {lap.detail.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">Tidak ada data untuk filter ini.</p>
            ) : (
              <div className="mt-4 max-h-[32rem] overflow-auto">
                <table className="w-full min-w-[48rem] text-sm">
                  <thead className="sticky top-0 bg-background">
                    <tr className="text-left text-xs text-muted-foreground">
                      <th scope="col" className="py-2 pr-3 font-medium">Tanggal</th>
                      <th scope="col" className="py-2 pr-3 font-medium">Poli</th>
                      <th scope="col" className="py-2 pr-3 font-medium">Dokter</th>
                      <th scope="col" className="py-2 pr-3 text-right font-medium">Antrean</th>
                      <th scope="col" className="py-2 pr-3 text-right font-medium">Kunjungan</th>
                      <th scope="col" className="py-2 pr-3 text-right font-medium">Tidak datang</th>
                      <th scope="col" className="py-2 pr-3 text-right font-medium">Tunggu (mnt)</th>
                      <th scope="col" className="py-2 text-right font-medium">Periksa (mnt)</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {lap.detail.map((d) => (
                      <tr key={`${d.tanggal}-${d.dokter}`} className="border-t border-black/5">
                        <td className="py-2 pr-3 whitespace-nowrap">{formatTanggalPendek(d.tanggal)}</td>
                        <td className="py-2 pr-3">{d.poli}</td>
                        <td className="py-2 pr-3">{d.dokter}</td>
                        <td className="py-2 pr-3 text-right">{angka(d.antrean)}</td>
                        <td className="py-2 pr-3 text-right">{angka(d.kunjungan)}</td>
                        <td className="py-2 pr-3 text-right">{angka(d.tidak_datang)}</td>
                        <td className="py-2 pr-3 text-right">{angka(d.rata_tunggu_menit)}</td>
                        <td className="py-2 text-right">{angka(d.rata_periksa_menit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
