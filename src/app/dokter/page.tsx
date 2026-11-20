import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { dayOfWeek, todayWib } from "@/lib/time";
import { DOKTER_COLUMNS } from "@/lib/antrean-live";
import { DokterBoard, type DokterRow } from "./board";

export const metadata = { title: "Pasien hari ini" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const today = todayWib();
  const supabase = await createClient();
  const { data: dokterId } = await supabase.rpc("my_dokter_id");
  if (!dokterId) redirect("/");

  const [dokter, jadwal, antrean] = await Promise.all([
    supabase.from("dokters").select("nama, polis(nama, warna)").eq("id", dokterId).single(),
    supabase.from("jadwal_praktik").select("id, jam_mulai, jam_selesai").eq("dokter_id", dokterId).eq("hari", dayOfWeek(today)).order("jam_mulai"),
    supabase.from("antrean").select(DOKTER_COLUMNS).eq("tanggal", today).eq("dokter_id", dokterId),
  ]);

  return (
    <DokterBoard
      tanggal={today}
      dokterId={dokterId}
      nama={dokter.data?.nama ?? "Dokter"}
      poli={dokter.data?.polis?.nama ?? ""}
      warna={dokter.data?.polis?.warna ?? ""}
      sesi={jadwal.data ?? []}
      initial={(antrean.data ?? []) as unknown as DokterRow[]}
    />
  );
}
