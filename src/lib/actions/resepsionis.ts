"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { pesanError } from "@/lib/antrean";
import { BATAS_DILEWATI, pilihBerikutnya, STATUS_MENUNGGU, urutanSetelahLewati } from "@/lib/antrean-live";
import type { Json } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { todayWib } from "@/lib/time";

export type AksiResult = { error?: string; pesan?: string; kode?: string };

const idSchema = z.uuid("Data antrean tidak valid");
const kodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6,16}$/, "Kode tiket tidak valid");

/**
 * Semua aksi resepsionis lewat sini: pastikan yang memanggil resepsionis/admin.
 * RLS di database tetap jadi pagar terakhir (policy "antrean: resepsionis/admin ubah").
 */
async function staf() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sesi habis. Silakan masuk lagi." } as const;
  const { data: role } = await supabase.rpc("app_role");
  if (role !== "resepsionis" && role !== "admin") return { error: "Hanya resepsionis yang boleh melakukan ini." } as const;

  const audit = (aksi: string, entitasId: string, data: Json = {}) =>
    supabase.from("audit_log").insert({ actor_id: user.id, aksi, entitas: "antrean", entitas_id: entitasId, data });
  return { supabase, user, audit } as const;
}

type Db = Awaited<ReturnType<typeof createClient>>;

/** Antrean hari ini milik satu baris (untuk dicek sebelum diubah). */
async function ambilHariIni(supabase: Db, id: string) {
  return supabase
    .from("antrean")
    .select("id, jadwal_id, dokter_id, nomor_label, status, urutan, jumlah_dilewati, tanggal")
    .eq("id", id)
    .eq("tanggal", todayWib())
    .maybeSingle();
}

// ───────────── Panggil ─────────────

export async function panggilBerikutnya(dokterId: string): Promise<AksiResult> {
  const parsed = idSchema.safeParse(dokterId);
  if (!parsed.success) return { error: "Pilih dokter dulu." };
  const s = await staf();
  if ("error" in s) return { error: s.error };

  // Dua klik bersamaan: update bersyarat (status masih siap) memastikan satu nomor tidak dipanggil dua kali.
  for (let percobaan = 0; percobaan < 3; percobaan++) {
    const { data: rows, error } = await s.supabase
      .from("antrean")
      .select("id, nomor_label, status, urutan, jadwal_praktik(jam_mulai)")
      .eq("tanggal", todayWib())
      .eq("dokter_id", parsed.data)
      .in("status", ["check_in", "dilewati"]);
    if (error) return { error: "Gagal memuat antrean. Coba lagi." };

    const next = pilihBerikutnya(rows.map((r) => ({ ...r, jam_mulai: r.jadwal_praktik?.jam_mulai ?? "" })));
    if (!next) return { error: "Tidak ada pasien yang sudah check-in untuk dokter ini." };

    const { data: hasil } = await s.supabase
      .from("antrean")
      .update({ status: "dipanggil", waktu_dipanggil: new Date().toISOString() })
      .eq("id", next.id)
      .eq("status", next.status)
      .select("id")
      .maybeSingle();
    if (hasil) {
      await s.audit("panggil", next.id, { nomor: next.nomor_label });
      return { pesan: `${next.nomor_label} dipanggil.` };
    }
  }
  return { error: "Antrean sedang berubah. Coba lagi." };
}

export async function panggilUlang(antreanId: string): Promise<AksiResult> {
  const parsed = idSchema.safeParse(antreanId);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const s = await staf();
  if ("error" in s) return { error: s.error };

  const { data: row } = await ambilHariIni(s.supabase, parsed.data);
  if (!row || row.status !== "dipanggil") return { error: "Hanya nomor yang sedang dipanggil yang bisa dipanggil ulang." };

  // waktu_dipanggil baru → tiket pasien & layar TV mengumumkan lagi.
  await s.supabase.from("antrean").update({ waktu_dipanggil: new Date().toISOString() }).eq("id", row.id);
  await s.audit("panggil_ulang", row.id, { nomor: row.nomor_label });
  return { pesan: `${row.nomor_label} dipanggil ulang.` };
}

// ───────────── Lewati / tidak datang ─────────────

export async function lewati(antreanId: string): Promise<AksiResult> {
  const parsed = idSchema.safeParse(antreanId);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const s = await staf();
  if ("error" in s) return { error: s.error };

  const { data: row } = await ambilHariIni(s.supabase, parsed.data);
  if (!row || !["dipanggil", "check_in", "dilewati"].includes(row.status)) {
    return { error: "Nomor ini tidak bisa dilewati." };
  }

  const jumlah = row.jumlah_dilewati + 1;
  if (jumlah >= BATAS_DILEWATI) {
    await s.supabase.from("antrean").update({ status: "tidak_datang", jumlah_dilewati: jumlah }).eq("id", row.id);
    await s.audit("lewati", row.id, { nomor: row.nomor_label, jumlah, hasil: "tidak_datang" });
    return { pesan: `${row.nomor_label} sudah dilewati ${jumlah}× → ditandai tidak datang.` };
  }

  // shortcut: hitung posisi di server (bukan di dalam transaksi DB); cukup untuk satu meja resepsionis.
  const { data: antre } = await s.supabase
    .from("antrean")
    .select("urutan")
    .eq("tanggal", row.tanggal)
    .eq("jadwal_id", row.jadwal_id)
    .in("status", STATUS_MENUNGGU)
    .neq("id", row.id);
  const urutan = urutanSetelahLewati(Number(row.urutan), (antre ?? []).map((a) => ({ urutan: Number(a.urutan) })));

  await s.supabase.from("antrean").update({ status: "dilewati", jumlah_dilewati: jumlah, urutan }).eq("id", row.id);
  await s.audit("lewati", row.id, { nomor: row.nomor_label, jumlah, urutan_lama: row.urutan, urutan_baru: urutan });
  return { pesan: `${row.nomor_label} dilewati, dipindah 3 posisi ke belakang.` };
}

export async function tandaiTidakDatang(antreanId: string): Promise<AksiResult> {
  const parsed = idSchema.safeParse(antreanId);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const s = await staf();
  if ("error" in s) return { error: s.error };

  const { data: row } = await ambilHariIni(s.supabase, parsed.data);
  if (!row || !["menunggu", "check_in", "dipanggil", "dilewati"].includes(row.status)) {
    return { error: "Nomor ini tidak bisa ditandai tidak datang." };
  }
  await s.supabase.from("antrean").update({ status: "tidak_datang" }).eq("id", row.id);
  await s.audit("tidak_datang", row.id, { nomor: row.nomor_label, status_lama: row.status });
  return { pesan: `${row.nomor_label} ditandai tidak datang.` };
}

// ───────────── Check-in ─────────────

export async function checkIn(kode: string): Promise<AksiResult> {
  const parsed = kodeSchema.safeParse(kode);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const s = await staf();
  if ("error" in s) return { error: s.error };

  const { data: row } = await s.supabase
    .from("antrean")
    .select("id, nomor_label, status, tanggal")
    .eq("kode_tiket", parsed.data)
    .maybeSingle();
  if (!row) return { error: "Tiket tidak ditemukan." };
  if (row.tanggal !== todayWib()) return { error: `Tiket ${row.nomor_label} untuk tanggal ${row.tanggal}, bukan hari ini.` };
  if (row.status !== "menunggu") return { error: `${row.nomor_label} tidak bisa check-in (status sekarang: ${row.status.replace("_", " ")}).` };

  await s.supabase.from("antrean").update({ status: "check_in", waktu_checkin: new Date().toISOString() }).eq("id", row.id);
  await s.audit("check_in", row.id, { nomor: row.nomor_label });
  return { pesan: `${row.nomor_label} berhasil check-in.` };
}

// ───────────── Walk-in ─────────────

const cariSchema = z
  .string()
  .trim()
  .regex(/^[\p{L}\p{N} .'+-]{2,40}$/u, "Ketik minimal 2 huruf/angka (nama atau no. HP)");

export type PasienRingkas = { id: string; nama: string; no_hp: string | null; tgl_lahir: string | null };

export async function cariPasien(q: string): Promise<{ error?: string; hasil?: PasienRingkas[] }> {
  const parsed = cariSchema.safeParse(q);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const s = await staf();
  if ("error" in s) return { error: s.error };

  const pola = `%${parsed.data}%`;
  const { data, error } = await s.supabase
    .from("profiles")
    .select("id, nama, no_hp, tgl_lahir")
    .eq("role", "pasien")
    .or(`nama.ilike.${pola},no_hp.ilike.${pola}`)
    .order("nama")
    .limit(8);
  if (error) return { error: "Pencarian gagal. Coba lagi." };
  return { hasil: data };
}

const pasienBaruSchema = z.object({
  nama: z.string().trim().min(3, "Nama minimal 3 karakter").max(80, "Nama maksimal 80 karakter"),
  no_hp: z.string().trim().regex(/^(\+62|0)8\d{7,12}$/, "Nomor HP tidak valid, contoh 081234567890"),
  tgl_lahir: z.iso.date("Tanggal lahir tidak valid").or(z.literal("")),
  jenis_kelamin: z.enum(["L", "P"], "Pilih jenis kelamin"),
});

const walkinSchema = z.object({
  jadwal_id: z.uuid("Pilih dokter & sesi"),
  pasien_id: z.uuid().optional(),
  baru: pasienBaruSchema.optional(),
});

export type WalkinInput = z.input<typeof walkinSchema>;

export async function daftarWalkin(input: WalkinInput): Promise<AksiResult & { fieldErrors?: Record<string, string> }> {
  const parsed = walkinSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path.at(-1))] ??= i.message;
    return { error: parsed.error.issues[0].message, fieldErrors };
  }
  const { jadwal_id, pasien_id, baru } = parsed.data;
  if (!pasien_id && !baru) return { error: "Pilih pasien lama atau isi data pasien baru." };

  const s = await staf();
  if ("error" in s) return { error: s.error };

  let pasienId = pasien_id;
  if (!pasienId && baru) {
    // Pasien walk-in tidak punya email: akun dibuat dengan email internal & password acak (tidak dipakai login).
    const admin = createAdminClient();
    const { data: dibuat, error } = await admin.auth.admin.createUser({
      email: `walkin.${randomBytes(6).toString("hex")}@antresehat.test`,
      password: randomBytes(24).toString("base64url"),
      email_confirm: true,
      user_metadata: { nama: baru.nama },
    });
    if (error || !dibuat.user) return { error: "Gagal membuat data pasien. Coba lagi." };
    pasienId = dibuat.user.id;
    await admin
      .from("profiles")
      .update({ nama: baru.nama, no_hp: baru.no_hp, tgl_lahir: baru.tgl_lahir || null, jenis_kelamin: baru.jenis_kelamin })
      .eq("id", pasienId);
  }

  // Kuota, sesi berakhir, libur, 1 antrean aktif per poli, anti nomor dobel → dicek fungsi Postgres.
  const { data: tiket, error } = await s.supabase.rpc("ambil_nomor_antrean", {
    p_jadwal_id: jadwal_id,
    p_tanggal: todayWib(),
    p_pasien_id: pasienId,
    p_sumber: "walkin",
  });
  if (error) {
    // Akun pasien baru yang gagal dapat nomor dihapus lagi supaya tidak menumpuk data yatim.
    if (baru && pasienId) await createAdminClient().auth.admin.deleteUser(pasienId);
    if (error.message === "SUDAH_BOOKING" || error.code === "23505") {
      return { error: "Pasien ini sudah punya antrean aktif di poli ini hari ini." };
    }
    if (error.message === "BOOKING_DITUTUP") return { error: "Sesi dokter ini sudah selesai." };
    return { error: pesanError(error) };
  }

  await s.audit("walkin", tiket.id, { nomor: tiket.nomor_label, pasien_baru: Boolean(baru) });
  return { pesan: `Nomor ${tiket.nomor_label} untuk pasien walk-in.`, kode: tiket.kode_tiket };
}
