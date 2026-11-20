import { Memuat, Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <Memuat className="pt-6 sm:pt-8">
      <Skeleton className="h-8 w-56" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40 rounded-3xl" />
        ))}
      </div>
      <Skeleton className="mt-6 h-96 rounded-3xl" />
    </Memuat>
  );
}
