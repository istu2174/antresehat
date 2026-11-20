import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Klien service role — melewati RLS. HANYA dipakai di server setelah role pemanggil dicek
// (mis. resepsionis membuat akun pasien walk-in). Kunci ini tidak pernah sampai ke browser
// karena tidak diawali NEXT_PUBLIC_.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY belum diisi di .env.local");
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
