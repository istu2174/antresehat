import { createClient } from "@/lib/supabase/server";
import { dayOfWeek, todayWib } from "@/lib/time";
import { STAFF_COLUMNS } from "@/lib/antrean-live";
import { Dashboard, type DokterHariIni, type StaffRow } from "./dashboard";

export const metadata = { title: "Dashboard resepsionis" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const today = todayWib();
  const supabase = await createClient();

  const [dokters, jadwal, libur, antrean] = await Promise.all([
    supabase.from("dokters").select("id, nama, poli_id, polis(nama, warna, kode_prefix)").eq("aktif", true).order("nama"),
    supabase.from("jadwal_praktik").select("id, dokter_id, jam_mulai, jam_selesai").eq("aktif", true).eq("hari", dayOfWeek(today)).order("jam_mulai"),
    supabase.from("libur").select("dokter_id").eq("tanggal", today),
    supabase.from("antrean").select(STAFF_COLUMNS).eq("tanggal", today),
  ]);

  const klinikLibur = (libur.data ?? []).some((l) => l.dokter_id === null);
  const cuti = new Set((libur.data ?? []).map((l) => l.dokter_id));

  // Dokter yang praktik hari ini (punya jadwal & tidak cuti), plus sesinya.
  const praktik: DokterHariIni[] = klinikLibur
    ? []
    : (dokters.data ?? [])
        .filter((d) => d.polis && !cuti.has(d.id))
        .map((d) => ({
          id: d.id,
          nama: d.nama,
          poli_id: d.poli_id,
          poli: d.polis!.nama,
          warna: d.polis!.warna,
          sesi: (jadwal.data ?? []).filter((j) => j.dokter_id === d.id),
        }))
        .filter((d) => d.sesi.length > 0);

  return (
    <Dashboard
      tanggal={today}
      dokters={praktik}
      klinikLibur={klinikLibur}
      initial={(antrean.data ?? []) as unknown as StaffRow[]}
    />
  );
}
