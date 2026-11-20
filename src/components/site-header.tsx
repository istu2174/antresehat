import Link from "next/link";
import { MonitorIcon } from "lucide-react";
import { AccountMenu } from "@/components/account-menu";
import { buttonVariants } from "@/components/ui/button";
import type { Role } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

async function getAccount(): Promise<{ nama: string; role: Role } | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("nama, role").eq("id", user.id).single();
  return data;
}

export async function SiteHeader() {
  const account = await getAccount();
  return (
    <header className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6 sm:pt-6">
      <div className="neu-raised flex h-16 items-center justify-between rounded-2xl pr-3 pl-3 sm:pl-4">
        <Link href="/" className="flex items-center gap-3 rounded-xl focus-visible:ring-2 focus-visible:ring-ring/60 outline-none">
          {/* Monogram = nomor antrean pertama, bukan logo stok */}
          <span aria-hidden className="neu-ink grid size-10 place-items-center rounded-[11px] text-[13px] font-semibold tabular-nums tracking-tight">
            01
          </span>
          <span className="text-[17px] font-semibold tracking-tight">AntreSehat</span>
        </Link>

        <nav className="flex items-center gap-2" aria-label="Navigasi utama">
          <Link href="/display" aria-label="Layar antrean" className={buttonVariants({ variant: "ghost" })}>
            <MonitorIcon aria-hidden />
            <span className="hidden sm:inline">Layar antrean</span>
          </Link>
          {account ? (
            <AccountMenu nama={account.nama} role={account.role} />
          ) : (
            <Link href="/login" className={buttonVariants({ variant: "outline" })}>
              Masuk
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
