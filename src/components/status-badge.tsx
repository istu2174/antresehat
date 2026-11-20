import { cn } from "@/lib/utils";
import { STATUS_LABEL, type Status } from "@/lib/antrean";

// Hierarki lewat permukaan, bukan warna: yang menuntut perhatian (dipanggil/diperiksa) memakai gradasi hitam.
const GAYA: Record<Status, string> = {
  menunggu: "neu-inset text-muted-foreground",
  check_in: "neu-inset text-foreground",
  dipanggil: "neu-ink",
  diperiksa: "neu-ink",
  selesai: "neu-inset text-muted-foreground",
  dilewati: "neu-inset text-amber-700",
  batal: "neu-inset text-destructive",
  tidak_datang: "neu-inset text-destructive",
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <span className={cn("inline-flex h-7 items-center rounded-full px-3 text-xs font-medium whitespace-nowrap", GAYA[status], className)}>
      {STATUS_LABEL[status]}
    </span>
  );
}
