import Link from "next/link";
import { ClockIcon, MapPinIcon, MonitorIcon } from "lucide-react";
import { DoctorAvatar } from "@/components/doctor-avatar";
import { QueueToday } from "@/components/queue-today";
import { buttonVariants } from "@/components/ui/button";
import { PUBLIC_COLUMNS, type PublicAntrean } from "@/lib/antrean-live";
import { ringkasJadwal } from "@/lib/jadwal";
import { createPublicClient } from "@/lib/supabase/public";
import { addDays, dayOfWeek, formatJam, formatTanggalPendek, todayWib } from "@/lib/time";

// Data antrean harus segar setiap kali dibuka.
export const dynamic = "force-dynamic";

const KLINIK = {
  nama: "Klinik AntreSehat",
  alamat: "Jl. Melati Raya No. 12, Kota Bekasi", // fiktif
  jam: "Senin–Sabtu, 08.00–20.00",
};

async function loadData(today: string) {
  const db = createPublicClient();
  if (!db) return null;

  const [polis, dokters, jadwal, libur, antrean] = await Promise.all([
    db.from("polis").select("id, nama, kode_prefix, warna").eq("aktif", true).order("nama"),
    db.from("dokters").select("id, poli_id, nama, spesialis, foto_url").eq("aktif", true).order("nama"),
    db.from("jadwal_praktik").select("dokter_id, hari, jam_mulai, jam_selesai").eq("aktif", true),
    db.from("libur").select("tanggal, dokter_id, keterangan").gte("tanggal", today).lte("tanggal", addDays(today, 6)).order("tanggal"),
    db.from("antrean").select(PUBLIC_COLUMNS).eq("tanggal", today),
  ]);
  if (polis.error || dokters.error || jadwal.error || libur.error || antrean.error) return null;

  return { polis: polis.data, dokters: dokters.data, jadwal: jadwal.data, libur: libur.data, antrean: antrean.data as unknown as PublicAntrean[] };
}

// Poli dengan dokter terbanyak (biasanya Umum) tampil pertama.
function urutkanPoli<P extends { id: string; nama: string }>(polis: P[], dokters: { poli_id: string }[]) {
  const jumlah = (id: string) => dokters.filter((d) => d.poli_id === id).length;
  return [...polis].sort((a, b) => jumlah(b.id) - jumlah(a.id) || a.nama.localeCompare(b.nama));
}

export default async function Home() {
  const today = todayWib();
  const data = await loadData(today);
  const hariIni = dayOfWeek(today);
  const klinikLibur = data?.libur.find((l) => l.tanggal === today && l.dokter_id === null);

  return (
    <>
      {/* ───── Hero ───── */}
      <section className="grid gap-10 pt-12 sm:pt-16 md:grid-cols-[1.15fr_1fr] md:items-center md:gap-14">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{KLINIK.nama}</p>
          <h1 className="mt-3 max-w-[16ch] text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl">
            Ambil nomor dari rumah, datang saat giliran.
          </h1>
          <p className="mt-5 max-w-[46ch] text-base text-muted-foreground">
            Booking jadwal dokter dari HP, dapat nomor antrean, lalu pantau posisimu secara langsung. Tidak perlu
            menunggu berjam-jam di ruang tunggu.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/booking" className={buttonVariants({ size: "lg" })}>Booking Sekarang</Link>
            <Link href="/display" className={buttonVariants({ size: "lg", variant: "outline" })}>
              <MonitorIcon aria-hidden />
              Layar antrean
            </Link>
          </div>

          <dl className="mt-8 grid gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <dt><MapPinIcon className="size-4" aria-label="Alamat" /></dt>
              <dd>{KLINIK.alamat}</dd>
            </div>
            <div className="flex items-center gap-2">
              <dt><ClockIcon className="size-4" aria-label="Jam buka" /></dt>
              <dd>{klinikLibur ? `Hari ini libur — ${klinikLibur.keterangan || "klinik tutup"}` : KLINIK.jam}</dd>
            </div>
          </dl>
        </div>

        <QueueToday tanggal={today} polis={data ? urutkanPoli(data.polis, data.dokters) : null} initial={data?.antrean ?? []} />
      </section>

      {/* ───── Poli & dokter ───── */}
      <section aria-labelledby="poli-title" className="pt-20 sm:pt-24">
        <div className="max-w-2xl">
          <h2 id="poli-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">Poli & jadwal dokter</h2>
          <p className="mt-2 text-muted-foreground">Jadwal praktik 7 hari ke depan. Kuota tiap sesi terlihat saat booking.</p>
        </div>

        {!data ? (
          <p className="neu-inset mt-8 rounded-2xl p-5 text-sm text-muted-foreground">
            Data poli belum tersedia. Hubungkan Supabase dan jalankan seed (lihat README).
          </p>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            {urutkanPoli(data.polis, data.dokters).map((poli) => {
              const dokters = data.dokters.filter((d) => d.poli_id === poli.id);
              const sesiHariIni = data.jadwal.filter((j) => j.hari === hariIni && dokters.some((d) => d.id === j.dokter_id));
              const buka = !klinikLibur && sesiHariIni.length > 0;
              const jamHariIni = buka
                ? `${formatJam(sesiHariIni.map((s) => s.jam_mulai).sort()[0])}–${formatJam(sesiHariIni.map((s) => s.jam_selesai).sort().at(-1)!)}`
                : null;

              return (
                <article key={poli.id} className="neu-raised flex flex-col rounded-3xl p-5 sm:p-6">
                  <header className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span aria-hidden className="size-3 rounded-full" style={{ backgroundColor: poli.warna }} />
                      <h3 className="text-lg font-semibold tracking-tight">{poli.nama}</h3>
                    </div>
                    <span
                      className="neu-inset grid size-8 place-items-center rounded-lg text-sm font-semibold"
                      title={`Nomor antrean ${poli.kode_prefix}-001, ${poli.kode_prefix}-002, …`}
                      aria-label={`Kode antrean ${poli.kode_prefix}`}
                    >
                      {poli.kode_prefix}
                    </span>
                  </header>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {buka ? `Buka hari ini, ${jamHariIni}` : "Tutup hari ini"}
                  </p>

                  <ul className="mt-5 grid gap-4">
                    {dokters.map((d) => {
                      const cuti = data.libur.filter((l) => l.dokter_id === d.id || l.dokter_id === null);
                      const ringkas = ringkasJadwal(data.jadwal.filter((j) => j.dokter_id === d.id));
                      return (
                        <li key={d.id} className="neu-inset rounded-2xl p-4">
                          <div className="flex items-center gap-3">
                            <DoctorAvatar nama={d.nama} fotoUrl={d.foto_url} />
                            <div className="min-w-0">
                              <p className="truncate font-medium">{d.nama}</p>
                              <p className="text-xs text-muted-foreground">{d.spesialis}</p>
                            </div>
                          </div>

                          {ringkas.length > 0 && (
                            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                              {ringkas.map((r) => (
                                <div key={r.hari} className="contents">
                                  <dt className="text-muted-foreground">{r.hari}</dt>
                                  <dd className="flex flex-wrap gap-x-2 tabular-nums">
                                    {r.jam.split(" · ").map((j) => (
                                      <span key={j} className="whitespace-nowrap">{j}</span>
                                    ))}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          )}

                          {cuti.length > 0 && (
                            <p className="mt-3 text-xs font-medium text-destructive">
                              Tidak praktik: {cuti.map((c) => formatTanggalPendek(c.tanggal)).join(", ")}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
