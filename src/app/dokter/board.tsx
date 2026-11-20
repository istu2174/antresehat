"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CheckIcon, Loader2Icon, StethoscopeIcon } from "lucide-react";
import { toast } from "sonner";
import { FormMessage } from "@/components/form-field";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAntreanRealtime, type LiveStatus } from "@/hooks/use-antrean-realtime";
import { mulaiPeriksa, riwayatPasien, selesaiPeriksa, type RiwayatKunjungan } from "@/lib/actions/dokter";
import { formatJamWib, labelSesi, type Status } from "@/lib/antrean";
import { DOKTER_COLUMNS } from "@/lib/antrean-live";
import { ICD10 } from "@/lib/icd10";
import { formatTanggalPendek, todayWib } from "@/lib/time";
import { cn } from "@/lib/utils";

export type DokterRow = {
  id: string;
  tanggal: string;
  jadwal_id: string;
  pasien_id: string;
  nomor_label: string;
  sumber: "booking" | "walkin";
  status: Status;
  urutan: number;
  waktu_checkin: string | null;
  waktu_dipanggil: string | null;
  waktu_mulai: string | null;
  waktu_selesai: string | null;
  profiles: { nama: string; tgl_lahir: string | null; jenis_kelamin: "L" | "P" | null } | null;
};
type Sesi = { id: string; jam_mulai: string; jam_selesai: string };

const SELESAI: Status[] = ["selesai", "batal", "tidak_datang"];

function umur(tglLahir: string | null): string | null {
  if (!tglLahir) return null;
  const lahir = new Date(tglLahir);
  const now = new Date();
  let th = now.getFullYear() - lahir.getFullYear();
  if (now < new Date(now.getFullYear(), lahir.getMonth(), lahir.getDate())) th--;
  return `${th} th`;
}

function Koneksi({ status }: { status: LiveStatus }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
      <span
        aria-hidden
        className={cn("size-2 rounded-full", status === "live" ? "bg-emerald-600" : status === "offline" ? "bg-destructive" : "bg-muted-foreground")}
      />
      {status === "live" ? "Langsung" : status === "offline" ? "Terputus, mencoba lagi…" : "Menyambungkan…"}
    </span>
  );
}

export function DokterBoard({
  tanggal,
  dokterId,
  nama,
  poli,
  warna,
  sesi,
  initial,
}: {
  tanggal: string;
  dokterId: string;
  nama: string;
  poli: string;
  warna: string;
  sesi: Sesi[];
  initial: DokterRow[];
}) {
  const { rows, status } = useAntreanRealtime<DokterRow>(
    { tanggal, dokter_id: dokterId },
    { select: DOKTER_COLUMNS, auth: true, initial },
  );
  const [pilihId, setPilihId] = useState<string | null>(null);

  const jamSesi = new Map(sesi.map((s) => [s.id, s.jam_mulai]));
  const daftar = rows
    .filter((r) => r.status !== "batal")
    .sort((a, b) => (jamSesi.get(a.jadwal_id) ?? "").localeCompare(jamSesi.get(b.jadwal_id) ?? "") || a.urutan - b.urutan);

  // Default: pasien yang sedang diperiksa, lalu yang sudah dipanggil.
  const terpilih =
    daftar.find((r) => r.id === pilihId) ??
    daftar.find((r) => r.status === "diperiksa") ??
    daftar.find((r) => r.status === "dipanggil") ??
    null;

  const sisa = daftar.filter((r) => !SELESAI.includes(r.status)).length;
  const selesai = daftar.filter((r) => r.status === "selesai").length;

  return (
    <div className="pt-6 pb-10 sm:pt-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{formatTanggalPendek(tanggal)}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Pasien hari ini</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            {warna && <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: warna }} />}
            {nama} · {poli}
            {sesi.length > 0 && <span>· {sesi.map(labelSesi).join(", ")}</span>}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm tabular-nums">
            <span className="font-semibold">{sisa}</span> menunggu · <span className="font-semibold">{selesai}</span> selesai
          </p>
          <Koneksi status={status} />
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[20rem_1fr]">
        <section aria-labelledby="daftar-title" className="neu-raised h-fit rounded-3xl p-4">
          <h2 id="daftar-title" className="px-1 font-semibold tracking-tight">Urutan antrean</h2>
          {daftar.length === 0 ? (
            <p className="neu-inset mt-3 rounded-2xl p-4 text-sm text-muted-foreground">Belum ada pasien hari ini.</p>
          ) : (
            <ul className="mt-3 grid gap-1.5">
              {daftar.map((r) => {
                const aktif = terpilih?.id === r.id;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      aria-current={aktif || undefined}
                      onClick={() => setPilihId(r.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                        aktif ? "neu-inset" : "hover:neu-raised-sm",
                        SELESAI.includes(r.status) && "text-muted-foreground",
                      )}
                    >
                      <span className="w-14 shrink-0 font-semibold whitespace-nowrap tabular-nums">{r.nomor_label}</span>
                      <span className="min-w-0 flex-1 truncate text-sm">{r.profiles?.nama ?? "—"}</span>
                      <StatusBadge status={r.status} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {terpilih ? (
          <Pasien key={terpilih.id} r={terpilih} />
        ) : (
          <p className="neu-inset h-fit rounded-3xl p-8 text-center text-sm text-muted-foreground">
            Belum ada pasien yang dipanggil. Pasien muncul di sini setelah resepsionis memanggilnya.
          </p>
        )}
      </div>
    </div>
  );
}

function Pasien({ r }: { r: DokterRow }) {
  const [pending, start] = useTransition();
  const [riwayat, setRiwayat] = useState<RiwayatKunjungan[] | null>(null);

  // Riwayat dimuat ulang saat pasien diganti atau status berubah (mis. baru selesai).
  useEffect(() => {
    let batal = false;
    riwayatPasien(r.pasien_id).then((res) => {
      if (batal) return;
      if (res.error) toast.error(res.error);
      setRiwayat(res.data ?? []);
    });
    return () => {
      batal = true;
    };
  }, [r.pasien_id, r.status]);

  const p = r.profiles;
  const info = [p?.jenis_kelamin === "L" ? "Laki-laki" : p?.jenis_kelamin === "P" ? "Perempuan" : null, umur(p?.tgl_lahir ?? null)]
    .filter(Boolean)
    .join(", ");
  const catatanIni = riwayat?.find((k) => k.antrean?.id === r.id);
  const sebelumnya = riwayat?.filter((k) => k.antrean?.id !== r.id) ?? null;

  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[1fr_20rem]">
      <section aria-labelledby="pasien-title" className="neu-raised min-w-0 rounded-3xl p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="neu-ink grid h-14 min-w-20 place-items-center rounded-xl px-3 text-xl font-semibold tabular-nums">
              {r.nomor_label}
            </span>
            <div className="min-w-0">
              <h2 id="pasien-title" className="truncate text-lg font-semibold tracking-tight">{p?.nama ?? "—"}</h2>
              <p className="text-sm text-muted-foreground">
                {info || "Data diri belum lengkap"}
                {r.sumber === "walkin" && " · walk-in"}
              </p>
            </div>
          </div>
          <StatusBadge status={r.status} />
        </div>

        <div className="mt-6">
          {r.status === "dipanggil" && (
            <div className="neu-inset flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
              <p className="text-sm text-muted-foreground">
                Dipanggil {r.waktu_dipanggil && formatJamWib(r.waktu_dipanggil)}. Mulai saat pasien masuk ruangan.
              </p>
              <Button
                size="lg"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await mulaiPeriksa(r.id);
                    if (res.error) toast.error(res.error);
                    else toast.success(res.pesan);
                  })
                }
              >
                {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : <StethoscopeIcon aria-hidden />}
                Mulai periksa
              </Button>
            </div>
          )}

          {r.status === "diperiksa" && <FormKunjungan r={r} />}

          {r.status === "selesai" &&
            (catatanIni ? (
              <Catatan k={catatanIni} judul={`Catatan kunjungan · selesai ${r.waktu_selesai ? formatJamWib(r.waktu_selesai) : ""}`} />
            ) : (
              <p className="text-sm text-muted-foreground">{riwayat ? "Tidak ada catatan untuk kunjungan ini." : "Memuat catatan…"}</p>
            ))}

          {["menunggu", "check_in", "dilewati"].includes(r.status) && (
            <p className="neu-inset rounded-2xl p-4 text-sm text-muted-foreground">Pasien belum dipanggil resepsionis.</p>
          )}
          {r.status === "tidak_datang" && (
            <p className="neu-inset rounded-2xl p-4 text-sm text-muted-foreground">Pasien ditandai tidak datang.</p>
          )}
        </div>
      </section>

      <aside aria-labelledby="riwayat-title" className="neu-raised h-fit rounded-3xl p-5">
        <h2 id="riwayat-title" className="font-semibold tracking-tight">Riwayat kunjungan</h2>
        <p className="text-xs text-muted-foreground">Hanya baca</p>
        {sebelumnya === null ? (
          <p className="mt-4 text-sm text-muted-foreground">Memuat…</p>
        ) : sebelumnya.length === 0 ? (
          <p className="neu-inset mt-4 rounded-2xl p-4 text-sm text-muted-foreground">Kunjungan pertama pasien ini.</p>
        ) : (
          <ol className="mt-4 grid gap-3">
            {sebelumnya.map((k) => (
              <li key={k.id}>
                <details className="group neu-raised-sm rounded-2xl p-3">
                  <summary className="cursor-pointer list-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/60 [&::-webkit-details-marker]:hidden">
                    <span className="block text-xs text-muted-foreground">
                      {formatTanggalPendek(todayWib(new Date(k.created_at)))} · {k.dokters?.nama}
                    </span>
                    <span className="mt-0.5 block text-sm font-medium">
                      {k.diagnosis}
                      {k.icd10 && <span className="font-normal text-muted-foreground"> ({k.icd10})</span>}
                    </span>
                  </summary>
                  <div className="mt-3">
                    <Catatan k={k} ringkas />
                  </div>
                </details>
              </li>
            ))}
          </ol>
        )}
      </aside>
    </div>
  );
}

function Catatan({ k, judul, ringkas }: { k: RiwayatKunjungan; judul?: string; ringkas?: boolean }) {
  const vital = [k.tensi && `Tensi ${k.tensi}`, k.suhu != null && `Suhu ${k.suhu.toLocaleString("id-ID")} °C`, k.berat != null && `Berat ${k.berat.toLocaleString("id-ID")} kg`]
    .filter(Boolean)
    .join(" · ");
  const isi: [string, string | null][] = [
    ["Keluhan", k.keluhan],
    ["Pemeriksaan", vital],
    ...(ringkas ? [] : ([["Diagnosis", [k.diagnosis, k.icd10 && `(${k.icd10})`].filter(Boolean).join(" ")]] as [string, string][])),
    ["Tindakan", k.tindakan],
    ["Resep", k.resep],
    ["Saran", k.saran],
  ];
  return (
    <div>
      {judul && <h3 className="text-sm font-semibold">{judul}</h3>}
      <dl className={cn("grid gap-3 text-sm", judul && "mt-3")}>
        {isi
          .filter(([, v]) => v && v !== "-")
          .map(([label, v]) => (
            <div key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-0.5 whitespace-pre-line">{v}</dd>
            </div>
          ))}
      </dl>
    </div>
  );
}

function FormKunjungan({ r }: { r: DokterRow }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [fe, setFe] = useState<Record<string, string>>({});
  const diagnosis = useRef<HTMLInputElement>(null);

  function kirim(form: HTMLFormElement) {
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    setError(undefined);
    setFe({});
    start(async () => {
      const res = await selesaiPeriksa(r.id, {
        keluhan: f.keluhan ?? "",
        tensi: f.tensi ?? "",
        suhu: f.suhu ?? "",
        berat: f.berat ?? "",
        diagnosis: f.diagnosis ?? "",
        icd10: f.icd10 ?? "",
        tindakan: f.tindakan ?? "",
        resep: f.resep ?? "",
        saran: f.saran ?? "",
      });
      if (res.error) {
        setError(res.error);
        setFe(res.fieldErrors ?? {});
      } else toast.success(res.pesan);
    });
  }

  const err = (k: string) =>
    fe[k] && (
      <p id={`k-${k}-err`} className="text-sm text-destructive">
        {fe[k]}
      </p>
    );
  const aria = (k: string) => (fe[k] ? { "aria-invalid": true, "aria-describedby": `k-${k}-err` } : {});
  const area =
    "neu-inset min-h-20 w-full rounded-xl border border-transparent bg-transparent px-3.5 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/60 aria-invalid:border-destructive";

  return (
    <form
      noValidate
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        kirim(e.currentTarget);
      }}
    >
      <p className="text-sm text-muted-foreground">
        Pemeriksaan dimulai {r.waktu_mulai && formatJamWib(r.waktu_mulai)}. Durasi tercatat otomatis saat Selesai.
      </p>
      <FormMessage error={error} />

      <div className="grid gap-2">
        <label htmlFor="k-keluhan" className="text-sm font-medium">Keluhan</label>
        <textarea id="k-keluhan" name="keluhan" rows={2} className={area} {...aria("keluhan")} />
        {err("keluhan")}
      </div>

      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-medium">Pemeriksaan</legend>
        <div className="grid gap-1.5">
          <label htmlFor="k-tensi" className="text-xs text-muted-foreground">Tensi (mmHg)</label>
          <Input id="k-tensi" name="tensi" placeholder="120/80" inputMode="numeric" autoComplete="off" className="tabular-nums" {...aria("tensi")} />
          {err("tensi")}
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="k-suhu" className="text-xs text-muted-foreground">Suhu (°C)</label>
          <Input id="k-suhu" name="suhu" placeholder="36,5" inputMode="decimal" autoComplete="off" className="tabular-nums" {...aria("suhu")} />
          {err("suhu")}
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="k-berat" className="text-xs text-muted-foreground">Berat (kg)</label>
          <Input id="k-berat" name="berat" placeholder="60" inputMode="decimal" autoComplete="off" className="tabular-nums" {...aria("berat")} />
          {err("berat")}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-[1fr_16rem]">
        <div className="grid gap-2">
          <label htmlFor="k-diagnosis" className="text-sm font-medium">Diagnosis</label>
          <Input id="k-diagnosis" name="diagnosis" ref={diagnosis} autoComplete="off" {...aria("diagnosis")} />
          {err("diagnosis")}
        </div>
        <div className="grid gap-2">
          <label htmlFor="k-icd10" className="text-sm font-medium">Kode ICD-10 (opsional)</label>
          <select
            id="k-icd10"
            name="icd10"
            defaultValue=""
            onChange={(e) => {
              // Isi diagnosis otomatis kalau masih kosong.
              const icd = ICD10.find((i) => i.kode === e.target.value);
              if (icd && diagnosis.current && !diagnosis.current.value) diagnosis.current.value = icd.nama;
            }}
            className="neu-inset h-11 w-full rounded-xl border border-transparent bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            {...aria("icd10")}
          >
            <option value="">— Tanpa kode —</option>
            {ICD10.map((i) => (
              <option key={i.kode} value={i.kode}>{`${i.kode} · ${i.nama}`}</option>
            ))}
          </select>
          {err("icd10")}
        </div>
      </div>

      {(
        [
          ["tindakan", "Tindakan"],
          ["resep", "Resep"],
          ["saran", "Saran & kontrol"],
        ] as const
      ).map(([k, label]) => (
        <div key={k} className="grid gap-2">
          <label htmlFor={`k-${k}`} className="text-sm font-medium">{label}</label>
          <textarea id={`k-${k}`} name={k} rows={2} className={area} {...aria(k)} />
          {err(k)}
        </div>
      ))}

      <Button type="submit" size="lg" disabled={pending} className="justify-self-end">
        {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : <CheckIcon aria-hidden />}
        Selesai
      </Button>
    </form>
  );
}
