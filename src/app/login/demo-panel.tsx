"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRightIcon, Loader2Icon } from "lucide-react";
import { FormMessage } from "@/components/form-field";
import { demoLogin } from "@/lib/actions/auth";
import { DEMO_ACCOUNTS } from "@/lib/auth";

// Satu form, lima tombol submit: tombol yang diklik mengirim email-nya sendiri.
function DemoButtons() {
  const { pending, data } = useFormStatus();
  const active = data?.get("email");
  return (
    <ul className="grid gap-3">
      {DEMO_ACCOUNTS.map((a) => (
        <li key={a.email}>
          <button
            type="submit"
            name="email"
            value={a.email}
            disabled={pending}
            className="neu-raised-sm group flex min-h-16 w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-ring/60 active:neu-inset disabled:opacity-60"
          >
            <span className="min-w-0">
              <span className="block font-semibold">{a.label}</span>
              <span className="block truncate text-xs text-muted-foreground">{a.keterangan}</span>
            </span>
            {pending && active === a.email ? (
              <Loader2Icon className="size-4 shrink-0 animate-spin" aria-label="Sedang masuk" />
            ) : (
              <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function DemoPanel() {
  const [state, action] = useActionState(demoLogin, {});
  return (
    <section aria-labelledby="demo-title" className="neu-raised rounded-3xl p-6 sm:p-7">
      <h2 id="demo-title" className="text-lg font-semibold tracking-tight">Masuk sebagai (demo)</h2>
      <p className="mt-1 text-sm text-muted-foreground">Sekali klik, tanpa daftar. Semua data fiktif.</p>
      <form action={action} className="mt-5 grid gap-4">
        <FormMessage error={state.error} />
        <DemoButtons />
      </form>
    </section>
  );
}
