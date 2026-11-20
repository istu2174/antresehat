"use client";

import Link from "next/link";
import { ChevronDownIcon, LogOutIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { keluar } from "@/lib/actions/auth";
import { ROLE_HOME, type Role } from "@/lib/auth";

const ROLE_LABEL: Record<Role, string> = {
  pasien: "Pasien",
  resepsionis: "Resepsionis",
  dokter: "Dokter",
  admin: "Admin klinik",
};

const LINKS: Record<Role, { href: string; label: string }[]> = {
  pasien: [
    { href: "/booking", label: "Booking" },
    { href: "/riwayat", label: "Riwayat kunjungan" },
    { href: "/profil", label: "Profil" },
  ],
  resepsionis: [{ href: ROLE_HOME.resepsionis, label: "Dashboard antrean" }],
  dokter: [{ href: ROLE_HOME.dokter, label: "Pasien hari ini" }],
  admin: [{ href: ROLE_HOME.admin, label: "Admin klinik" }],
};

export function AccountMenu({ nama, role }: { nama: string; role: Role }) {
  const inisial = nama.replace(/^(dr|drg)\.?\s+/i, "").trim().charAt(0).toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Menu akun ${nama}`}
        className="neu-raised-sm flex h-10 items-center gap-2 rounded-xl pr-2.5 pl-1.5 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/60 data-popup-open:neu-inset"
      >
        <span aria-hidden className="neu-inset grid size-7 place-items-center rounded-lg text-xs font-semibold">{inisial}</span>
        <span className="hidden max-w-[14ch] truncate sm:inline">{nama.split(",")[0]}</span>
        <ChevronDownIcon className="size-4 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        {/* Header biasa, bukan Menu.GroupLabel — komponen itu crash kalau tidak di dalam Menu.Group */}
        <div className="px-2 py-1.5 text-sm">
          <p className="truncate font-semibold">{nama}</p>
          <p className="text-xs text-muted-foreground">{ROLE_LABEL[role]}</p>
        </div>
        <DropdownMenuSeparator />
        {LINKS[role].map((l) => (
          <DropdownMenuItem key={l.href} render={<Link href={l.href} />}>
            {l.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => keluar()}>
          <LogOutIcon aria-hidden />
          Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
