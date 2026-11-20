"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Field, FormMessage, SubmitButton } from "@/components/form-field";
import { login } from "@/lib/actions/auth";

export function LoginForm() {
  const [state, action] = useActionState(login, {});
  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormMessage error={state.error} />
      <Field label="Email" name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={state.values?.email} errors={state.fieldErrors?.email} />
      <Field label="Password" name="password" type="password" autoComplete="current-password" required errors={state.fieldErrors?.password} />
      <SubmitButton className="mt-1 w-full">Masuk</SubmitButton>
      <p className="text-center text-sm text-muted-foreground">
        Belum punya akun?{" "}
        <Link href="/daftar" className="font-medium text-foreground underline underline-offset-4">Daftar sebagai pasien</Link>
      </p>
    </form>
  );
}
