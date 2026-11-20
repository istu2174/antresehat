import { Memuat, Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <Memuat className="mx-auto max-w-xl pt-8 sm:pt-12">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-3 h-4 w-80 max-w-full" />
      <div className="mt-8 grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-9 rounded-xl" />
        ))}
      </div>
      <Skeleton className="mt-8 h-6 w-32" />
      <div className="mt-5 grid gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[4.5rem]" />
        ))}
      </div>
    </Memuat>
  );
}
