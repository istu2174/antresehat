// Seed data demo AntreSehat. Jalankan: npm run db:seed (butuh .env.local berisi URL + SUPABASE_SERVICE_ROLE_KEY).
import { createClient } from "@supabase/supabase-js";
import { seedDemo } from "../src/lib/seed-demo";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib ada di .env.local");
}

seedDemo(createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })).catch((e) => {
  console.error("\n✗ Seed gagal:", e.message);
  process.exit(1);
});
