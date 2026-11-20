// E2E PRD 12: pasien booking → resepsionis check-in & panggil → tiket pasien berubah DIPANGGIL
// → dokter periksa & selesai → kunjungan muncul di riwayat pasien.
// Poli, dokter, jadwal & pasien uji dibuat khusus lalu dihapus, jadi data demo tidak terganggu.
import { expect, test, type Browser, type Page } from "@playwright/test";
import { createAdminClient } from "@/lib/supabase/admin";
import { dayOfWeek, todayWib } from "@/lib/time";

const admin = createAdminClient();
const stamp = Date.now();
const PASSWORD = `Uji-${stamp}`;
const POLI = { nama: "Poli Uji E2E", kode_prefix: "XE", warna: "#16181b" };
const DOKTER = "dr. Uji E2E";
const PASIEN = "Pasien Uji E2E";
const ids = { poli: "", dokter: "", dokterUser: "", pasienUser: "" };

async function buatUser(prefix: string, nama: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email: `${prefix}-${stamp}@antresehat.test`,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { nama },
  });
  if (error) throw error;
  return data.user;
}

// Tunggu sampai JS selesai dimuat & hydrate — di mode dev kompilasi pertama bisa lambat.
async function buka(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

async function masuk(browser: Browser, email: string, password: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await buka(page, "/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  return page;
}

test.beforeAll(async () => {
  const jam = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date());
  test.skip(jam >= "23:25", "Booking hari ini sudah ditutup (30 menit sebelum sesi uji berakhir). Jalankan lagi setelah 00.00 WIB.");

  const { data: poli, error: e1 } = await admin.from("polis").insert(POLI).select("id").single();
  if (e1) throw e1;
  ids.poli = poli.id;

  const dokterUser = await buatUser("uji-dokter", DOKTER);
  ids.dokterUser = dokterUser.id;
  await admin.from("profiles").update({ role: "dokter" }).eq("id", dokterUser.id);
  const { data: dokter, error: e2 } = await admin
    .from("dokters")
    .insert({ profile_id: dokterUser.id, poli_id: poli.id, nama: DOKTER, spesialis: "Dokter Umum" })
    .select("id")
    .single();
  if (e2) throw e2;
  ids.dokter = dokter.id;

  // Satu sesi sepanjang hari ini supaya test bisa jalan jam berapa pun (kecuali 23.30–24.00).
  const { error: e3 } = await admin
    .from("jadwal_praktik")
    .insert({ dokter_id: dokter.id, hari: dayOfWeek(todayWib()), jam_mulai: "00:00", jam_selesai: "23:59", kuota: 10, menit_per_pasien: 10 });
  if (e3) throw e3;

  ids.pasienUser = (await buatUser("uji-pasien", PASIEN)).id;
});

test.afterAll(async () => {
  // Pasien dihapus → antrean & kunjungan ikut (cascade); dokter dihapus → jadwal ikut.
  if (ids.pasienUser) await admin.auth.admin.deleteUser(ids.pasienUser);
  if (ids.dokter) await admin.from("dokters").delete().eq("id", ids.dokter);
  if (ids.dokterUser) await admin.auth.admin.deleteUser(ids.dokterUser);
  if (ids.poli) await admin.from("polis").delete().eq("id", ids.poli);
});

test("booking → check-in → panggil → periksa → riwayat", async ({ browser }) => {
  // 1. Pasien booking lewat wizard.
  const pasien = await masuk(browser, `uji-pasien-${stamp}@antresehat.test`, PASSWORD);
  await buka(pasien, "/booking");
  await pasien.getByRole("button", { name: new RegExp(POLI.nama) }).click();
  await pasien.getByRole("button", { name: new RegExp(DOKTER) }).click();
  await pasien.getByRole("button", { name: /Sisa 10/ }).first().click(); // tombol pertama = hari ini
  await pasien.getByRole("button", { name: /Perkiraan dilayani/ }).click();
  await pasien.getByRole("button", { name: "Ambil nomor antrean" }).click();
  await pasien.waitForURL(/\/tiket\/[A-F0-9]+$/);
  const kode = pasien.url().split("/").pop()!;
  await expect(pasien.getByText("XE-001").first()).toBeVisible();

  // 2. Resepsionis check-in pakai kode tiket, lalu panggil berikutnya.
  const resepsionis = await masuk(browser, "resepsionis@antresehat.test", "demo1234");
  await buka(resepsionis, "/resepsionis");
  const checkIn = resepsionis.getByRole("region", { name: "Check-in pasien" });
  await checkIn.getByLabel("Kode tiket").fill(kode);
  await checkIn.getByRole("button", { name: "Check-in", exact: true }).click();
  const kartu = resepsionis.locator("article").filter({ hasText: DOKTER });
  await expect(kartu.getByText("1 siap")).toBeVisible();
  await kartu.getByRole("button", { name: "Panggil berikutnya" }).click();
  await expect(kartu.getByText("XE-001")).toBeVisible();

  // 3. Tiket pasien berubah realtime tanpa reload (target ≤ 2 detik, toleransi 5 detik untuk jaringan).
  await expect(pasien.getByText("Giliranmu!", { exact: true })).toBeVisible({ timeout: 5_000 });

  // 4. Dokter mulai periksa, isi catatan, selesai.
  const dokter = await masuk(browser, `uji-dokter-${stamp}@antresehat.test`, PASSWORD);
  await buka(dokter, "/dokter");
  await dokter.getByRole("button", { name: "Mulai periksa" }).click();
  await expect(pasien.getByText("Sedang diperiksa")).toBeVisible({ timeout: 5_000 });
  await dokter.getByLabel("Keluhan").fill("Demam dua hari");
  await dokter.getByLabel("Diagnosis", { exact: true }).fill("Demam uji E2E");
  await dokter.getByRole("button", { name: "Selesai", exact: true }).click();
  await expect(pasien.getByText("Pemeriksaan selesai")).toBeVisible({ timeout: 5_000 });

  // 5. Kunjungan muncul di riwayat pasien beserta diagnosisnya.
  await buka(pasien, "/riwayat");
  await pasien.getByText("Ringkasan dokter").click();
  await expect(pasien.getByText("Demam uji E2E")).toBeVisible();

  // Durasi periksa tercatat.
  const { data: row } = await admin.from("antrean").select("status, waktu_mulai, waktu_selesai").eq("kode_tiket", kode).single();
  expect(row?.status).toBe("selesai");
  expect(row?.waktu_mulai && row?.waktu_selesai).toBeTruthy();
});
