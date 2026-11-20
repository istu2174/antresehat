import { Memuat, Skeleton } from "@/components/skeleton";

// Ditampilkan di dalam layout admin, jadi menu samping tetap terlihat saat berpindah halaman.
export default function Loading() {
  return (
    <Memuat>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-3 h-4 w-64" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-3xl" />
        ))}
      </div>
      <Skeleton className="mt-6 h-80 rounded-3xl" />
    </Memuat>
  );
}
