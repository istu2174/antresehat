"use client";

import { useFormStatus } from "react-dom";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FieldProps = React.ComponentProps<"input"> & {
  label: string;
  name: string;
  errors?: string[];
  hint?: string;
};

export function Field({ label, name, errors, hint, ...props }: FieldProps) {
  const id = `f-${name}`;
  const describedBy = errors?.length ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <Input id={id} name={name} aria-invalid={errors?.length ? true : undefined} aria-describedby={describedBy} {...props} />
      {errors?.length ? (
        <p id={`${id}-err`} className="text-sm text-destructive">{errors[0]}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function SubmitButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className={className}>
      {pending && <Loader2Icon className="animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}

export function FormMessage({ error, success }: { error?: string; success?: string }) {
  if (error) return <p role="alert" className="neu-inset rounded-xl px-4 py-3 text-sm text-destructive">{error}</p>;
  if (success) return <p role="status" className="neu-inset rounded-xl px-4 py-3 text-sm">{success}</p>;
  return null;
}
