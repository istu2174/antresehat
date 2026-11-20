import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Halaman tidak ditemukan" };

export default function NotFound() {
  return (
    <section className="mx-auto max-w-md pt-16 text-center sm:pt-24">
      <p className="text-6xl font-semibold tracking-tight tabular-nums">404</p>
      <h1 className="mt-4 text-xl font-semibold tracking-tight">Halaman tidak ditemukan</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Alamatnya mungkin salah ketik, atau tiket yang kamu cari sudah tidak ada.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className={buttonVariants({ size: "lg" })}>Ke beranda</Link>
        <Link href="/booking" className={buttonVariants({ variant: "outline", size: "lg" })}>Booking antrean</Link>
      </div>
    </section>
  );
}
