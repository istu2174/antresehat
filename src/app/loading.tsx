import { Memuat, Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <Memuat className="mx-auto max-w-xl pt-8 sm:pt-12">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-3 h-4 w-72 max-w-full" />
      <div className="mt-8 grid gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    </Memuat>
  );
}
