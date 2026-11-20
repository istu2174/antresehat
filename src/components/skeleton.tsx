import { cn } from "@/lib/utils";

/** Blok abu-abu berdenyut sebagai placeholder saat halaman dimuat. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("rounded-2xl bg-black/[0.06] motion-safe:animate-pulse", className)} />;
}

/** Pembungkus loading.tsx: diumumkan ke pembaca layar sebagai "Memuat…". */
export function Memuat({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div role="status" className={className}>
      <span className="sr-only">Memuat…</span>
      {children}
    </div>
  );
}
