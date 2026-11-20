"use server";

import { z } from "zod";
import type { Json } from "@/lib/database.types";
import { ICD10 } from "@/lib/icd10";
import { createClient } from "@/lib/supabase/server";
import { todayWib } from "@/lib/time";

export type AksiDokter = { error?: string; pesan?: string; fieldErrors?: Record<string, string> };

const idSchema = z.uuid("Data tidak valid");

/** Pastikan pemanggil dokter dan ambil id dokternya. RLS tetap pagar terakhir. */
async function dokter() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sesi habis. Silakan masuk lagi." } as const;
  const [{ data: role }, { data: dokterId }] = await Promise.all([supabase.rpc("app_role"), supabase.rpc("my_dokter_id")]);
  if (role !== "dokter" || !dokterId) return { error: "Hanya dokter yang boleh melakukan ini." } as const;

  const audit = (aksi: string, entitasId: string, data: Json = {}) =>
    supabase.from("audit_log").insert({ actor_id: user.id, aksi, entitas: "antrean", entitas_id: entitasId, data });
  return { supabase, dokterId, audit } as const;
}

export async function mulaiPeriksa(antreanId: string): Promise<AksiDokter> {
  const parsed = idSchema.safeParse(antreanId);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const s = await dokter();
  if ("error" in s) return { error: s.error };

  const { data: sedang } = await s.supabase
    .from("antrean")
    .select("nomor_label")
    .eq("dokter_id", s.dokterId)
    .eq("tanggal", todayWib())
    .eq("status", "diperiksa")
    .limit(1)
    .maybeSingle();
  if (sedang) return { error: `Selesaikan pemeriksaan ${sedang.nomor_label} dulu.` };

  // Update bersyarat: hanya pasien milik dokter ini yang sudah dipanggil hari ini.
  const { data, error } = await s.supabase
    .from("antrean")
    .update({ status: "diperiksa", waktu_mulai: new Date().toISOString() })
    .eq("id", parsed.data)
    .eq("dokter_id", s.dokterId)
    .eq("tanggal", todayWib())
    .eq("status", "dipanggil")
    .select("id, nomor_label")
    .maybeSingle();
  if (error) return { error: "Gagal memulai pemeriksaan. Coba lagi." };
  if (!data) return { error: "Pasien belum dipanggil atau sudah diperiksa." };

  await s.audit("mulai_periksa", data.id, { nomor: data.nomor_label });
  return { pesan: `Mulai memeriksa ${data.nomor_label}.` };
}

const teks = (max: number) => z.string().trim().max(max, `Maksimal ${max} karakter`);
const angka = (min: number, max: number, pesan: string) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v.replace(",", "."))))
    .refine((v) => v === null || (Number.isFinite(v) && v >= min && v <= max), pesan);

const kunjunganSchema = z.object({
  keluhan: teks(1000).min(2, "Isi keluhan pasien"),
  tensi: z
    .string()
    .trim()
    .regex(/^(\d{2,3}\/\d{2,3})?$/, "Format tensi 120/80")
    .transform((v) => v || null),
  suhu: angka(30, 45, "Suhu 30–45 °C"),
  berat: angka(0, 300, "Berat 0–300 kg"),
  diagnosis: teks(500).min(2, "Isi diagnosis"),
  icd10: z
    .string()
    .refine((v) => v === "" || ICD10.some((i) => i.kode === v), "Kode ICD-10 tidak ada di daftar")
    .transform((v) => v || null),
  tindakan: teks(1000),
  resep: teks(1000),
  saran: teks(1000),
});
export type KunjunganInput = z.input<typeof kunjunganSchema>;

export async function selesaiPeriksa(antreanId: string, input: KunjunganInput): Promise<AksiDokter> {
  const id = idSchema.safeParse(antreanId);
  if (!id.success) return { error: id.error.issues[0].message };
  const parsed = kunjunganSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { error: "Periksa kembali isian catatan.", fieldErrors };
  }
  const s = await dokter();
  if ("error" in s) return { error: s.error };

  const { data: a } = await s.supabase
    .from("antrean")
    .select("id, pasien_id, nomor_label, waktu_mulai")
    .eq("id", id.data)
    .eq("dokter_id", s.dokterId)
    .eq("status", "diperiksa")
    .maybeSingle();
  if (!a) return { error: "Pasien ini tidak sedang Anda periksa." };

  // Upsert per antrean: kalau langkah berikutnya gagal, klik Selesai lagi aman (tidak dobel).
  const { error: errK } = await s.supabase
    .from("kunjungan")
    .upsert({ antrean_id: a.id, dokter_id: s.dokterId, pasien_id: a.pasien_id, ...parsed.data }, { onConflict: "antrean_id" });
  if (errK) return { error: "Catatan gagal disimpan. Coba lagi." };

  const selesai = new Date();
  const { error } = await s.supabase
    .from("antrean")
    .update({ status: "selesai", waktu_selesai: selesai.toISOString() })
    .eq("id", a.id)
    .eq("status", "diperiksa");
  if (error) return { error: "Catatan tersimpan, tapi status gagal diubah. Klik Selesai lagi." };

  const durasi = a.waktu_mulai ? Math.round((selesai.getTime() - new Date(a.waktu_mulai).getTime()) / 60000) : null;
  await s.audit("selesai_periksa", a.id, { nomor: a.nomor_label, durasi_menit: durasi });
  return { pesan: `${a.nomor_label} selesai diperiksa${durasi !== null ? ` (${durasi} menit)` : ""}.` };
}

export type RiwayatKunjungan = {
  id: string;
  created_at: string;
  keluhan: string;
  tensi: string | null;
  suhu: number | null;
  berat: number | null;
  diagnosis: string;
  icd10: string | null;
  tindakan: string;
  resep: string;
  saran: string;
  dokters: { nama: string } | null;
  antrean: { id: string; tanggal: string; nomor_label: string } | null;
};

/** Riwayat kunjungan seorang pasien (hanya baca). */
export async function riwayatPasien(pasienId: string): Promise<{ error?: string; data?: RiwayatKunjungan[] }> {
  const parsed = idSchema.safeParse(pasienId);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const s = await dokter();
  if ("error" in s) return { error: s.error };

  const { data, error } = await s.supabase
    .from("kunjungan")
    .select("id, created_at, keluhan, tensi, suhu, berat, diagnosis, icd10, tindakan, resep, saran, dokters(nama), antrean(id, tanggal, nomor_label)")
    .eq("pasien_id", parsed.data)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return { error: "Riwayat gagal dimuat." };
  return { data };
}
