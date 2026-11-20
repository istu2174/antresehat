import { PUBLIC_COLUMNS, type PublicAntrean } from "@/lib/antrean-live";
import { createPublicClient } from "@/lib/supabase/public";
import { todayWib } from "@/lib/time";
import { DisplayBoard } from "./board";

export const metadata = { title: "Layar antrean" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const today = todayWib();
  const db = createPublicClient();
  const [polis, dokters, antrean] = db
    ? await Promise.all([
        db.from("polis").select("id, nama, warna").eq("aktif", true).order("nama"),
        db.from("dokters").select("id, nama").eq("aktif", true),
        db.from("antrean").select(PUBLIC_COLUMNS).eq("tanggal", today),
      ])
    : [];

  return (
    <DisplayBoard
      tanggal={today}
      polis={polis?.data ?? []}
      dokters={dokters?.data ?? []}
      initial={(antrean?.data ?? []) as unknown as PublicAntrean[]}
    />
  );
}
