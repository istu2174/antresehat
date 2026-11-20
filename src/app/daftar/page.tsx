import type { Metadata } from "next";
import { DaftarForm } from "./daftar-form";

export const metadata: Metadata = { title: "Daftar" };

export default function DaftarPage() {
  return (
    <section aria-labelledby="daftar-title" className="neu-raised mx-auto mt-10 max-w-md rounded-3xl p-6 sm:mt-14 sm:p-7">
      <h1 id="daftar-title" className="text-2xl font-semibold tracking-tight">Daftar pasien</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">Sekali daftar, lalu booking dari HP kapan saja.</p>
      <DaftarForm />
    </section>
  );
}
