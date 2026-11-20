import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ResepsionisDialog, ResetPasswordDialog } from "../forms";

export const metadata = { title: "Akun staf" };

const LABEL = { admin: "Admin", resepsionis: "Resepsionis", dokter: "Dokter", pasien: "Pasien" } as const;

export default async function Page() {
  const supabase = await createClient();
  const { data: role } = await supabase.rpc("app_role");
  // Email ada di auth.users → butuh service role; dibaca hanya setelah role admin dipastikan.
  if (role !== "admin") return null;

  const [{ data: staf }, { data: users }] = await Promise.all([
    supabase.from("profiles").select("id, nama, role").neq("role", "pasien").order("role").order("nama"),
    createAdminClient().auth.admin.listUsers({ perPage: 1000 }),
  ]);
  // shortcut: hanya 1000 akun pertama yang dicocokkan emailnya; cukup untuk klinik kecil.
  const email = new Map(users.users.map((u) => [u.id, u.email ?? ""]));

  return (
    <section aria-labelledby="judul">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="judul" className="text-2xl font-semibold tracking-tight">Akun staf</h1>
          <p className="mt-1 text-sm text-muted-foreground">Akun dokter dibuat dari halaman Dokter.</p>
        </div>
        <ResepsionisDialog />
      </div>
      <div className="neu-raised mt-6 overflow-x-auto rounded-3xl p-4 sm:p-5">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th scope="col" className="py-2 pr-3 font-medium">Nama</th>
              <th scope="col" className="py-2 pr-3 font-medium">Email</th>
              <th scope="col" className="py-2 pr-3 font-medium">Peran</th>
              <th scope="col" className="py-2 text-right font-medium"><span className="sr-only">Aksi</span></th>
            </tr>
          </thead>
          <tbody>
            {(staf ?? []).map((s) => (
              <tr key={s.id} className="border-t border-black/5">
                <td className="py-2.5 pr-3 font-medium">{s.nama}</td>
                <td className="py-2.5 pr-3 text-muted-foreground">{email.get(s.id)}</td>
                <td className="py-2.5 pr-3">{LABEL[s.role]}</td>
                <td className="py-2.5 text-right">
                  <ResetPasswordDialog id={s.id} email={email.get(s.id) ?? ""} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
