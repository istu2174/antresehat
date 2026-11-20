import { Memuat, Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <Memuat className="mx-auto max-w-md pt-8 sm:pt-12">
      <Skeleton className="h-[26rem] rounded-3xl" />
      <Skeleton className="mt-6 h-32 rounded-3xl" />
    </Memuat>
  );
}
