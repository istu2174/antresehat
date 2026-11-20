import type { Enums } from "@/lib/database.types";

export type Role = Enums<"user_role">;

// Halaman utama tiap role (PRD bagian 10 & Prompt 3).
export const ROLE_HOME: Record<Role, string> = {
  pasien: "/booking",
  resepsionis: "/resepsionis",
  dokter: "/dokter",
  admin: "/admin",
};

// Prefix route yang dilindungi → role yang boleh membukanya.
const PROTECTED: [prefix: string, role: Role][] = [
  ["/booking", "pasien"],
  ["/tiket", "pasien"],
  ["/riwayat", "pasien"],
  ["/profil", "pasien"],
  ["/resepsionis", "resepsionis"],
  ["/dokter", "dokter"],
  ["/admin", "admin"],
];

export function requiredRole(pathname: string): Role | null {
  const hit = PROTECTED.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return hit ? hit[1] : null;
}

export const DEMO_PASSWORD = "demo1234";

// Akun demo PRD bagian 11 — sengaja publik.
export const DEMO_ACCOUNTS = [
  { label: "Admin", keterangan: "Master data & laporan", email: "admin@antresehat.test" },
  { label: "Resepsionis", keterangan: "Check-in & panggil antrean", email: "resepsionis@antresehat.test" },
  { label: "Dokter Umum", keterangan: "dr. Andi Pratama", email: "dr.umum@antresehat.test" },
  { label: "Dokter Gigi", keterangan: "drg. Sinta Maharani", email: "dr.gigi@antresehat.test" },
  { label: "Pasien", keterangan: "Budi Santoso", email: "pasien@antresehat.test" },
] as const;
