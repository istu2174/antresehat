import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRightIcon } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { labelSesi, STATUS_AKTIF } from "@/lib/antrean";
import { createClient } from "@/lib/supabase/server";
import { formatTanggalPendek, todayWib } from "@/lib/time";

export const metadata: Metadata = { title: "Riwayat" };

export default async function RiwayatPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("antrean")
    .select(
      "id, kode_tiket, tanggal, nomor_label, status, polis(nama, warna), dokters(nama), jadwal_praktik(jam_mulai, jam_selesai), kunjungan(diagnosis, icd10, tindakan, resep, saran)",
    )
    .eq("pasien_id", user.id)
    .order("tanggal", { ascending: false })
    .order("nomor", { ascending: false })
    .limit(100);

  const today = todayWib();
  const semua = data ?? [];
  const aktif = semua.filter((a) => STATUS_AKTIF.includes(a.status) && a.tanggal >= today).reverse();
  const lalu = semua.filter((a) => !aktif.includes(a));

  return (
    <div className="mx-auto max-w-xl pt-8 sm:pt-12">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Riwayat</h1>
          <p className="mt-1 text-sm text-muted-foreground">Booking dan kunjunganmu.</p>
        </div>
        <Link href="/booking" className={buttonVariants({ size: "sm" })}>Booking baru</Link>
      </div>

      {error && (
        <p role="alert" className="neu-inset mt-8 rounded-2xl p-5 text-sm text-destructive">Riwayat gagal dimuat. Muat ulang halaman ini.</p>
      )}

      {!error && semua.length === 0 && (
        <div className="neu-inset mt-8 rounded-3xl p-8 text-center">
          <p className="font-medium">Belum ada booking</p>
          <p className="mt-1 text-sm text-muted-foreground">Nomor antrean pertamamu akan muncul di sini.</p>
        </div>
      )}

      {aktif.length > 0 && (
        <section aria-labelledby="aktif-title" className="mt-8">
          <h2 id="aktif-title" className="text-sm font-semibold text-muted-foreground">Aktif</h2>
          <ul className="mt-3 grid gap-3">
            {aktif.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/tiket/${a.kode_tiket}`}
                  className="neu-raised flex items-center gap-4 rounded-2xl p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring/60 active:neu-inset"
                >
                  <span className="neu-ink grid h-14 min-w-20 place-items-center rounded-xl px-3 text-xl font-semibold tabular-nums">
                    {a.nomor_label}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{a.polis?.nama} · {a.dokters?.nama}</span>
                    <span className="block text-sm text-muted-foreground">
                      {a.tanggal === today ? "Hari ini" : formatTanggalPendek(a.tanggal)}
                      {a.jadwal_praktik && `, ${labelSesi(a.jadwal_praktik)}`}
                    </span>
                    <StatusBadge status={a.status} className="mt-2" />
                  </span>
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {lalu.length > 0 && (
        <section aria-labelledby="lalu-title" className="mt-10">
          <h2 id="lalu-title" className="text-sm font-semibold text-muted-foreground">Sebelumnya</h2>
          <ul className="mt-3 grid gap-3">
            {lalu.map((a) => (
              <li key={a.id} className="neu-raised-sm rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">{formatTanggalPendek(a.tanggal)}</p>
                    <p className="mt-0.5 truncate font-medium">
                      <span className="tabular-nums">{a.nomor_label}</span> · {a.polis?.nama}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">{a.dokters?.nama}</p>
                  </div>
                  <StatusBadge status={a.status} />
                </div>

                {a.kunjungan && (
                  <details className="group mt-3">
                    <summary className="flex h-10 cursor-pointer list-none items-center justify-between rounded-xl px-3 text-sm font-medium neu-inset [&::-webkit-details-marker]:hidden">
                      Ringkasan dokter
                      <ChevronRightIcon className="size-4 transition-transform group-open:rotate-90" aria-hidden />
                    </summary>
                    <dl className="mt-3 grid gap-3 px-1 text-sm">
                      {[
                        ["Diagnosis", [a.kunjungan.diagnosis, a.kunjungan.icd10 && `(${a.kunjungan.icd10})`].filter(Boolean).join(" ")],
                        ["Tindakan", a.kunjungan.tindakan],
                        ["Resep", a.kunjungan.resep],
                        ["Saran", a.kunjungan.saran],
                      ]
                        .filter(([, v]) => v && v !== "-")
                        .map(([k, v]) => (
                          <div key={k}>
                            <dt className="text-xs text-muted-foreground">{k}</dt>
                            <dd className="mt-0.5">{v}</dd>
                          </div>
                        ))}
                    </dl>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
