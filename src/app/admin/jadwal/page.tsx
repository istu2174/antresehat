import { createClient } from "@/lib/supabase/server";
import { HARI } from "@/lib/time";
import { JadwalDialog } from "../forms";

export const metadata = { title: "Jadwal praktik" };

const URUTAN_HARI = [1, 2, 3, 4, 5, 6, 0]; // Senin dulu

export default async function Page() {
  const supabase = await createClient();
  const [{ data: dokters }, { data: jadwal }] = await Promise.all([
    supabase.from("dokters").select("id, nama, polis(nama, warna)").eq("aktif", true).order("nama"),
    supabase
      .from("jadwal_praktik")
      .select("id, dokter_id, hari, jam_mulai, jam_selesai, kuota, menit_per_pasien")
      .eq("aktif", true)
      .order("jam_mulai"),
  ]);

  return (
    <section aria-labelledby="judul">
      <h1 id="judul" className="text-2xl font-semibold tracking-tight">Jadwal praktik</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Klik sesi untuk mengubah, atau + untuk menambah. Perubahan langsung berlaku untuk booking berikutnya.
      </p>

      <div className="neu-raised mt-6 overflow-x-auto rounded-3xl p-4">
        <table className="w-full min-w-[66rem] table-fixed border-separate border-spacing-1.5 text-sm">
          <caption className="sr-only">Jadwal praktik mingguan per dokter</caption>
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th scope="col" className="w-48 px-1 font-medium">Dokter</th>
              {URUTAN_HARI.map((h) => (
                <th key={h} scope="col" className="px-1 font-medium">{HARI[h]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(dokters ?? []).map((d) => (
              <tr key={d.id} className="align-top">
                <th scope="row" className="px-1 py-2 text-left font-medium">
                  <span className="block truncate">{d.nama}</span>
                  <span className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
                    {d.polis && <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: d.polis.warna }} />}
                    {d.polis?.nama}
                  </span>
                </th>
                {URUTAN_HARI.map((h) => (
                  <td key={h} className="neu-inset rounded-2xl p-1.5">
                    <div className="grid gap-1.5">
                      {(jadwal ?? [])
                        .filter((j) => j.dokter_id === d.id && j.hari === h)
                        .map((j) => (
                          <JadwalDialog key={j.id} jadwal={j} dokter={d} hari={h} />
                        ))}
                      <JadwalDialog dokter={d} hari={h} />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
