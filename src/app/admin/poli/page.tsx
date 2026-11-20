import { createClient } from "@/lib/supabase/server";
import { PoliDialog } from "../forms";

export const metadata = { title: "Poli" };

export default async function Page() {
  const supabase = await createClient();
  const { data: polis } = await supabase.from("polis").select("id, nama, kode_prefix, warna, aktif").order("nama");

  return (
    <section aria-labelledby="judul">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="judul" className="text-2xl font-semibold tracking-tight">Poli</h1>
          <p className="mt-1 text-sm text-muted-foreground">Prefix dipakai di nomor antrean, mis. U-001.</p>
        </div>
        <PoliDialog />
      </div>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {(polis ?? []).map((p) => (
          <li key={p.id} className="neu-raised flex items-center gap-4 rounded-2xl p-4">
            <span className="neu-ink grid size-11 shrink-0 place-items-center rounded-xl font-semibold">{p.kode_prefix}</span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 truncate font-medium">
                <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: p.warna }} />
                {p.nama}
              </p>
              <p className="text-xs text-muted-foreground">{p.aktif ? "Aktif" : "Nonaktif"}</p>
            </div>
            <PoliDialog poli={p} />
          </li>
        ))}
      </ul>
    </section>
  );
}
