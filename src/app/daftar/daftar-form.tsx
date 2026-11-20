"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Field, FormMessage, SubmitButton } from "@/components/form-field";
import { daftar } from "@/lib/actions/auth";

export function DaftarForm() {
  const [state, action] = useActionState(daftar, {});
  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormMessage error={state.error} success={state.success} />
      <Field label="Nama lengkap" name="nama" autoComplete="name" required defaultValue={state.values?.nama} errors={state.fieldErrors?.nama} />
      <Field label="Email" name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={state.values?.email} errors={state.fieldErrors?.email} />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="Minimal 8 karakter."
        errors={state.fieldErrors?.password}
      />
      <SubmitButton className="mt-1 w-full">Buat akun</SubmitButton>
      <p className="text-center text-sm text-muted-foreground">
        Sudah punya akun?{" "}
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4">Masuk</Link>
      </p>
    </form>
  );
}
