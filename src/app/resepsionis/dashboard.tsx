"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { FileTextIcon, Loader2Icon, MegaphoneIcon, RotateCcwIcon, SkipForwardIcon, UserXIcon } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { useAntreanRealtime, type LiveStatus } from "@/hooks/use-antrean-realtime";
import {
  checkIn,
  lewati,
  panggilBerikutnya,
  panggilUlang,
  tandaiTidakDatang,
  type AksiResult,
} from "@/lib/actions/resepsionis";
import { formatJamWib, labelSesi, type Status } from "@/lib/antrean";
import { sedangDilayani, STAFF_COLUMNS, STATUS_SIAP_DIPANGGIL } from "@/lib/antrean-live";
import { formatTanggalPendek } from "@/lib/time";
import { cn } from "@/lib/utils";
import { CheckInPanel } from "./check-in";
import { WalkinDialog } from "./walkin-dialog";


export type StaffRow = {
  id: string;
  tanggal: string;
  poli_id: string;
  dokter_id: string;
  jadwal_id: string;
  kode_tiket: string;
  nomor: number;
  nomor_label: string;
  sumber: "booking" | "walkin";
  status: Status;
  urutan: number;
  jumlah_dilewati: number;
  estimasi_jam: string | null;
  waktu_booking: string;
  waktu_checkin: string | null;
  waktu_dipanggil: string | null;
  waktu_mulai: string | null;
  waktu_selesai: string | null;
  profiles: { nama: string; no_hp: string | null } | null;
};

export type Sesi = { id: string; dokter_id: string; jam_mulai: string; jam_selesai: string };
export type DokterHariIni = { id: string; nama: string; poli_id: string; poli: string; warna: string; sesi: Sesi[] };

function Koneksi({ status }: { status: LiveStatus }) {
  const label = { live: "Langsung", connecting: "Menyambungkan…", offline: "Terputus, mencoba lagi…" }[status];
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
      <span
        aria-hidden
        className={cn(
          "size-2 rounded-full",
          status === "live" ? "bg-emerald-600 motion-safe:animate-pulse" : status === "offline" ? "bg-destructive" : "bg-muted-foreground",
        )}
      />
      {label}
    </span>
  );
}

/** Jalankan server action + tampilkan hasilnya sebagai toast. */
function useAksi() {
  const [pending, start] = useTransition();
  const jalankan = useCallback((fn: () => Promise<AksiResult>) => {
    start(async () => {
      const r = await fn();
      if (r.error) toast.error(r.error);
      else if (r.pesan) toast.success(r.pesan);
    });
  }, []);
  return { pending, jalankan };
}

export function Dashboard({
  tanggal,
  dokters,
  klinikLibur,
  initial,
}: {
  tanggal: string;
  dokters: DokterHariIni[];
  klinikLibur: boolean;
  initial: StaffRow[];
}) {
  const { rows, status } = useAntreanRealtime<StaffRow>({ tanggal }, { select: STAFF_COLUMNS, auth: true, initial });
  const { pending, jalankan } = useAksi();

  const polis = useMemo(() => {
    const m = new Map<string, { id: string; nama: string; warna: string }>();
    for (const d of dokters) m.set(d.poli_id, { id: d.poli_id, nama: d.poli, warna: d.warna });
    return [...m.values()].sort((a, b) => a.nama.localeCompare(b.nama));
  }, [dokters]);

  const [poliId, setPoliId] = useState<string | null>(null);
  const [dokterId, setDokterId] = useState<string | null>(dokters.length === 1 ? dokters[0].id : null);

  const dokterTampil = dokters.filter((d) => !poliId || d.poli_id === poliId);
  // Target tombol & shortcut: dokter yang dipilih, atau satu-satunya dokter yang tampil.
  const target = dokterId ?? (dokterTampil.length === 1 ? dokterTampil[0].id : null);

  const sesiById = useMemo(() => new Map(dokters.flatMap((d) => d.sesi.map((s) => [s.id, s] as const))), [dokters]);
  const dokterById = useMemo(() => new Map(dokters.map((d) => [d.id, d])), [dokters]);

  const tabel = rows
    .filter((r) => (!poliId || r.poli_id === poliId) && (!dokterId || r.dokter_id === dokterId))
    .sort(
      (a, b) =>
        (sesiById.get(a.jadwal_id)?.jam_mulai ?? "").localeCompare(sesiById.get(b.jadwal_id)?.jam_mulai ?? "") ||
        a.dokter_id.localeCompare(b.dokter_id) ||
        a.urutan - b.urutan,
    );

  const dipanggilDokter = (id: string) => sedangDilayani(rows.filter((r) => r.dokter_id === id && r.status === "dipanggil"));

  // Shortcut keyboard: Spasi = panggil berikutnya, R = panggil ulang (PRD 5.3 / Prompt 7).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, button, a, [contenteditable], [role=dialog]")) return;
      if (document.querySelector("[role=dialog]")) return;
      if (e.key !== " " && e.key.toLowerCase() !== "r") return;
      e.preventDefault();
      if (!target) {
        toast.error("Pilih dokter dulu (klik kartunya) untuk memakai shortcut.");
        return;
      }
      if (e.key === " ") jalankan(() => panggilBerikutnya(target));
      else {
        const aktif = dipanggilDokter(target);
        if (aktif) jalankan(() => panggilUlang(aktif.id));
        else toast.error("Belum ada nomor yang dipanggil untuk dokter ini.");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="pt-6 pb-10 sm:pt-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{formatTanggalPendek(tanggal)}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Antrean hari ini</h1>
        </div>
        <Koneksi status={status} />
      </header>

      {klinikLibur ? (
        <p className="neu-inset mt-6 rounded-2xl p-5 text-sm text-muted-foreground">Klinik libur hari ini. Tidak ada antrean.</p>
      ) : dokters.length === 0 ? (
        <p className="neu-inset mt-6 rounded-2xl p-5 text-sm text-muted-foreground">Tidak ada dokter yang praktik hari ini.</p>
      ) : (
        <>
          {/* Filter poli */}
          <div role="group" aria-label="Filter poli" className="mt-6 flex flex-wrap gap-2">
            {[{ id: null, nama: "Semua poli", warna: "" }, ...polis].map((p) => (
              <button
                key={p.id ?? "semua"}
                type="button"
                aria-pressed={poliId === p.id}
                onClick={() => {
                  setPoliId(p.id);
                  if (p.id && dokterId && dokterById.get(dokterId)?.poli_id !== p.id) setDokterId(null);
                }}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                  poliId === p.id ? "neu-inset" : "neu-raised-sm",
                )}
              >
                {p.warna && <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: p.warna }} />}
                {p.nama}
              </button>
            ))}
          </div>

          {/* Kartu dokter: panggil berikutnya / ulang */}
          <section aria-label="Panggilan per dokter" className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {dokterTampil.map((d) => {
              const aktif = dipanggilDokter(d.id);
              const siap = rows.filter((r) => r.dokter_id === d.id && STATUS_SIAP_DIPANGGIL.includes(r.status)).length;
              const belum = rows.filter((r) => r.dokter_id === d.id && r.status === "menunggu").length;
              const dipilih = dokterId === d.id;
              return (
                <article
                  key={d.id}
                  className={cn("rounded-3xl p-4 transition-shadow", dipilih ? "neu-inset" : "neu-raised")}
                >
                  <button
                    type="button"
                    aria-pressed={dipilih}
                    onClick={() => setDokterId(dipilih ? null : d.id)}
                    className="w-full rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                  >
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: d.warna }} />
                      {d.poli}
                      {dipilih && <span className="ml-auto font-medium text-foreground">Dipilih</span>}
                    </span>
                    <span className="mt-1 block truncate font-semibold">{d.nama}</span>
                    <span className="block text-xs text-muted-foreground">{d.sesi.map(labelSesi).join(" · ")}</span>
                  </button>

                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">Dipanggil</p>
                      <p
                        className={cn(
                          "mt-1 rounded-lg px-2.5 py-1 text-xl font-semibold tabular-nums tracking-tight",
                          aktif ? "neu-ink" : "text-muted-foreground",
                        )}
                      >
                        {aktif?.nomor_label ?? "—"}
                      </p>
                    </div>
                    <p className="text-right text-xs text-muted-foreground">
                      <span className="block font-medium text-foreground tabular-nums">{siap} siap</span>
                      <span className="tabular-nums">{belum} belum check-in</span>
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                    <Button disabled={pending || siap === 0} onClick={() => jalankan(() => panggilBerikutnya(d.id))}>
                      {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : <MegaphoneIcon aria-hidden />}
                      Panggil berikutnya
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={pending || !aktif}
                      aria-label={aktif ? `Panggil ulang ${aktif.nomor_label}` : "Panggil ulang"}
                      title="Panggil ulang (R)"
                      onClick={() => aktif && jalankan(() => panggilUlang(aktif.id))}
                    >
                      <RotateCcwIcon aria-hidden />
                    </Button>
                  </div>
                </article>
              );
            })}
          </section>
          <p className="mt-3 text-xs text-muted-foreground">
            Shortcut: <kbd className="neu-raised-sm rounded px-1.5 py-0.5 font-sans">Spasi</kbd> panggil berikutnya,{" "}
            <kbd className="neu-raised-sm rounded px-1.5 py-0.5 font-sans">R</kbd> panggil ulang
            {target ? ` — untuk ${dokterById.get(target)?.nama}.` : ". Klik kartu dokter untuk memilih."}
          </p>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_20rem]">
            {/* Tabel antrean */}
            <section aria-labelledby="tabel-title" className="neu-raised min-w-0 rounded-3xl p-4 sm:p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="tabel-title" className="font-semibold tracking-tight">
                  Daftar antrean
                  {dokterId && <span className="font-normal text-muted-foreground"> · {dokterById.get(dokterId)?.nama}</span>}
                </h2>
                <p className="text-xs text-muted-foreground tabular-nums">{tabel.length} nomor</p>
              </div>

              {tabel.length === 0 ? (
                <p className="neu-inset mt-4 rounded-2xl p-5 text-sm text-muted-foreground">Belum ada antrean.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[44rem] text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground">
                        <th scope="col" className="py-2 pr-3 font-medium">Nomor</th>
                        <th scope="col" className="py-2 pr-3 font-medium">Pasien</th>
                        <th scope="col" className="py-2 pr-3 font-medium">Dokter · sesi</th>
                        <th scope="col" className="py-2 pr-3 font-medium">Status</th>
                        <th scope="col" className="py-2 pr-3 font-medium">Waktu</th>
                        <th scope="col" className="py-2 text-right font-medium">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tabel.map((r) => (
                        <Baris
                          key={r.id}
                          r={r}
                          dokter={dokterById.get(r.dokter_id)?.nama ?? "—"}
                          sesi={sesiById.get(r.jadwal_id)}
                          warna={dokterById.get(r.dokter_id)?.warna}
                          pending={pending}
                          jalankan={jalankan}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <aside className="grid content-start gap-6">
              <CheckInPanel />
              <WalkinDialog dokters={dokters} />
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

function Baris({
  r,
  dokter,
  sesi,
  warna,
  pending,
  jalankan,
}: {
  r: StaffRow;
  dokter: string;
  sesi?: Sesi;
  warna?: string;
  pending: boolean;
  jalankan: (fn: () => Promise<AksiResult>) => void;
}) {
  const selesai = ["selesai", "batal", "tidak_datang"].includes(r.status);
  const waktu =
    r.status === "dipanggil" && r.waktu_dipanggil
      ? `Dipanggil ${formatJamWib(r.waktu_dipanggil)}`
      : r.waktu_checkin
        ? `Check-in ${formatJamWib(r.waktu_checkin)}`
        : r.estimasi_jam
          ? `Perkiraan ${formatJamWib(r.estimasi_jam)}`
          : "—";

  const ikon = "size-9 rounded-lg";
  return (
    <tr className={cn("border-t border-black/5", selesai && "text-muted-foreground")}>
      <td className="py-2.5 pr-3">
        <span className="inline-flex items-center gap-2 font-semibold whitespace-nowrap tabular-nums">
          {warna && <span aria-hidden className="h-4 w-0.5 rounded-full" style={{ backgroundColor: warna }} />}
          {r.nomor_label}
        </span>
        {r.sumber === "walkin" && <span className="block text-[11px] text-muted-foreground">walk-in</span>}
      </td>
      <td className="py-2.5 pr-3">
        <span className="block max-w-[14rem] truncate font-medium">{r.profiles?.nama ?? "—"}</span>
        <span className="block text-xs text-muted-foreground tabular-nums">{r.profiles?.no_hp ?? ""}</span>
      </td>
      <td className="py-2.5 pr-3">
        <span className="block max-w-[12rem] truncate">{dokter}</span>
        <span className="block text-xs text-muted-foreground">{sesi ? labelSesi(sesi) : ""}</span>
      </td>
      <td className="py-2.5 pr-3">
        <StatusBadge status={r.status} />
        {r.jumlah_dilewati > 0 && !selesai && (
          <span className="mt-0.5 block text-[11px] text-amber-700">dilewati {r.jumlah_dilewati}×</span>
        )}
      </td>
      <td className="py-2.5 pr-3 text-xs tabular-nums">{waktu}</td>
      <td className="py-2.5">
        <div className="flex justify-end gap-1.5">
          {r.status === "menunggu" && (
            <Button size="sm" variant="outline" disabled={pending} onClick={() => jalankan(() => checkIn(r.kode_tiket))}>
              Check-in
            </Button>
          )}
          {r.status === "dipanggil" && (
            <Button
              size="icon"
              variant="outline"
              className={ikon}
              disabled={pending}
              aria-label={`Panggil ulang ${r.nomor_label}`}
              title="Panggil ulang"
              onClick={() => jalankan(() => panggilUlang(r.id))}
            >
              <RotateCcwIcon aria-hidden />
            </Button>
          )}
          {["dipanggil", "check_in", "dilewati"].includes(r.status) && (
            <Button
              size="icon"
              variant="outline"
              className={ikon}
              disabled={pending}
              aria-label={`Lewati ${r.nomor_label}`}
              title="Lewati (pindah 3 posisi; 2× = tidak datang)"
              onClick={() => jalankan(() => lewati(r.id))}
            >
              <SkipForwardIcon aria-hidden />
            </Button>
          )}
          {["menunggu", "check_in", "dipanggil", "dilewati"].includes(r.status) && (
            <Button
              size="icon"
              variant="outline"
              className={ikon}
              disabled={pending}
              aria-label={`Tandai ${r.nomor_label} tidak datang`}
              title="Tandai tidak datang"
              onClick={() => jalankan(() => tandaiTidakDatang(r.id))}
            >
              <UserXIcon aria-hidden />
            </Button>
          )}
          {r.sumber === "walkin" && (
            <a
              href={`/resepsionis/tiket/${r.kode_tiket}`}
              target="_blank"
              rel="noopener"
              aria-label={`Unduh tiket PDF ${r.nomor_label}`}
              title="Tiket PDF 58mm"
              className="neu-raised-sm grid size-9 place-items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              <FileTextIcon className="size-4" aria-hidden />
            </a>
          )}
        </div>
      </td>
    </tr>
  );
}
