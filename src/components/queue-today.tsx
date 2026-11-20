"use client";

import { useAntreanRealtime } from "@/hooks/use-antrean-realtime";
import { ringkasPerPoli, type PublicAntrean } from "@/lib/antrean-live";
import { formatTanggalPendek } from "@/lib/time";

type Poli = { id: string; nama: string; warna: string };

// Ringkasan antrean hari ini per poli; data awal dari server, lalu diperbarui lewat Realtime.
export function QueueToday({ tanggal, polis: daftarPoli, initial }: { tanggal: string; polis: Poli[] | null; initial: PublicAntrean[] }) {
  const { rows } = useAntreanRealtime({ tanggal }, { initial });
  const polis = daftarPoli && ringkasPerPoli(daftarPoli, rows);
  return (
    <section aria-labelledby="antrean-title" className="neu-raised rounded-3xl p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="antrean-title" className="text-base font-semibold tracking-tight">Antrean hari ini</h2>
        <p className="text-xs text-muted-foreground">{formatTanggalPendek(tanggal)}</p>
      </div>

      {polis === null ? (
        <p className="neu-inset mt-5 rounded-2xl p-4 text-sm text-muted-foreground">Data antrean belum tersedia.</p>
      ) : (
        <ul className="mt-5 grid gap-3">
          {polis.map((p) => (
            <li key={p.id} className="neu-inset flex items-center gap-4 rounded-2xl py-3 pr-3 pl-4">
              <span aria-hidden className="h-9 w-1 shrink-0 rounded-full" style={{ backgroundColor: p.warna }} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.nama}</p>
                <p className="text-xs text-muted-foreground">
                  {p.sisa > 0 ? `${p.sisa} orang menunggu` : "Tidak ada yang menunggu"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] tracking-wide text-muted-foreground uppercase">Dilayani</p>
                <p
                  className={
                    p.dilayani
                      ? "neu-ink mt-1 rounded-lg px-2.5 py-1 text-lg font-semibold tabular-nums tracking-tight"
                      : "mt-1 px-2.5 py-1 text-lg font-semibold text-muted-foreground"
                  }
                  aria-label={p.dilayani ? `Nomor ${p.dilayani}` : "Belum ada"}
                >
                  {p.dilayani ?? "—"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
