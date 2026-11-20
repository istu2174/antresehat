import { z } from "zod";

// Dipakai di server action (sumber kebenaran) — pesan error Bahasa Indonesia.
// Trim dulu baru cek format (z.email().trim() mengecek sebelum trim → spasi autocomplete HP ditolak).
const email = z.string().trim().toLowerCase().pipe(z.email("Format email tidak valid"));

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password wajib diisi"),
});

export const daftarSchema = z.object({
  nama: z.string().trim().min(3, "Nama minimal 3 karakter").max(80, "Nama maksimal 80 karakter"),
  email,
  password: z.string().min(8, "Password minimal 8 karakter").max(72, "Password maksimal 72 karakter"),
});

export const profilSchema = z.object({
  nama: z.string().trim().min(3, "Nama minimal 3 karakter").max(80, "Nama maksimal 80 karakter"),
  no_hp: z
    .string()
    .trim()
    .regex(/^(\+62|0)8\d{7,12}$/, "Nomor HP tidak valid, contoh 081234567890")
    .or(z.literal("")),
  tgl_lahir: z.iso
    .date("Tanggal lahir tidak valid")
    .refine((d) => d <= new Date().toISOString().slice(0, 10), "Tanggal lahir tidak boleh di masa depan")
    .or(z.literal("")),
  jenis_kelamin: z.enum(["L", "P"], "Pilih jenis kelamin").or(z.literal("")),
  // Kosong = NIK tidak diubah.
  nik: z.string().trim().regex(/^\d{16}$/, "NIK harus 16 digit angka").or(z.literal("")),
});

export type FormState = {
  error?: string;
  fieldErrors?: Partial<Record<string, string[]>>;
  success?: string;
  // Nilai yang dikirim (tanpa password) supaya form tidak kosong setelah gagal.
  values?: Record<string, string>;
};
