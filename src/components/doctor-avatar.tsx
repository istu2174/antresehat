import { cn } from "@/lib/utils";

const inisial = (nama: string) =>
  nama.replace(/^(dr|drg)\.?\s+/i, "").split(",")[0].split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

// Foto dokter kalau ada, selain itu inisial — bukan foto stok.
export function DoctorAvatar({ nama, fotoUrl, className }: { nama: string; fotoUrl: string | null; className?: string }) {
  if (fotoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- URL foto bebas dari admin
    return <img src={fotoUrl} alt="" className={cn("size-11 shrink-0 rounded-full object-cover", className)} />;
  }
  return (
    <span aria-hidden className={cn("neu-raised-sm grid size-11 shrink-0 place-items-center rounded-full text-sm font-semibold", className)}>
      {inisial(nama)}
    </span>
  );
}
