import type { Metadata } from "next";
import { DemoPanel } from "./demo-panel";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Masuk" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const { reset } = await searchParams;
  return (
    <div className="mx-auto grid max-w-4xl gap-8 pt-10 sm:pt-14 md:grid-cols-2 md:items-start">
      {/* Panel demo lebih dulu di HP: reviewer biasanya datang untuk mencoba, bukan mendaftar. */}
      <div className="md:order-last">
        <DemoPanel />
      </div>
      <section aria-labelledby="login-title" className="neu-raised rounded-3xl p-6 sm:p-7">
        <h1 id="login-title" className="text-2xl font-semibold tracking-tight">Masuk</h1>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">Pakai email dan password akunmu.</p>
        {reset && (
          <p role="status" className="neu-inset mb-6 rounded-xl px-4 py-3 text-sm">Data demo sudah direset ke kondisi awal. Silakan masuk lagi.</p>
        )}
        <LoginForm />
      </section>
    </div>
  );
}
