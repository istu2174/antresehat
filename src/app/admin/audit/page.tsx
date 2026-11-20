import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";
import { TZ } from "@/lib/time";

export const metadata = { title: "Audit log" };

const AKSI: Record<string, string> = {
  panggil: "Panggil",
  panggil_ulang: "Panggil ulang",
  lewati: "Lewati",
  tidak_datang: "Tidak datang",
  tidak_datang_otomatis: "Tidak datang (otomatis)",
  check_in: "Check-in",
  walkin: "Walk-in",
  mulai_periksa: "Mulai periksa",
  selesai_periksa: "Selesai periksa",
  tambah_poli: "Tambah poli",
  ubah_poli: "Ubah poli",
  tambah_dokter: "Tambah dokter",
  ubah_dokter: "Ubah dokter",
  tambah_jadwal: "Tambah jadwal",
  ubah_jadwal: "Ubah jadwal",
  hapus_jadwal: "Hapus jadwal",
  tambah_libur: "Tambah libur",
  hapus_libur: "Hapus libur",
  buat_staf: "Buat akun staf",
  reset_password: "Reset password",
};
const BATAS = 200;
const tanggalValid = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");

export default async function Page({ searchParams }: { searchParams: Promise<{ aksi?: string; dari?: string; sampai?: string }> }) {
  const sp = await searchParams;
  const aksi = sp.aksi && sp.aksi in AKSI ? sp.aksi : "";
  const dari = tanggalValid(sp.dari);
  const sampai = tanggalValid(sp.sampai);

  const supabase = await createClient();
  let q = supabase
    .from("audit_log")
    .select("id, aksi, entitas, data, created_at, profiles(nama, role)")
    .order("created_at", { ascending: false })
    .limit(BATAS);
  if (aksi) q = q.eq("aksi", aksi);
  // Batas hari dihitung di WIB (+07:00).
  if (dari) q = q.gte("created_at", `${dari}T00:00:00+07:00`);
  if (sampai) q = q.lte("created_at", `${sampai}T23:59:59.999+07:00`);
  const { data: log, error } = await q;

  const waktu = new Intl.DateTimeFormat("id-ID", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <section aria-labelledby="judul">
      <h1 id="judul" className="text-2xl font-semibold tracking-tight">Audit log</h1>
      <p className="mt-1 text-sm text-muted-foreground">Siapa melakukan apa dan kapan.</p>

      <form className="neu-raised mt-6 grid gap-3 rounded-3xl p-4 sm:grid-cols-[1fr_10rem_10rem_auto] sm:items-end">
        <div className="grid gap-1.5">
          <label htmlFor="aksi" className="text-xs text-muted-foreground">Aksi</label>
          <select
            id="aksi"
            name="aksi"
            defaultValue={aksi}
            className="neu-inset h-11 rounded-xl border border-transparent bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <option value="">Semua aksi</option>
            {Object.entries(AKSI).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="dari" className="text-xs text-muted-foreground">Dari</label>
          <Input id="dari" name="dari" type="date" defaultValue={dari} />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="sampai" className="text-xs text-muted-foreground">Sampai</label>
          <Input id="sampai" name="sampai" type="date" defaultValue={sampai} />
        </div>
        <button type="submit" className={buttonVariants({ size: "lg" })}>Terapkan</button>
      </form>

      <div className="neu-raised mt-6 overflow-x-auto rounded-3xl p-4 sm:p-5">
        {error ? (
          <p role="alert" className="text-sm text-destructive">Audit log gagal dimuat.</p>
        ) : !log?.length ? (
          <p className="text-sm text-muted-foreground">Tidak ada catatan untuk filter ini.</p>
        ) : (
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th scope="col" className="py-2 pr-3 font-medium">Waktu (WIB)</th>
                <th scope="col" className="py-2 pr-3 font-medium">Oleh</th>
                <th scope="col" className="py-2 pr-3 font-medium">Aksi</th>
                <th scope="col" className="py-2 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {log.map((l) => (
                <tr key={l.id} className="border-t border-black/5 align-top">
                  <td className="py-2.5 pr-3 whitespace-nowrap tabular-nums">{waktu.format(new Date(l.created_at))}</td>
                  <td className="py-2.5 pr-3">
                    <span className="block font-medium">{l.profiles?.nama ?? (l.aksi.endsWith("_otomatis") ? "Sistem" : "—")}</span>
                    <span className="block text-xs text-muted-foreground capitalize">{l.profiles?.role}</span>
                  </td>
                  <td className="py-2.5 pr-3 whitespace-nowrap">{AKSI[l.aksi] ?? l.aksi}</td>
                  <td className="max-w-md py-2.5 font-mono text-xs break-all text-muted-foreground">
                    {Object.entries((l.data ?? {}) as Record<string, unknown>)
                      .filter(([, v]) => v !== null && v !== undefined)
                      .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
                      .join(" · ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {log?.length === BATAS && <p className="mt-3 text-xs text-muted-foreground">Menampilkan {BATAS} catatan terbaru. Persempit filter untuk melihat yang lebih lama.</p>}
      </div>
    </section>
  );
}
