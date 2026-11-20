"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { pesanError, STATUS_AKTIF } from "@/lib/antrean";
import { createClient } from "@/lib/supabase/server";

const bookingSchema = z.object({
  jadwal_id: z.uuid("Jadwal tidak valid"),
  tanggal: z.iso.date("Tanggal tidak valid"),
});
const kodeSchema = z.string().regex(/^[A-Z0-9]{6,16}$/, "Kode tiket tidak valid");

export type BookingResult = { error?: string; kodeAktif?: string };

export async function buatBooking(input: z.input<typeof bookingSchema>): Promise<BookingResult> {
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { jadwal_id, tanggal } = parsed.data;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Semua aturan (kuota, libur, H+7, 1 booking aktif, anti nomor dobel) dicek di fungsi Postgres.
  const { data, error } = await supabase.rpc("ambil_nomor_antrean", { p_jadwal_id: jadwal_id, p_tanggal: tanggal });

  if (error) {
    const result: BookingResult = { error: pesanError(error) };
    if (error.message === "SUDAH_BOOKING" || error.code === "23505") {
      // Bantu pasien langsung membuka tiket yang sudah ada.
      const { data: jadwal } = await supabase.from("jadwal_praktik").select("dokters(poli_id)").eq("id", jadwal_id).single();
      const poliId = jadwal?.dokters?.poli_id;
      if (poliId) {
        const { data: aktif } = await supabase
          .from("antrean")
          .select("kode_tiket")
          .eq("pasien_id", user.id)
          .eq("tanggal", tanggal)
          .eq("poli_id", poliId)
          .in("status", STATUS_AKTIF)
          .maybeSingle();
        result.kodeAktif = aktif?.kode_tiket;
      }
    }
    return result;
  }

  revalidatePath("/riwayat");
  redirect(`/tiket/${data.kode_tiket}`);
}

export async function batalkanBooking(kode: string): Promise<{ error?: string }> {
  const parsed = kodeSchema.safeParse(kode);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("batalkan_booking", { p_kode: parsed.data });
  if (error) return { error: pesanError(error) };

  revalidatePath(`/tiket/${parsed.data}`);
  revalidatePath("/riwayat");
  return {};
}
