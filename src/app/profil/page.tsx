import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfilForm } from "./profil-form";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfilPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profil }, { data: nik }] = await Promise.all([
    supabase.from("profiles").select("nama, no_hp, tgl_lahir, jenis_kelamin").eq("id", user.id).single(),
    supabase.rpc("nik_tersamar", { p_profile_id: user.id }),
  ]);
  if (!profil) redirect("/login");

  return (
    <section aria-labelledby="profil-title" className="neu-raised mx-auto mt-8 max-w-lg rounded-3xl p-6 sm:mt-12 sm:p-7">
      <h1 id="profil-title" className="text-2xl font-semibold tracking-tight">Profil</h1>
      <p className="mt-1 mb-6 truncate text-sm text-muted-foreground">{user.email}</p>
      <ProfilForm profil={profil} nikTersamar={nik ?? null} />
    </section>
  );
}
