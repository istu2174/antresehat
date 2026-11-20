"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Field, FormMessage, SubmitButton } from "@/components/form-field";
import { simpanProfil } from "@/lib/actions/auth";
import type { Tables } from "@/lib/database.types";

type Props = {
  profil: Pick<Tables<"profiles">, "nama" | "no_hp" | "tgl_lahir" | "jenis_kelamin">;
  nikTersamar: string | null;
};

export function ProfilForm({ profil, nikTersamar }: Props) {
  const [state, action] = useActionState(simpanProfil, {});
  const v = state.values;

  useEffect(() => {
    if (state.success) toast.success(state.success);
  }, [state]);

  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormMessage error={state.error} />
      <Field label="Nama lengkap" name="nama" autoComplete="name" required defaultValue={v?.nama ?? profil.nama} errors={state.fieldErrors?.nama} />
      <Field
        label="No. HP"
        name="no_hp"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        placeholder="081234567890"
        defaultValue={v?.no_hp ?? profil.no_hp ?? ""}
        errors={state.fieldErrors?.no_hp}
      />
      <Field
        label="Tanggal lahir"
        name="tgl_lahir"
        type="date"
        autoComplete="bday"
        defaultValue={v?.tgl_lahir ?? profil.tgl_lahir ?? ""}
        errors={state.fieldErrors?.tgl_lahir}
      />

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Jenis kelamin</legend>
        <div className="neu-inset grid grid-cols-2 gap-1 rounded-xl p-1">
          {[
            { value: "L", label: "Laki-laki" },
            { value: "P", label: "Perempuan" },
          ].map((o) => (
            <label
              key={o.value}
              className="flex h-10 cursor-pointer items-center justify-center rounded-lg text-sm font-medium text-muted-foreground transition-all has-checked:neu-raised-sm has-checked:text-foreground has-focus-visible:ring-2 has-focus-visible:ring-ring/60"
            >
              <input type="radio" name="jenis_kelamin" value={o.value} defaultChecked={(v?.jenis_kelamin ?? profil.jenis_kelamin) === o.value} className="sr-only" />
              {o.label}
            </label>
          ))}
        </div>
        {state.fieldErrors?.jenis_kelamin && <p className="text-sm text-destructive">{state.fieldErrors.jenis_kelamin[0]}</p>}
      </fieldset>

      <Field
        label="NIK (opsional)"
        name="nik"
        inputMode="numeric"
        autoComplete="off"
        maxLength={16}
        placeholder={nikTersamar ?? "16 digit"}
        hint={nikTersamar ? `Tersimpan: ${nikTersamar}. Isi hanya kalau ingin mengganti.` : "Disimpan terenkripsi dan selalu ditampilkan tersamar."}
        errors={state.fieldErrors?.nik}
      />

      <SubmitButton className="mt-1 w-full">Simpan profil</SubmitButton>
    </form>
  );
}
