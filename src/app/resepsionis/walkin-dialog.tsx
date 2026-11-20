"use client";

import { useState, useTransition } from "react";
import { FileTextIcon, Loader2Icon, SearchIcon, UserPlusIcon } from "lucide-react";
import { toast } from "sonner";
import { FormMessage } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cariPasien, daftarWalkin, type PasienRingkas } from "@/lib/actions/resepsionis";
import { labelSesi } from "@/lib/antrean";
import { cn } from "@/lib/utils";
import type { DokterHariIni } from "./dashboard";

type Mode = "lama" | "baru";
const BARU_KOSONG = { nama: "", no_hp: "", tgl_lahir: "", jenis_kelamin: "" };

/** Daftarkan pasien walk-in: cari pasien lama atau buat baru → langsung dapat nomor (PRD 5.3). */
export function WalkinDialog({ dokters }: { dokters: DokterHariIni[] }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("lama");
  const [jadwalId, setJadwalId] = useState("");
  const [q, setQ] = useState("");
  const [hasil, setHasil] = useState<PasienRingkas[] | null>(null);
  const [pasienId, setPasienId] = useState<string | null>(null);
  const [baru, setBaru] = useState(BARU_KOSONG);
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [tiket, setTiket] = useState<{ pesan: string; kode: string } | null>(null);
  const [mencari, startCari] = useTransition();
  const [pending, start] = useTransition();

  function reset() {
    setMode("lama");
    setJadwalId("");
    setQ("");
    setHasil(null);
    setPasienId(null);
    setBaru(BARU_KOSONG);
    setError(undefined);
    setFieldErrors({});
    setTiket(null);
  }

  function cari() {
    startCari(async () => {
      const r = await cariPasien(q);
      if (r.error) toast.error(r.error);
      setHasil(r.hasil ?? []);
      setPasienId(null);
    });
  }

  function simpan() {
    setError(undefined);
    setFieldErrors({});
    start(async () => {
      const r = await daftarWalkin({
        jadwal_id: jadwalId,
        ...(mode === "lama"
          ? { pasien_id: pasienId ?? undefined }
          : { baru: { ...baru, jenis_kelamin: baru.jenis_kelamin as "L" | "P" } }),
      });
      if (r.error) {
        setError(r.error);
        setFieldErrors(r.fieldErrors ?? {});
        return;
      }
      setTiket({ pesan: r.pesan!, kode: r.kode! });
      toast.success(r.pesan);
    });
  }

  const ubahBaru = (k: keyof typeof BARU_KOSONG) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setBaru((b) => ({ ...b, [k]: e.target.value }));
  const err = (k: string) => fieldErrors[k] && <p className="text-sm text-destructive">{fieldErrors[k]}</p>;

  return (
    <section aria-labelledby="walkin-title" className="neu-raised rounded-3xl p-5">
      <h2 id="walkin-title" className="font-semibold tracking-tight">Pasien walk-in</h2>
      <p className="mt-1 text-sm text-muted-foreground">Pasien datang langsung tanpa booking.</p>
      <Button
        className="mt-3 w-full"
        variant="outline"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <UserPlusIcon aria-hidden />
        Daftarkan walk-in
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Daftarkan pasien walk-in</DialogTitle>
            <DialogDescription>Nomor antrean langsung keluar dan pasien dianggap sudah check-in.</DialogDescription>
          </DialogHeader>

          {tiket ? (
            <div className="grid gap-4">
              <p role="status" className="neu-inset rounded-2xl p-5 text-center">
                <span className="block text-sm text-muted-foreground">Berhasil</span>
                <span className="mt-1 block text-lg font-semibold">{tiket.pesan}</span>
                <span className="mt-1 block font-mono text-xs text-muted-foreground">{tiket.kode}</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={reset}>Daftarkan lagi</Button>
                <a
                  href={`/resepsionis/tiket/${tiket.kode}`}
                  target="_blank"
                  rel="noopener"
                  className="neu-ink inline-flex h-9 items-center justify-center gap-2 rounded-xl text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  <FileTextIcon className="size-4" aria-hidden />
                  Tiket PDF
                </a>
              </div>
            </div>
          ) : (
            <form
              className="grid gap-5"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                simpan();
              }}
            >
              <FormMessage error={error} />

              <div className="grid gap-2">
                <label htmlFor="walkin-sesi" className="text-sm font-medium">Dokter & sesi</label>
                <select
                  id="walkin-sesi"
                  value={jadwalId}
                  onChange={(e) => setJadwalId(e.target.value)}
                  className="neu-inset h-11 rounded-xl border border-transparent bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  <option value="">Pilih dokter & sesi…</option>
                  {dokters.map((d) => (
                    <optgroup key={d.id} label={`${d.poli} — ${d.nama}`}>
                      {d.sesi.map((s) => (
                        <option key={s.id} value={s.id}>{`${d.nama} · ${labelSesi(s)}`}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {err("jadwal_id")}
              </div>

              <div role="group" aria-label="Jenis pasien" className="neu-inset grid grid-cols-2 gap-1 rounded-xl p-1">
                {(["lama", "baru"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={mode === m}
                    onClick={() => setMode(m)}
                    className={cn(
                      "h-10 rounded-lg text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                      mode === m ? "neu-raised-sm text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {m === "lama" ? "Pasien lama" : "Pasien baru"}
                  </button>
                ))}
              </div>

              {mode === "lama" ? (
                <div className="grid gap-3">
                  <label htmlFor="walkin-cari" className="text-sm font-medium">Cari nama atau no. HP</label>
                  <div className="flex gap-2">
                    <Input
                      id="walkin-cari"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          cari();
                        }
                      }}
                      placeholder="mis. Siti atau 0812…"
                      autoComplete="off"
                    />
                    <Button type="button" variant="outline" onClick={cari} disabled={mencari || q.trim().length < 2}>
                      {mencari ? <Loader2Icon className="animate-spin" aria-hidden /> : <SearchIcon aria-hidden />}
                      Cari
                    </Button>
                  </div>
                  {hasil &&
                    (hasil.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Tidak ditemukan. Daftarkan sebagai pasien baru.</p>
                    ) : (
                      <fieldset className="grid gap-1.5">
                        <legend className="sr-only">Hasil pencarian</legend>
                        {hasil.map((p) => (
                          <label
                            key={p.id}
                            className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm has-checked:neu-inset has-focus-visible:ring-2 has-focus-visible:ring-ring/60"
                          >
                            <input
                              type="radio"
                              name="pasien"
                              value={p.id}
                              checked={pasienId === p.id}
                              onChange={() => setPasienId(p.id)}
                              className="sr-only"
                            />
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{p.nama}</span>
                              <span className="block text-xs text-muted-foreground tabular-nums">
                                {[p.no_hp, p.tgl_lahir].filter(Boolean).join(" · ") || "—"}
                              </span>
                            </span>
                            {pasienId === p.id && <span className="text-xs font-medium">Dipilih</span>}
                          </label>
                        ))}
                      </fieldset>
                    ))}
                </div>
              ) : (
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <label htmlFor="walkin-nama" className="text-sm font-medium">Nama lengkap</label>
                    <Input id="walkin-nama" value={baru.nama} onChange={ubahBaru("nama")} autoComplete="off" aria-invalid={!!fieldErrors.nama || undefined} />
                    {err("nama")}
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="walkin-hp" className="text-sm font-medium">No. HP</label>
                    <Input id="walkin-hp" type="tel" inputMode="tel" placeholder="081234567890" value={baru.no_hp} onChange={ubahBaru("no_hp")} autoComplete="off" aria-invalid={!!fieldErrors.no_hp || undefined} />
                    {err("no_hp")}
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="walkin-lahir" className="text-sm font-medium">Tanggal lahir (opsional)</label>
                    <Input id="walkin-lahir" type="date" value={baru.tgl_lahir} onChange={ubahBaru("tgl_lahir")} aria-invalid={!!fieldErrors.tgl_lahir || undefined} />
                    {err("tgl_lahir")}
                  </div>
                  <fieldset className="grid gap-2">
                    <legend className="mb-2 text-sm font-medium">Jenis kelamin</legend>
                    <div className="neu-inset grid grid-cols-2 gap-1 rounded-xl p-1">
                      {[
                        { value: "L", label: "Laki-laki" },
                        { value: "P", label: "Perempuan" },
                      ].map((o) => (
                        <label
                          key={o.value}
                          className="flex h-10 cursor-pointer items-center justify-center rounded-lg text-sm font-medium text-muted-foreground has-checked:neu-raised-sm has-checked:text-foreground has-focus-visible:ring-2 has-focus-visible:ring-ring/60"
                        >
                          <input
                            type="radio"
                            name="jenis_kelamin"
                            value={o.value}
                            checked={baru.jenis_kelamin === o.value}
                            onChange={ubahBaru("jenis_kelamin")}
                            className="sr-only"
                          />
                          {o.label}
                        </label>
                      ))}
                    </div>
                    {err("jenis_kelamin")}
                  </fieldset>
                </div>
              )}

              <Button type="submit" size="lg" disabled={pending}>
                {pending && <Loader2Icon className="animate-spin" aria-hidden />}
                Ambil nomor antrean
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
