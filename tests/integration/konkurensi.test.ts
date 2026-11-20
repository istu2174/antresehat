// Test konkurensi ke database Supabase sungguhan (butuh .env.local; di CI otomatis di-skip).
// 20 booking paralel ke satu sesi berkuota 15 → nomor harus unik dan tidak melebihi kuota.
// Semua data uji (jadwal + pasien sementara) dihapus lagi di afterAll.
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { formatNomor } from "@/lib/antrean";
import type { Database } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDays, dayOfWeek, todayWib } from "@/lib/time";

const ADA_DB = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL);
const JUMLAH = 20;
const KUOTA = 15;

describe.skipIf(!ADA_DB)("booking paralel (PRD 12: nomor tidak pernah dobel)", () => {
  const admin = ADA_DB ? createAdminClient() : (null as never);
  const pasienIds: string[] = [];
  let jadwalId = "";
  let tanggal = "";

  beforeAll(async () => {
    const { data: dokter } = await admin.from("dokters").select("id, poli_id").eq("aktif", true).limit(1).single();
    if (!dokter) throw new Error("Belum ada dokter — jalankan npm run db:seed");

    // Tanggal H+1…H+7 yang bukan hari libur; jadwal uji dibuat khusus untuk hari itu.
    const { data: libur } = await admin.from("libur").select("tanggal").gte("tanggal", todayWib());
    tanggal = [1, 2, 3, 4, 5, 6, 7].map((n) => addDays(todayWib(), n)).find((t) => !libur?.some((l) => l.tanggal === t))!;

    const { data: jadwal, error } = await admin
      .from("jadwal_praktik")
      .insert({ dokter_id: dokter.id, hari: dayOfWeek(tanggal), jam_mulai: "05:00", jam_selesai: "06:00", kuota: KUOTA, menit_per_pasien: 3 })
      .select("id")
      .single();
    if (error) throw error;
    jadwalId = jadwal.id;

    const stamp = Date.now();
    const users = await Promise.all(
      Array.from({ length: JUMLAH }, (_, i) =>
        admin.auth.admin.createUser({
          email: `uji-konkurensi-${stamp}-${i}@antresehat.test`,
          password: crypto.randomUUID(),
          email_confirm: true,
          user_metadata: { nama: `Pasien Uji ${i + 1}` },
        }),
      ),
    );
    for (const u of users) {
      if (u.error) throw u.error;
      pasienIds.push(u.data.user.id);
    }
  });

  afterAll(async () => {
    if (!ADA_DB) return;
    // Hapus pasien → antrean ikut terhapus (on delete cascade), lalu jadwal ujinya.
    await Promise.all(pasienIds.map((id) => admin.auth.admin.deleteUser(id)));
    if (jadwalId) await admin.from("jadwal_praktik").delete().eq("id", jadwalId);
  });

  it(`${JUMLAH} booking bersamaan → ${KUOTA} nomor unik, sisanya KUOTA_HABIS`, async () => {
    // Masuk sebagai resepsionis demo (boleh mendaftarkan pasien lain) lewat API publik — RLS & fungsi DB berlaku penuh.
    const resepsionis = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    const { error: loginError } = await resepsionis.auth.signInWithPassword({ email: "resepsionis@antresehat.test", password: "demo1234" });
    if (loginError) throw loginError;

    const hasil = await Promise.all(
      pasienIds.map((id) => resepsionis.rpc("ambil_nomor_antrean", { p_jadwal_id: jadwalId, p_tanggal: tanggal, p_pasien_id: id })),
    );

    const berhasil = hasil.filter((h) => !h.error).map((h) => h.data!);
    const gagal = hasil.filter((h) => h.error).map((h) => h.error!.message);

    expect(berhasil).toHaveLength(KUOTA);
    expect(gagal).toEqual(Array(JUMLAH - KUOTA).fill("KUOTA_HABIS"));
    expect(new Set(berhasil.map((b) => b.nomor)).size).toBe(KUOTA);
    expect(new Set(berhasil.map((b) => b.nomor_label)).size).toBe(KUOTA);
    for (const b of berhasil) expect(b.nomor_label).toMatch(/^[A-Z]+-\d{3,}$/);

    // Cek ulang langsung di tabel: jumlah baris sesi = kuota, nomor berurutan tanpa celah.
    const { data: rows } = await admin.from("antrean").select("nomor, nomor_label, polis(kode_prefix)").eq("jadwal_id", jadwalId).order("nomor");
    expect(rows).toHaveLength(KUOTA);
    const nomor = rows!.map((r) => r.nomor);
    expect(nomor).toEqual(Array.from({ length: KUOTA }, (_, i) => nomor[0] + i));
    for (const r of rows!) expect(r.nomor_label).toBe(formatNomor(r.polis!.kode_prefix, r.nomor));

    await resepsionis.auth.signOut();
  });
});
