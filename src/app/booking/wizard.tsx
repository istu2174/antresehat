"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { CheckIcon, ChevronLeftIcon, Loader2Icon } from "lucide-react";
import { DoctorAvatar } from "@/components/doctor-avatar";
import { FormMessage } from "@/components/form-field";
import { Button, buttonVariants } from "@/components/ui/button";
import { buatBooking, type BookingResult } from "@/lib/actions/booking";
import { labelSesi } from "@/lib/antrean";
import { HARI_BOOKING, type Slot } from "@/lib/booking";
import type { Tables } from "@/lib/database.types";
import { addDays, dayOfWeek, formatTanggalPendek, HARI_SINGKAT } from "@/lib/time";
import { cn } from "@/lib/utils";

type Props = {
  polis: Pick<Tables<"polis">, "id" | "nama" | "warna" | "kode_prefix">[];
  dokters: Pick<Tables<"dokters">, "id" | "poli_id" | "nama" | "spesialis" | "foto_url">[];
  slots: Slot[];
  today: string;
};

const LANGKAH = ["Poli", "Dokter", "Tanggal", "Sesi"] as const;
const KONFIRMASI = LANGKAH.length;

const optionClass = (selected: boolean) =>
  cn(
    "flex w-full items-center gap-4 rounded-2xl p-4 text-left transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
    "disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none",
    selected ? "neu-inset" : "neu-raised-sm active:neu-inset",
  );

function Selected({ on }: { on: boolean }) {
  return on ? <CheckIcon className="ml-auto size-4 shrink-0" aria-hidden /> : null;
}

export function BookingWizard({ polis, dokters, slots, today }: Props) {
  const [step, setStep] = useState(0);
  const [poliId, setPoliId] = useState<string>();
  const [dokterId, setDokterId] = useState<string>();
  const [tanggal, setTanggal] = useState<string>();
  const [jadwalId, setJadwalId] = useState<string>();
  const [result, setResult] = useState<BookingResult>({});
  const [pending, startTransition] = useTransition();

  // Pindahkan fokus ke judul langkah supaya pembaca layar ikut berpindah.
  const headingRef = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) headingRef.current?.focus();
    mounted.current = true;
  }, [step]);

  const poli = polis.find((p) => p.id === poliId);
  const dokter = dokters.find((d) => d.id === dokterId);
  const slotDokter = slots.filter((s) => s.dokter_id === dokterId);
  const tanggalList = Array.from({ length: HARI_BOOKING }, (_, i) => addDays(today, i));
  const slotTerpilih = slots.find((s) => s.jadwal_id === jadwalId && s.tanggal === tanggal);

  const go = (n: number) => {
    setResult({});
    setStep(n);
  };

  function konfirmasi() {
    if (!slotTerpilih) return;
    startTransition(async () => {
      // Kalau sukses, server action me-redirect ke /tiket/[kode].
      setResult(await buatBooking({ jadwal_id: slotTerpilih.jadwal_id, tanggal: slotTerpilih.tanggal }));
    });
  }

  const judul = ["Pilih poli", "Pilih dokter", "Pilih tanggal", "Pilih sesi", "Konfirmasi booking"][step];

  return (
    <div className="mt-8">
      {/* Indikator progres */}
      <nav aria-label="Langkah booking">
        <ol className="grid grid-cols-4 gap-2">
          {LANGKAH.map((label, i) => {
            const selesai = i < step;
            const aktif = i === step;
            return (
              <li key={label}>
                <button
                  type="button"
                  onClick={() => selesai && go(i)}
                  disabled={!selesai}
                  aria-current={aktif ? "step" : undefined}
                  className="group grid w-full gap-2 text-left outline-none disabled:cursor-default"
                >
                  <span
                    className={cn(
                      "h-1.5 rounded-full transition-colors",
                      selesai || aktif ? "neu-ink" : "neu-inset",
                      aktif && "opacity-60",
                    )}
                  />
                  <span
                    className={cn(
                      "text-xs group-focus-visible:underline",
                      aktif ? "font-semibold text-foreground" : selesai ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {label}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="mt-8 flex items-center gap-2">
        {step > 0 && (
          <Button variant="ghost" size="icon" onClick={() => go(step - 1)} aria-label="Kembali ke langkah sebelumnya" className="-ml-2">
            <ChevronLeftIcon />
          </Button>
        )}
        <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold tracking-tight outline-none">
          {judul}
        </h2>
      </div>

      <div className="mt-5">
        {/* 1. Poli */}
        {step === 0 && (
          <ul className="grid gap-3">
            {polis.map((p) => {
              const jumlah = dokters.filter((d) => d.poli_id === p.id).length;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    aria-pressed={p.id === poliId}
                    disabled={jumlah === 0}
                    className={optionClass(p.id === poliId)}
                    onClick={() => {
                      if (p.id !== poliId) { setDokterId(undefined); setTanggal(undefined); setJadwalId(undefined); }
                      setPoliId(p.id);
                      go(1);
                    }}
                  >
                    <span aria-hidden className="h-10 w-1 shrink-0 rounded-full" style={{ backgroundColor: p.warna }} />
                    <span className="min-w-0">
                      <span className="block font-semibold">{p.nama}</span>
                      <span className="block text-sm text-muted-foreground">{jumlah ? `${jumlah} dokter` : "Belum ada dokter"}</span>
                    </span>
                    <Selected on={p.id === poliId} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* 2. Dokter */}
        {step === 1 && (
          <ul className="grid gap-3">
            {dokters.filter((d) => d.poli_id === poliId).map((d) => {
              const adaSlot = slots.some((s) => s.dokter_id === d.id && s.status === "ok");
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    aria-pressed={d.id === dokterId}
                    disabled={!adaSlot}
                    className={optionClass(d.id === dokterId)}
                    onClick={() => {
                      if (d.id !== dokterId) { setTanggal(undefined); setJadwalId(undefined); }
                      setDokterId(d.id);
                      go(2);
                    }}
                  >
                    <DoctorAvatar nama={d.nama} fotoUrl={d.foto_url} />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{d.nama}</span>
                      <span className="block text-sm text-muted-foreground">
                        {adaSlot ? d.spesialis : "Tidak ada jadwal tersedia 8 hari ke depan"}
                      </span>
                    </span>
                    <Selected on={d.id === dokterId} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* 3. Tanggal */}
        {step === 2 && (
          <ul className="grid grid-cols-4 gap-3">
            {tanggalList.map((t) => {
              const sesi = slotDokter.filter((s) => s.tanggal === t);
              const bisa = sesi.filter((s) => s.status === "ok");
              const keterangan = !sesi.length
                ? "Tidak praktik"
                : sesi.some((s) => s.status === "libur")
                  ? "Libur"
                  : bisa.length
                    ? `Sisa ${bisa.reduce((n, s) => n + s.sisa, 0)}`
                    : sesi.every((s) => s.status === "penuh")
                      ? "Penuh"
                      : "Tutup";
              const selected = t === tanggal;
              return (
                <li key={t}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    aria-label={`${formatTanggalPendek(t)}, ${keterangan}`}
                    disabled={!bisa.length}
                    onClick={() => {
                      if (t !== tanggal) setJadwalId(undefined);
                      setTanggal(t);
                      go(3);
                    }}
                    className={cn(optionClass(selected), "flex-col items-center gap-0.5 px-1 py-3 text-center")}
                  >
                    <span className="text-xs text-muted-foreground">{t === today ? "Hari ini" : HARI_SINGKAT[dayOfWeek(t)]}</span>
                    <span className="text-2xl font-semibold tabular-nums">{Number(t.slice(8))}</span>
                    <span className={cn("text-[11px] leading-tight", bisa.length ? "text-foreground" : "text-muted-foreground")}>
                      {keterangan}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* 4. Sesi */}
        {step === 3 && tanggal && (
          <>
            <p className="mb-4 text-sm text-muted-foreground">{formatTanggalPendek(tanggal)}</p>
            <ul className="grid gap-3">
              {slotDokter.filter((s) => s.tanggal === tanggal).map((s) => {
                const selected = s.jadwal_id === jadwalId;
                return (
                  <li key={s.jadwal_id}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      disabled={s.status !== "ok"}
                      className={optionClass(selected)}
                      onClick={() => {
                        setJadwalId(s.jadwal_id);
                        go(KONFIRMASI);
                      }}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold tabular-nums">{labelSesi(s)}</span>
                        <span className="block text-sm text-muted-foreground">
                          {s.status === "ok" && `Perkiraan dilayani ± ${s.estimasi} WIB`}
                          {s.status === "penuh" && "Kuota penuh"}
                          {s.status === "tutup" && "Booking sudah ditutup"}
                          {s.status === "libur" && "Dokter tidak praktik"}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block text-lg font-semibold tabular-nums">{s.sisa}</span>
                        <span className="block text-[11px] text-muted-foreground">dari {s.kuota}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {/* Konfirmasi */}
        {step === KONFIRMASI && poli && dokter && slotTerpilih && (
          <div className="grid gap-5">
            <dl className="neu-raised grid gap-4 rounded-3xl p-5 text-sm sm:p-6">
              {[
                ["Poli", <span key="p" className="inline-flex items-center gap-2"><span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: poli.warna }} />{poli.nama}</span>],
                ["Dokter", dokter.nama],
                ["Tanggal", formatTanggalPendek(slotTerpilih.tanggal)],
                ["Sesi", labelSesi(slotTerpilih)],
                ["Perkiraan dilayani", `± ${slotTerpilih.estimasi} WIB`],
                ["Sisa kuota", `${slotTerpilih.sisa} dari ${slotTerpilih.kuota}`],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-right font-medium tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>

            <p className="text-xs leading-relaxed text-muted-foreground">
              Datang dan check-in sebelum perkiraan jam dilayani. Booking yang belum check-in sampai 15 menit setelah
              perkiraan otomatis ditandai tidak datang.
            </p>

            <FormMessage error={result.error} />
            {result.kodeAktif && (
              <Link href={`/tiket/${result.kodeAktif}`} className={buttonVariants({ variant: "outline", size: "lg" })}>
                Buka tiket yang sudah ada
              </Link>
            )}
            {result.error && !result.kodeAktif && (
              <Button variant="outline" size="lg" onClick={() => go(3)}>Pilih sesi lain</Button>
            )}

            <Button size="lg" onClick={konfirmasi} disabled={pending} className="w-full">
              {pending && <Loader2Icon className="animate-spin" aria-hidden />}
              Ambil nomor antrean
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
