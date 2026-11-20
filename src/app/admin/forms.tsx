"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Loader2Icon, PencilIcon, PlusIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Field, FormMessage, SubmitButton } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  buatResepsionis,
  hapusJadwal,
  hapusLibur,
  resetDataDemo,
  resetPassword,
  simpanDokter,
  simpanJadwal,
  simpanPoli,
  tambahLibur,
  type LiburState,
} from "@/lib/actions/admin";
import type { FormState } from "@/lib/schemas";
import { HARI } from "@/lib/time";
import { cn } from "@/lib/utils";

type Aksi<S extends FormState> = (prev: S, fd: FormData) => Promise<S>;

/** Dialog berisi form server action. Tertutup sendiri + toast saat berhasil. */
function FormDialog<S extends FormState>({
  action,
  title,
  description,
  trigger,
  tutupSaatBerhasil = true,
  children,
}: {
  action: Aksi<S>;
  title: string;
  description?: string;
  trigger: (buka: () => void) => React.ReactNode;
  tutupSaatBerhasil?: boolean;
  children: (state: S) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // Key baru tiap dibuka → form & state mulai bersih.
  const [sesi, setSesi] = useState(0);
  return (
    <>
      {trigger(() => {
        setSesi((n) => n + 1);
        setOpen(true);
      })}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <IsiForm key={sesi} action={action} onBerhasil={() => tutupSaatBerhasil && setOpen(false)}>
            {children}
          </IsiForm>
        </DialogContent>
      </Dialog>
    </>
  );
}

function IsiForm<S extends FormState>({
  action,
  onBerhasil,
  children,
}: {
  action: Aksi<S>;
  onBerhasil: () => void;
  children: (state: S) => React.ReactNode;
}) {
  const [raw, formAction] = useActionState(action as unknown as Aksi<FormState>, {});
  const state = raw as S;
  useEffect(() => {
    if (state.success) {
      toast.success(state.success);
      onBerhasil();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hanya saat state baru
  }, [state]);
  return (
    <form action={formAction} noValidate className="grid gap-4">
      <FormMessage error={state.error} />
      {children(state)}
    </form>
  );
}

const pilihCls =
  "neu-inset h-11 w-full rounded-xl border border-transparent bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/60 aria-invalid:border-destructive";

function Pilihan({
  label,
  name,
  errors,
  children,
  ...props
}: React.ComponentProps<"select"> & { label: string; name: string; errors?: string[] }) {
  return (
    <div className="grid gap-2">
      <label htmlFor={`f-${name}`} className="text-sm font-medium">{label}</label>
      <select id={`f-${name}`} name={name} className={pilihCls} aria-invalid={errors?.length ? true : undefined} {...props}>
        {children}
      </select>
      {errors?.length ? <p className="text-sm text-destructive">{errors[0]}</p> : null}
    </div>
  );
}

function Centang({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-3 text-sm font-medium">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="size-4 accent-[#16181b]" />
      {label}
    </label>
  );
}

function ikonEdit(label: string) {
  return function TombolEdit(buka: () => void) {
    return (
      <Button variant="outline" size="icon-sm" onClick={buka} aria-label={label} title={label}>
        <PencilIcon aria-hidden />
      </Button>
    );
  };
}
function tombolTambah(label: string) {
  return function TombolTambah(buka: () => void) {
    return (
      <Button onClick={buka}>
        <PlusIcon aria-hidden />
        {label}
      </Button>
    );
  };
}

// ───────────── Poli ─────────────

export type PoliData = { id: string; nama: string; kode_prefix: string; warna: string; aktif: boolean };

export function PoliDialog({ poli }: { poli?: PoliData }) {
  return (
    <FormDialog
      action={simpanPoli}
      title={poli ? `Ubah ${poli.nama}` : "Tambah poli"}
      trigger={poli ? ikonEdit(`Ubah ${poli.nama}`) : tombolTambah("Tambah poli")}
    >
      {(s) => {
        const v = (k: keyof PoliData) => s.values?.[k] ?? String(poli?.[k] ?? "");
        return (
          <>
            <input type="hidden" name="id" value={poli?.id ?? ""} />
            <Field label="Nama poli" name="nama" defaultValue={v("nama")} errors={s.fieldErrors?.nama} placeholder="Poli Umum" />
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Prefix nomor"
                name="kode_prefix"
                defaultValue={v("kode_prefix")}
                errors={s.fieldErrors?.kode_prefix}
                maxLength={2}
                placeholder="U"
                className="uppercase"
                hint="Nomor jadi U-001"
              />
              <div className="grid gap-2">
                <label htmlFor="f-warna" className="text-sm font-medium">Warna aksen</label>
                <input id="f-warna" name="warna" type="color" defaultValue={v("warna") || "#16181b"} className="neu-inset h-11 w-full cursor-pointer rounded-xl p-1.5" />
              </div>
            </div>
            <Centang name="aktif" label="Aktif (tampil di booking)" defaultChecked={poli ? poli.aktif : true} />
            <SubmitButton>Simpan</SubmitButton>
          </>
        );
      }}
    </FormDialog>
  );
}

// ───────────── Dokter ─────────────

export type DokterData = {
  id: string;
  nama: string;
  spesialis: string;
  poli_id: string;
  foto_url: string | null;
  aktif: boolean;
  profile_id: string | null;
};

export function DokterDialog({ dokter, polis }: { dokter?: DokterData; polis: { id: string; nama: string }[] }) {
  return (
    <FormDialog
      action={simpanDokter}
      title={dokter ? `Ubah ${dokter.nama}` : "Tambah dokter"}
      trigger={dokter ? ikonEdit(`Ubah ${dokter.nama}`) : tombolTambah("Tambah dokter")}
    >
      {(s) => {
        const v = (k: keyof DokterData) => s.values?.[k] ?? String(dokter?.[k] ?? "");
        return (
          <>
            <input type="hidden" name="id" value={dokter?.id ?? ""} />
            <Field label="Nama lengkap & gelar" name="nama" defaultValue={v("nama")} errors={s.fieldErrors?.nama} placeholder="dr. Nama Dokter" />
            <Field label="Spesialis" name="spesialis" defaultValue={v("spesialis")} errors={s.fieldErrors?.spesialis} placeholder="Dokter Umum" />
            <Pilihan label="Poli" name="poli_id" defaultValue={v("poli_id")} errors={s.fieldErrors?.poli_id}>
              <option value="">Pilih poli…</option>
              {polis.map((p) => (
                <option key={p.id} value={p.id}>{p.nama}</option>
              ))}
            </Pilihan>
            <Field label="URL foto (opsional)" name="foto_url" type="url" defaultValue={v("foto_url")} errors={s.fieldErrors?.foto_url} placeholder="https://…" />
            <Centang name="aktif" label="Aktif" defaultChecked={dokter ? dokter.aktif : true} />

            {dokter?.profile_id ? (
              <p className="neu-inset rounded-xl px-4 py-3 text-xs text-muted-foreground">Sudah punya akun login. Reset password lewat halaman Staf.</p>
            ) : (
              <fieldset className="grid gap-3 rounded-2xl border border-black/5 p-4">
                <legend className="px-1 text-sm font-medium">Akun login (opsional)</legend>
                <Field
                  label="Username"
                  name="username"
                  defaultValue={s.values?.username ?? ""}
                  errors={s.fieldErrors?.username}
                  autoComplete="off"
                  hint="Email login: username@antresehat.test"
                />
                <Field label="Password awal" name="password" type="password" autoComplete="new-password" errors={s.fieldErrors?.password} />
              </fieldset>
            )}
            <SubmitButton>Simpan</SubmitButton>
          </>
        );
      }}
    </FormDialog>
  );
}

// ───────────── Jadwal ─────────────

export type JadwalData = { id: string; dokter_id: string; hari: number; jam_mulai: string; jam_selesai: string; kuota: number; menit_per_pasien: number };

export function JadwalDialog({
  jadwal,
  dokter,
  hari,
}: {
  jadwal?: JadwalData;
  dokter: { id: string; nama: string };
  hari: number;
}) {
  const label = jadwal ? `${jadwal.jam_mulai.slice(0, 5)}–${jadwal.jam_selesai.slice(0, 5)}` : "";
  return (
    <FormDialog
      action={simpanJadwal}
      title={jadwal ? "Ubah sesi praktik" : "Tambah sesi praktik"}
      description={`${dokter.nama} · ${HARI[hari]}`}
      trigger={(buka) =>
        jadwal ? (
          <button
            type="button"
            onClick={buka}
            className="neu-raised-sm w-full rounded-xl px-2.5 py-2 text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <span className="block font-semibold tabular-nums">{label}</span>
            <span className="block text-muted-foreground tabular-nums">
              {jadwal.kuota} kuota · {jadwal.menit_per_pasien} mnt
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={buka}
            aria-label={`Tambah sesi ${dokter.nama} hari ${HARI[hari]}`}
            className="grid h-9 w-full place-items-center rounded-xl text-muted-foreground outline-none hover:neu-inset focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <PlusIcon className="size-4" aria-hidden />
          </button>
        )
      }
    >
      {(s) => {
        const v = (k: keyof JadwalData, d = "") => s.values?.[k] ?? (jadwal ? String(jadwal[k]).slice(0, k.startsWith("jam") ? 5 : undefined) : d);
        return (
          <>
            <input type="hidden" name="id" value={jadwal?.id ?? ""} />
            <input type="hidden" name="dokter_id" value={dokter.id} />
            <input type="hidden" name="hari" value={hari} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Jam mulai" name="jam_mulai" type="time" defaultValue={v("jam_mulai", "08:00")} errors={s.fieldErrors?.jam_mulai} />
              <Field label="Jam selesai" name="jam_selesai" type="time" defaultValue={v("jam_selesai", "12:00")} errors={s.fieldErrors?.jam_selesai} />
              <Field label="Kuota per sesi" name="kuota" type="number" min={1} max={200} defaultValue={v("kuota", "20")} errors={s.fieldErrors?.kuota} />
              <Field label="Menit per pasien" name="menit_per_pasien" type="number" min={1} max={120} defaultValue={v("menit_per_pasien", "10")} errors={s.fieldErrors?.menit_per_pasien} />
            </div>
            <div className="flex items-center justify-between gap-3">
              {jadwal ? <HapusTombol label="Hapus sesi" aksi={() => hapusJadwal(jadwal.id)} /> : <span />}
              <SubmitButton>Simpan</SubmitButton>
            </div>
          </>
        );
      }}
    </FormDialog>
  );
}

function HapusTombol({ label, aksi, konfirmasi }: { label: string; aksi: () => Promise<FormState>; konfirmasi?: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      disabled={pending}
      className="text-destructive"
      onClick={() => {
        if (konfirmasi && !window.confirm(konfirmasi)) return;
        start(async () => {
          const r = await aksi();
          if (r.error) toast.error(r.error);
          else toast.success(r.success);
        });
      }}
    >
      {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : <Trash2Icon aria-hidden />}
      {label}
    </Button>
  );
}

// ───────────── Libur ─────────────

/** 0812… → 62812… untuk link wa.me */
const nomorWa = (hp: string) => hp.replace(/\D/g, "").replace(/^0/, "62");

export function LiburDialog({ dokters, tanggalAwal }: { dokters: { id: string; nama: string }[]; tanggalAwal: string }) {
  return (
    <FormDialog<LiburState>
      action={tambahLibur}
      title="Tambah hari libur / cuti"
      description="Booking di tanggal itu langsung ditutup. Booking yang sudah ada dibatalkan."
      tutupSaatBerhasil={false}
      trigger={tombolTambah("Tambah libur")}
    >
      {(s) =>
        s.success ? (
          <div className="grid gap-3">
            <p role="status" className="neu-inset rounded-xl px-4 py-3 text-sm">{s.success}</p>
            {!!s.terdampak?.length && (
              <>
                <p className="text-sm text-muted-foreground">Kabari pasien berikut:</p>
                <ul className="grid gap-2">
                  {s.terdampak.map((t) => (
                    <li key={t.nomor_label} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate">
                        <span className="font-semibold tabular-nums">{t.nomor_label}</span> · {t.nama}
                      </span>
                      {t.no_hp ? (
                        <a
                          href={`https://wa.me/${nomorWa(t.no_hp)}?text=${encodeURIComponent(`Halo ${t.nama}, booking ${t.nomor_label} di Klinik AntreSehat dibatalkan karena klinik/dokter libur. Silakan booking ulang di tanggal lain. Mohon maaf.`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="neu-raised-sm shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium"
                        >
                          Kirim WhatsApp
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">tanpa no. HP</span>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ) : (
          <>
            <Field label="Tanggal" name="tanggal" type="date" min={tanggalAwal} defaultValue={s.values?.tanggal ?? tanggalAwal} errors={s.fieldErrors?.tanggal} />
            <Pilihan label="Berlaku untuk" name="dokter_id" defaultValue={s.values?.dokter_id ?? ""} errors={s.fieldErrors?.dokter_id}>
              <option value="">Seluruh klinik libur</option>
              {dokters.map((d) => (
                <option key={d.id} value={d.id}>{`Cuti: ${d.nama}`}</option>
              ))}
            </Pilihan>
            <Field label="Keterangan" name="keterangan" defaultValue={s.values?.keterangan ?? ""} errors={s.fieldErrors?.keterangan} placeholder="Cuti bersama" />
            <SubmitButton>Simpan & tutup booking</SubmitButton>
          </>
        )
      }
    </FormDialog>
  );
}

export function HapusLibur({ id }: { id: string }) {
  return <HapusTombol label="Hapus" aksi={() => hapusLibur(id)} konfirmasi="Hapus libur ini? Booking yang sudah dibatalkan tidak dipulihkan." />;
}

// ───────────── Staf ─────────────

export function ResepsionisDialog() {
  return (
    <FormDialog action={buatResepsionis} title="Buat akun resepsionis" trigger={tombolTambah("Akun resepsionis")}>
      {(s) => (
        <>
          <Field label="Nama" name="nama" defaultValue={s.values?.nama ?? ""} errors={s.fieldErrors?.nama} />
          <Field label="Username" name="username" defaultValue={s.values?.username ?? ""} errors={s.fieldErrors?.username} autoComplete="off" hint="Email login: username@antresehat.test" />
          <Field label="Password awal" name="password" type="password" autoComplete="new-password" errors={s.fieldErrors?.password} />
          <SubmitButton>Buat akun</SubmitButton>
        </>
      )}
    </FormDialog>
  );
}

export function ResetPasswordDialog({ id, email }: { id: string; email: string }) {
  return (
    <FormDialog
      action={resetPassword}
      title="Reset password"
      description={email}
      trigger={(buka) => (
        <Button variant="outline" size="sm" onClick={buka}>
          Reset password
        </Button>
      )}
    >
      {(s) => (
        <>
          <input type="hidden" name="id" value={id} />
          <Field label="Password baru" name="password" type="password" autoComplete="new-password" errors={s.fieldErrors?.password} />
          <SubmitButton>Simpan password</SubmitButton>
        </>
      )}
    </FormDialog>
  );
}

// ───────────── Reset demo ─────────────

export function ResetDemoButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant="outline" className={cn("w-full", className)} onClick={() => setOpen(true)}>
        <RotateCcwIcon aria-hidden />
        Reset data demo
      </Button>
      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset data demo?</DialogTitle>
            <DialogDescription>
              Semua data (antrean, kunjungan, jadwal, akun staf tambahan, audit) diganti dengan data awal. Kamu akan diminta masuk lagi.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>Batal</Button>
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await resetDataDemo(); // berhasil → redirect ke /login
                  if (r?.error) toast.error(r.error);
                })
              }
            >
              {pending && <Loader2Icon className="animate-spin" aria-hidden />}
              {pending ? "Mereset…" : "Ya, reset"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
