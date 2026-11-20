import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { addDays, formatTanggalPendek, todayWib } from "@/lib/time";
import { cn } from "@/lib/utils";
import { HapusLibur, LiburDialog } from "../forms";

export const metadata = { title: "Hari libur & cuti" };

const NAMA_HARI = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

export default async function Page({ searchParams }: { searchParams: Promise<{ bulan?: string }> }) {
  const today = todayWib();
  const { bulan: q } = await searchParams;
  const bulan = q && /^\d{4}-(0[1-9]|1[0-2])$/.test(q) ? q : today.slice(0, 7);
  const [th, bl] = bulan.split("-").map(Number);
  const awal = `${bulan}-01`;
  const jumlahHari = new Date(Date.UTC(th, bl, 0)).getUTCDate();
  const akhir = `${bulan}-${String(jumlahHari).padStart(2, "0")}`;
  const geserBulan = (n: number) => new Date(Date.UTC(th, bl - 1 + n, 1)).toISOString().slice(0, 7);

  const supabase = await createClient();
  const [{ data: libur }, { data: dokters }, { data: mendatang }] = await Promise.all([
    supabase.from("libur").select("id, tanggal, keterangan, dokters(nama)").gte("tanggal", awal).lte("tanggal", akhir),
    supabase.from("dokters").select("id, nama").eq("aktif", true).order("nama"),
    supabase.from("libur").select("id, tanggal, keterangan, dokters(nama)").gte("tanggal", today).order("tanggal").limit(30),
  ]);

  // Kalender Senin–Minggu: kotak kosong sebelum tanggal 1.
  const offset = (new Date(`${awal}T00:00:00Z`).getUTCDay() + 6) % 7;
  const sel = [...Array(offset).fill(null), ...Array.from({ length: jumlahHari }, (_, i) => addDays(awal, i))];
  const judulBulan = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${awal}T00:00:00Z`));

  return (
    <section aria-labelledby="judul">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="judul" className="text-2xl font-semibold tracking-tight">Hari libur & cuti</h1>
          <p className="mt-1 text-sm text-muted-foreground">Tanggal libur tidak bisa dipilih saat booking.</p>
        </div>
        <LiburDialog dokters={dokters ?? []} tanggalAwal={today} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="neu-raised rounded-3xl p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <Link href={`?bulan=${geserBulan(-1)}`} aria-label="Bulan sebelumnya" className="neu-raised-sm grid size-9 place-items-center rounded-lg">
              <ChevronLeftIcon className="size-4" aria-hidden />
            </Link>
            <h2 className="font-semibold capitalize tracking-tight">{judulBulan}</h2>
            <Link href={`?bulan=${geserBulan(1)}`} aria-label="Bulan berikutnya" className="neu-raised-sm grid size-9 place-items-center rounded-lg">
              <ChevronRightIcon className="size-4" aria-hidden />
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-7 gap-1.5 text-center text-xs text-muted-foreground" aria-hidden>
            {NAMA_HARI.map((h) => <span key={h}>{h}</span>)}
          </div>
          <ol className="mt-1.5 grid grid-cols-7 gap-1.5">
            {sel.map((tgl, i) => {
              if (!tgl) return <li key={`x${i}`} aria-hidden />;
              const isi = (libur ?? []).filter((l) => l.tanggal === tgl);
              return (
                <li
                  key={tgl}
                  className={cn(
                    "min-h-20 rounded-xl p-1.5 text-left text-[11px] leading-tight",
                    isi.length ? "neu-inset" : "neu-raised-sm",
                    tgl < today && "opacity-50",
                  )}
                >
                  <span className={cn("block text-xs tabular-nums", tgl === today ? "font-bold" : "text-muted-foreground")}>
                    {Number(tgl.slice(8))}
                    <span className="sr-only"> {formatTanggalPendek(tgl)}</span>
                  </span>
                  {isi.map((l) => (
                    <span key={l.id} className="mt-1 block truncate font-medium" title={l.keterangan}>
                      {l.dokters ? `Cuti ${l.dokters.nama}` : "Klinik libur"}
                    </span>
                  ))}
                </li>
              );
            })}
          </ol>
        </div>

        <aside className="neu-raised h-fit rounded-3xl p-5">
          <h2 className="font-semibold tracking-tight">Mendatang</h2>
          {!mendatang?.length ? (
            <p className="mt-3 text-sm text-muted-foreground">Belum ada libur terjadwal.</p>
          ) : (
            <ul className="mt-3 grid gap-2">
              {mendatang.map((l) => (
                <li key={l.id} className="neu-raised-sm flex items-start justify-between gap-2 rounded-xl p-3 text-sm">
                  <span className="min-w-0">
                    <span className="block text-xs text-muted-foreground">{formatTanggalPendek(l.tanggal)}</span>
                    <span className="block truncate font-medium">{l.dokters ? `Cuti ${l.dokters.nama}` : "Klinik libur"}</span>
                    <span className="block truncate text-xs text-muted-foreground">{l.keterangan}</span>
                  </span>
                  <HapusLibur id={l.id} />
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </section>
  );
}
