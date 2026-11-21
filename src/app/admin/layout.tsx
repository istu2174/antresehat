import { AdminNav } from "./nav";
import { ResetDemoButton } from "./forms";

// Reset demo menjalankan ulang seed (± puluhan detik) — beri batas waktu cukup di Vercel.
export const maxDuration = 60;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-6 pt-6 pb-10 sm:pt-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-6 lg:h-fit">
        <p className="px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">Admin klinik</p>
        <AdminNav />
        <ResetDemoButton className="mt-4 hidden lg:inline-flex" />
      </aside>
      <div className="min-w-0">
        {children}
        <ResetDemoButton className="mt-10 lg:hidden" />
      </div>
    </div>
  );
}
