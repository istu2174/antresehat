import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

let cached: SupabaseClient<Database> | null = null;

// Klien anon TANPA session: membaca data publik (landing, /display, posisi antrean).
// Sengaja tidak memakai cookie user — RLS antrean untuk pasien yang login hanya
// menampilkan baris miliknya, sedangkan data publik hari ini dibaca sebagai anon.
// Satu instance dipakai bersama (tanpa session, jadi aman di server maupun browser).
// Null kalau .env.local belum diisi, supaya halaman publik tetap tampil.
export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  cached ??= createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return cached;
}
