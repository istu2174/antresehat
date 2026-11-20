import type { Metadata } from "next";
import { hitungSlot, HARI_BOOKING } from "@/lib/booking";
import { createClient } from "@/lib/supabase/server";
import { addDays, todayWib } from "@/lib/time";
import { BookingWizard } from "./wizard";

export const metadata: Metadata = { title: "Booking" };

export default async function BookingPage() {
  const supabase = await createClient();
  const today = todayWib();
  const sampai = addDays(today, HARI_BOOKING - 1);

  const [polis, dokters, jadwal, libur, terpakai] = await Promise.all([
    supabase.from("polis").select("id, nama, warna, kode_prefix").eq("aktif", true).order("nama"),
    supabase.from("dokters").select("id, poli_id, nama, spesialis, foto_url").eq("aktif", true).order("nama"),
    supabase.from("jadwal_praktik").select("id, dokter_id, hari, jam_mulai, jam_selesai, kuota, menit_per_pasien").eq("aktif", true),
    supabase.from("libur").select("tanggal, dokter_id").gte("tanggal", today).lte("tanggal", sampai),
    supabase.rpc("kuota_terpakai", { p_dari: today, p_sampai: sampai }),
  ]);

  const gagal = polis.error || dokters.error || jadwal.error || libur.error || terpakai.error;

  return (
    <div className="mx-auto max-w-xl pt-8 sm:pt-12">
      <h1 className="text-2xl font-semibold tracking-tight">Booking antrean</h1>
      <p className="mt-1 text-sm text-muted-foreground">Pilih poli, dokter, tanggal, dan sesi. Nomor antrean langsung keluar.</p>

      {gagal ? (
        <p role="alert" className="neu-inset mt-8 rounded-2xl p-5 text-sm text-destructive">
          Jadwal gagal dimuat. Muat ulang halaman ini.
        </p>
      ) : (
        <BookingWizard
          polis={polis.data!}
          dokters={dokters.data!.filter((d) => polis.data!.some((p) => p.id === d.poli_id))}
          slots={hitungSlot(jadwal.data!, terpakai.data!, libur.data!, today, new Date())}
          today={today}
        />
      )}
    </div>
  );
}
