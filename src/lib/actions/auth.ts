"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, ROLE_HOME, type Role } from "@/lib/auth";
import { daftarSchema, loginSchema, profilSchema, type FormState } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";

const BELUM_DIKONFIGURASI: FormState = {
  error: "Supabase belum dikonfigurasi. Isi .env.local dulu (lihat README).",
};
const configured = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

function pesanAuth(message: string): string {
  if (/invalid login credentials/i.test(message)) return "Email atau password salah.";
  if (/email not confirmed/i.test(message)) return "Email belum dikonfirmasi. Cek kotak masuk email kamu.";
  if (/already registered|already exists/i.test(message)) return "Email sudah terdaftar. Silakan masuk.";
  if (/rate limit|too many/i.test(message)) return "Terlalu banyak percobaan. Coba lagi beberapa menit lagi.";
  return "Terjadi kesalahan. Coba lagi.";
}

async function masuk(email: string, password: string, demo = false): Promise<FormState> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return {
      error: demo && /invalid login/i.test(error.message)
        ? "Akun demo belum ada. Jalankan npm run db:seed dulu."
        : pesanAuth(error.message),
    };
  }

  const { data: profil } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
  redirect(ROLE_HOME[(profil?.role ?? "pasien") as Role]);
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = { email: String(formData.get("email") ?? "") };
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { values, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  if (!configured()) return { values, ...BELUM_DIKONFIGURASI };
  return { values, ...(await masuk(parsed.data.email, parsed.data.password)) };
}

export async function demoLogin(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "");
  // Hanya akun demo yang terdaftar — tombol ini tidak boleh jadi celah login tanpa password.
  if (!DEMO_ACCOUNTS.some((a) => a.email === email)) return { error: "Akun demo tidak dikenal." };
  if (!configured()) return BELUM_DIKONFIGURASI;
  return masuk(email, DEMO_PASSWORD, true);
}

export async function daftar(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = { nama: String(formData.get("nama") ?? ""), email: String(formData.get("email") ?? "") };
  const parsed = daftarSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { values, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  if (!configured()) return { values, ...BELUM_DIKONFIGURASI };

  const { nama, email, password } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { nama } } });
  if (error) return { values, error: pesanAuth(error.message) };
  // Supabase mengembalikan user tanpa identitas kalau email sudah dipakai (anti enumerasi).
  if (data.user && data.user.identities?.length === 0) return { values, error: "Email sudah terdaftar. Silakan masuk." };
  if (!data.session) return { success: "Akun dibuat. Cek email untuk konfirmasi, lalu masuk." };

  redirect(ROLE_HOME.pasien);
}

export async function keluar() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function simpanProfil(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries(formData);
  // NIK tidak dikembalikan ke browser.
  const values = Object.fromEntries(Object.entries(raw).filter(([k]) => k !== "nik").map(([k, v]) => [k, String(v)]));
  const parsed = profilSchema.safeParse({ jenis_kelamin: "", ...raw });
  if (!parsed.success) return { values, fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { nik, ...field } = parsed.data;
  const { error } = await supabase
    .from("profiles")
    .update({
      nama: field.nama,
      no_hp: field.no_hp || null,
      tgl_lahir: field.tgl_lahir || null,
      jenis_kelamin: field.jenis_kelamin || null,
    })
    .eq("id", user.id);
  if (error) return { values, error: "Gagal menyimpan profil. Coba lagi." };

  if (nik) {
    const { error: nikError } = await supabase.rpc("set_nik", { p_profile_id: user.id, p_nik: nik });
    if (nikError) return { values, error: "Profil tersimpan, tetapi NIK gagal disimpan." };
  }

  revalidatePath("/profil");
  return { success: "Profil tersimpan." };
}
