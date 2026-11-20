import { describe, expect, it } from "vitest";
import { daftarSchema, loginSchema, profilSchema } from "@/lib/schemas";

const profil = { nama: "Budi Santoso", no_hp: "", tgl_lahir: "", jenis_kelamin: "", nik: "" };

describe("validasi Zod", () => {
  it("login: email dinormalisasi, password wajib", () => {
    expect(loginSchema.parse({ email: "  Pasien@AntreSehat.test ", password: "x" }).email).toBe("pasien@antresehat.test");
    expect(loginSchema.safeParse({ email: "bukan-email", password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
  });

  it("daftar: nama ≥ 3, password 8–72", () => {
    expect(daftarSchema.safeParse({ nama: "Budi", email: "a@b.co", password: "12345678" }).success).toBe(true);
    expect(daftarSchema.safeParse({ nama: "Bu", email: "a@b.co", password: "12345678" }).success).toBe(false);
    expect(daftarSchema.safeParse({ nama: "Budi", email: "a@b.co", password: "1234567" }).success).toBe(false);
  });

  it("profil: field opsional boleh kosong", () => {
    expect(profilSchema.safeParse(profil).success).toBe(true);
  });

  it("profil: no HP Indonesia", () => {
    expect(profilSchema.safeParse({ ...profil, no_hp: "081234567890" }).success).toBe(true);
    expect(profilSchema.safeParse({ ...profil, no_hp: "+6281234567890" }).success).toBe(true);
    expect(profilSchema.safeParse({ ...profil, no_hp: "12345" }).success).toBe(false);
  });

  it("profil: NIK 16 digit, tanggal lahir tidak di masa depan", () => {
    expect(profilSchema.safeParse({ ...profil, nik: "3271000000000001" }).success).toBe(true);
    expect(profilSchema.safeParse({ ...profil, nik: "32710000" }).success).toBe(false);
    expect(profilSchema.safeParse({ ...profil, tgl_lahir: "2999-01-01" }).success).toBe(false);
    expect(profilSchema.safeParse({ ...profil, jenis_kelamin: "X" }).success).toBe(false);
  });
});
