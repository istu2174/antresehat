import { DoctorAvatar } from "@/components/doctor-avatar";
import { createClient } from "@/lib/supabase/server";
import { DokterDialog } from "../forms";

export const metadata = { title: "Dokter" };

export default async function Page() {
  const supabase = await createClient();
  const [{ data: dokters }, { data: polis }] = await Promise.all([
    supabase.from("dokters").select("id, nama, spesialis, poli_id, foto_url, aktif, profile_id, polis(nama, warna)").order("nama"),
    supabase.from("polis").select("id, nama").order("nama"),
  ]);

  return (
    <section aria-labelledby="judul">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="judul" className="text-2xl font-semibold tracking-tight">Dokter</h1>
          <p className="mt-1 text-sm text-muted-foreground">Data dokter, poli, dan akun login.</p>
        </div>
        <DokterDialog polis={polis ?? []} />
      </div>
      <ul className="mt-6 grid gap-3 md:grid-cols-2">
        {(dokters ?? []).map(({ polis: poli, ...d }) => (
          <li key={d.id} className="neu-raised flex items-center gap-4 rounded-2xl p-4">
            <DoctorAvatar nama={d.nama} fotoUrl={d.foto_url} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{d.nama}</p>
              <p className="flex items-center gap-2 truncate text-sm text-muted-foreground">
                {poli && <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: poli.warna }} />}
                {poli?.nama} · {d.spesialis}
              </p>
              <p className="text-xs text-muted-foreground">
                {d.aktif ? "Aktif" : "Nonaktif"} · {d.profile_id ? "Punya akun login" : "Belum punya akun login"}
              </p>
            </div>
            <DokterDialog dokter={d} polis={polis ?? []} />
          </li>
        ))}
      </ul>
    </section>
  );
}
