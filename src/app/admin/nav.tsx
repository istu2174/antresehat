"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const MENU = [
  { href: "/admin/poli", label: "Poli" },
  { href: "/admin/dokter", label: "Dokter" },
  { href: "/admin/jadwal", label: "Jadwal praktik" },
  { href: "/admin/libur", label: "Hari libur & cuti" },
  { href: "/admin/staf", label: "Akun staf" },
  { href: "/admin/laporan", label: "Laporan" },
  { href: "/admin/audit", label: "Audit log" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Menu admin" className="mt-2 flex gap-1.5 overflow-x-auto pb-1 lg:grid lg:overflow-visible">
      {MENU.map((m) => {
        const aktif = path === m.href || path.startsWith(`${m.href}/`);
        return (
          <Link
            key={m.href}
            href={m.href}
            aria-current={aktif ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
              aktif ? "neu-inset" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {m.label}
          </Link>
        );
      })}
    </nav>
  );
}
