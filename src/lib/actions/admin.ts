"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Json } from "@/lib/database.types";
import type { FormState } from "@/lib/schemas";
import { seedDemo } from "@/lib/seed-demo";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { todayWib } from "@/lib/time";

// Akun staf dibuat dengan domain demo supaya ikut terhapus saat "Reset data demo".
const DOMAIN = "antresehat.test";
// Akun seed dipakai semua pengunjung demo — password-nya tidak boleh diganti dari UI.
const AKUN_SEED = ["admin", "resepsionis", "dr.umum", "dr.gigi", "dr.anak", "dr.umum2", "pasien"].map((u) => `${u}@${DOMAIN}`);

/** Pastikan pemanggil admin. RLS tabel master tetap pagar terakhir. */
async function admin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sesi habis. Silakan masuk lagi." } as const;
  const { data: role } = await supabase.rpc("app_role");
  if (role !== "admin") return { error: "Hanya admin yang boleh melakukan ini." } as const;

  const audit = (aksi: string, entitas: string, entitasId: string | null, data: Json = {}) =>
    supabase.from("audit_log").insert({ actor_id: user.id, aksi, entitas, entitas_id: entitasId, data });
  return { supabase, user, audit } as const;
}

function gagalValidasi(error: z.ZodError, values: Record<string, string>): FormState {
  return { values, fieldErrors: z.flattenError(error).fieldErrors as FormState["fieldErrors"], error: "Periksa kembali isian." };
}
const nilai = (fd: FormData) => Object.fromEntries([...fd].map(([k, v]) => [k, String(v)])) as Record<string, string>;

const idOpsional = z.union([z.literal(""), z.uuid()]).transform((v) => v || null);
const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9.\-_]{2,29}$/, "3–30 huruf kecil/angka/titik, tanpa spasi");
const password = z.string().min(8, "Minimal 8 karakter").max(72, "Maksimal 72 karakter");

// ───────────── Poli ─────────────

const poliSchema = z.object({
  id: idOpsional,
  nama: z.string().trim().min(2, "Minimal 2 karakter").max(40, "Maksimal 40 karakter"),
  kode_prefix: z.string().trim().toUpperCase().regex(/^[A-Z]{1,2}$/, "1–2 huruf, mis. U"),
  warna: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Warna tidak valid"),
  aktif: z.literal("on").optional().transform(Boolean),
});

export async function simpanPoli(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = nilai(fd);
  const parsed = poliSchema.safeParse(values);
  if (!parsed.success) return gagalValidasi(parsed.error, values);
  const s = await admin();
  if ("error" in s) return { values, error: s.error };

  const { id, ...data } = parsed.data;
  const q = id ? s.supabase.from("polis").update(data).eq("id", id) : s.supabase.from("polis").insert(data);
  const { data: hasil, error } = await q.select("id").single();
  if (error) {
    if (error.code === "23505") return { values, fieldErrors: { kode_prefix: ["Prefix sudah dipakai poli lain"] } };
    return { values, error: "Poli gagal disimpan. Coba lagi." };
  }
  await s.audit(id ? "ubah_poli" : "tambah_poli", "polis", hasil.id, data);
  revalidatePath("/admin", "layout");
  return { success: `${data.nama} disimpan.` };
}

// ───────────── Dokter (+ akun login) ─────────────

const dokterSchema = z.object({
  id: idOpsional,
  nama: z.string().trim().min(3, "Minimal 3 karakter").max(80, "Maksimal 80 karakter"),
  spesialis: z.string().trim().min(2, "Minimal 2 karakter").max(60, "Maksimal 60 karakter"),
  poli_id: z.uuid("Pilih poli"),
  foto_url: z.union([z.literal(""), z.url("URL foto tidak valid").max(500)]).transform((v) => v || null),
  aktif: z.literal("on").optional().transform(Boolean),
  username: z.union([z.literal(""), username]).optional().transform((v) => v || null),
  password: z.string().optional(),
});

export async function simpanDokter(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = nilai(fd);
  delete values.password;
  const parsed = dokterSchema.safeParse(nilai(fd));
  if (!parsed.success) return gagalValidasi(parsed.error, values);
  const { id, username: user, password: pw, ...data } = parsed.data;
  if (user && !password.safeParse(pw).success) return { values, fieldErrors: { password: ["Minimal 8 karakter"] } };

  const s = await admin();
  if ("error" in s) return { values, error: s.error };

  // Akun login dibuat lebih dulu (service role, server saja), lalu ditautkan ke data dokter.
  let profileId: string | null = null;
  const adm = user ? createAdminClient() : null;
  if (adm && user) {
    const { data: dibuat, error } = await adm.auth.admin.createUser({
      email: `${user}@${DOMAIN}`,
      password: pw!,
      email_confirm: true,
      user_metadata: { nama: data.nama },
    });
    if (error || !dibuat.user) {
      return /already|exists|registered/i.test(error?.message ?? "")
        ? { values, fieldErrors: { username: ["Username sudah dipakai"] } }
        : { values, error: "Akun login gagal dibuat." };
    }
    profileId = dibuat.user.id;
    await adm.from("profiles").update({ role: "dokter", nama: data.nama }).eq("id", profileId);
  }

  const row = profileId ? { ...data, profile_id: profileId } : data;
  const q = id ? s.supabase.from("dokters").update(row).eq("id", id) : s.supabase.from("dokters").insert(row);
  const { data: hasil, error } = await q.select("id").single();
  if (error) {
    if (adm && profileId) await adm.auth.admin.deleteUser(profileId); // jangan tinggalkan akun yatim
    return { values, error: "Data dokter gagal disimpan. Coba lagi." };
  }
  await s.audit(id ? "ubah_dokter" : "tambah_dokter", "dokters", hasil.id, { ...data, akun: user ? `${user}@${DOMAIN}` : undefined });
  revalidatePath("/admin", "layout");
  return { success: `${data.nama} disimpan.${user ? ` Akun login: ${user}@${DOMAIN}` : ""}` };
}

// ───────────── Jadwal praktik ─────────────

const jam = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format jam 08:00");
const jadwalSchema = z
  .object({
    id: idOpsional,
    dokter_id: z.uuid("Pilih dokter"),
    hari: z.coerce.number().int().min(0).max(6),
    jam_mulai: jam,
    jam_selesai: jam,
    kuota: z.coerce.number({ error: "Isi angka" }).int().min(1, "Minimal 1").max(200, "Maksimal 200"),
    menit_per_pasien: z.coerce.number({ error: "Isi angka" }).int().min(1, "Minimal 1").max(120, "Maksimal 120"),
  })
  .refine((v) => v.jam_selesai > v.jam_mulai, { path: ["jam_selesai"], message: "Harus setelah jam mulai" });

export async function simpanJadwal(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = nilai(fd);
  const parsed = jadwalSchema.safeParse(values);
  if (!parsed.success) return gagalValidasi(parsed.error, values);
  const s = await admin();
  if ("error" in s) return { values, error: s.error };
  const { id, ...data } = parsed.data;

  // Sesi dokter yang sama di hari yang sama tidak boleh bertumpuk.
  const { data: lain } = await s.supabase
    .from("jadwal_praktik")
    .select("id, jam_mulai, jam_selesai")
    .eq("dokter_id", data.dokter_id)
    .eq("hari", data.hari)
    .eq("aktif", true);
  const bentrok = (lain ?? []).find((j) => j.id !== id && j.jam_mulai.slice(0, 5) < data.jam_selesai && data.jam_mulai < j.jam_selesai.slice(0, 5));
  if (bentrok) {
    return { values, fieldErrors: { jam_mulai: [`Bentrok dengan sesi ${bentrok.jam_mulai.slice(0, 5)}–${bentrok.jam_selesai.slice(0, 5)}`] } };
  }

  const q = id ? s.supabase.from("jadwal_praktik").update(data).eq("id", id) : s.supabase.from("jadwal_praktik").insert(data);
  const { data: hasil, error } = await q.select("id").single();
  if (error) return { values, error: "Jadwal gagal disimpan. Coba lagi." };
  await s.audit(id ? "ubah_jadwal" : "tambah_jadwal", "jadwal_praktik", hasil.id, data);
  revalidatePath("/admin", "layout");
  return { success: "Jadwal disimpan." };
}

export async function hapusJadwal(id: string): Promise<FormState> {
  if (!z.uuid().safeParse(id).success) return { error: "Data tidak valid" };
  const s = await admin();
  if ("error" in s) return { error: s.error };
  // Dinonaktifkan, bukan dihapus: antrean lama masih merujuk jadwal ini.
  const { error } = await s.supabase.from("jadwal_praktik").update({ aktif: false }).eq("id", id);
  if (error) return { error: "Jadwal gagal dihapus." };
  await s.audit("hapus_jadwal", "jadwal_praktik", id);
  revalidatePath("/admin", "layout");
  return { success: "Jadwal dihapus." };
}

// ───────────── Hari libur / cuti ─────────────

export type Terdampak = { nomor_label: string; nama: string; no_hp: string | null };
export type LiburState = FormState & { terdampak?: Terdampak[] };

const liburSchema = z.object({
  tanggal: z.iso.date("Pilih tanggal").refine((d) => d >= todayWib(), "Tanggal sudah lewat"),
  dokter_id: idOpsional,
  keterangan: z.string().trim().min(2, "Isi keterangan, mis. Cuti bersama").max(100, "Maksimal 100 karakter"),
});

export async function tambahLibur(_prev: LiburState, fd: FormData): Promise<LiburState> {
  const values = nilai(fd);
  const parsed = liburSchema.safeParse(values);
  if (!parsed.success) return gagalValidasi(parsed.error, values);
  const s = await admin();
  if ("error" in s) return { values, error: s.error };
  const data = parsed.data;

  const { data: libur, error } = await s.supabase.from("libur").insert(data).select("id").single();
  if (error) {
    return error.code === "23505"
      ? { values, fieldErrors: { tanggal: ["Libur untuk tanggal & dokter ini sudah ada"] } }
      : { values, error: "Libur gagal disimpan." };
  }

  // Booking ditutup otomatis oleh ambil_nomor_antrean(); yang sudah terlanjur booking dibatalkan.
  let q = s.supabase
    .from("antrean")
    .update({ status: "batal" })
    .eq("tanggal", data.tanggal)
    .in("status", ["menunggu", "check_in", "dilewati"]);
  if (data.dokter_id) q = q.eq("dokter_id", data.dokter_id);
  const { data: batal } = await q.select("nomor_label, profiles(nama, no_hp)");
  const terdampak = (batal ?? []).map((b) => ({ nomor_label: b.nomor_label, nama: b.profiles?.nama ?? "—", no_hp: b.profiles?.no_hp ?? null }));

  await s.audit("tambah_libur", "libur", libur.id, { ...data, dibatalkan: terdampak.map((t) => t.nomor_label) });
  revalidatePath("/admin", "layout");
  return {
    success: terdampak.length ? `Libur disimpan. ${terdampak.length} booking dibatalkan.` : "Libur disimpan. Tidak ada booking yang terdampak.",
    terdampak,
  };
}

export async function hapusLibur(id: string): Promise<FormState> {
  if (!z.uuid().safeParse(id).success) return { error: "Data tidak valid" };
  const s = await admin();
  if ("error" in s) return { error: s.error };
  const { error } = await s.supabase.from("libur").delete().eq("id", id);
  if (error) return { error: "Libur gagal dihapus." };
  await s.audit("hapus_libur", "libur", id);
  revalidatePath("/admin", "layout");
  return { success: "Libur dihapus. Booking yang sudah dibatalkan tidak dipulihkan." };
}

// ───────────── Akun staf ─────────────

const stafSchema = z.object({
  nama: z.string().trim().min(3, "Minimal 3 karakter").max(80, "Maksimal 80 karakter"),
  username,
  password,
});

export async function buatResepsionis(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = nilai(fd);
  delete values.password;
  const parsed = stafSchema.safeParse(nilai(fd));
  if (!parsed.success) return gagalValidasi(parsed.error, values);
  const s = await admin();
  if ("error" in s) return { values, error: s.error };

  const adm = createAdminClient();
  const email = `${parsed.data.username}@${DOMAIN}`;
  const { data, error } = await adm.auth.admin.createUser({
    email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { nama: parsed.data.nama },
  });
  if (error || !data.user) {
    return /already|exists|registered/i.test(error?.message ?? "")
      ? { values, fieldErrors: { username: ["Username sudah dipakai"] } }
      : { values, error: "Akun gagal dibuat." };
  }
  // Role tidak bisa diubah dari klien (lihat grant profiles) → lewat service role.
  await adm.from("profiles").update({ role: "resepsionis", nama: parsed.data.nama }).eq("id", data.user.id);
  await s.audit("buat_staf", "profiles", data.user.id, { email, role: "resepsionis" });
  revalidatePath("/admin/staf");
  return { success: `Akun ${email} dibuat.` };
}

const resetSchema = z.object({ id: z.uuid("Akun tidak valid"), password });

export async function resetPassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = resetSchema.safeParse(nilai(fd));
  if (!parsed.success) return gagalValidasi(parsed.error, {});
  const s = await admin();
  if ("error" in s) return { error: s.error };

  const adm = createAdminClient();
  const [{ data: profil }, { data: u }] = await Promise.all([
    s.supabase.from("profiles").select("role").eq("id", parsed.data.id).single(),
    adm.auth.admin.getUserById(parsed.data.id),
  ]);
  if (!profil || profil.role === "pasien" || !u.user) return { error: "Hanya akun staf yang bisa direset di sini." };
  if (AKUN_SEED.includes(u.user.email ?? "")) return { error: "Password akun demo bawaan tidak bisa diganti supaya demo tetap bisa dipakai semua orang." };

  const { error } = await adm.auth.admin.updateUserById(parsed.data.id, { password: parsed.data.password });
  if (error) return { error: "Password gagal direset." };
  await s.audit("reset_password", "profiles", parsed.data.id, { email: u.user.email });
  return { success: `Password ${u.user.email} sudah diganti.` };
}

// ───────────── Reset data demo ─────────────

export async function resetDataDemo(): Promise<FormState> {
  const s = await admin();
  if ("error" in s) return { error: s.error };
  try {
    await seedDemo(createAdminClient(), () => {});
  } catch {
    return { error: "Reset gagal di tengah jalan. Coba sekali lagi." };
  }
  // Akun admin ikut dibuat ulang (id baru) → sesi lama tidak berlaku lagi.
  await s.supabase.auth.signOut();
  redirect(`/login?reset=${randomUUID().slice(0, 8)}`);
}
