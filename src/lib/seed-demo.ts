// Seed data demo AntreSehat (PRD bagian 11). Semua data fiktif.
// Dipakai oleh `npm run db:seed` (scripts/seed.ts) dan tombol "Reset data demo" di /admin.
// Aman dijalankan ulang: data demo lama dihapus dulu.
import { randomBytes, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatNomor } from "./antrean";
import { ICD10 } from "./icd10";

// shortcut: state modul (db, PRNG, tanggal) → dua reset bersamaan bisa saling ganggu; cukup untuk demo satu admin.
let db: SupabaseClient;
let todayWib = "";

const DOMAIN = "antresehat.test";
const PASSWORD = "demo1234";

// ───────── util ─────────
let seed = 20261120; // PRNG tetap → data sama setiap reset
function rand() {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
const shuffle = <T>(xs: T[]) => xs.map((x) => [rand(), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x);

const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const dow = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay();
const at = (d: string, time: string, plusMin = 0) => new Date(Date.parse(`${d}T${time.slice(0, 5)}:00+07:00`) + plusMin * 60e3);
const addMin = (t: Date, m: number) => new Date(t.getTime() + m * 60e3);
const kodeTiket = () => randomBytes(5).toString("hex").toUpperCase();

async function must<R extends { data: unknown; error: unknown }>(p: PromiseLike<R>, what: string) {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${JSON.stringify(error)}`);
  return data as NonNullable<R["data"]>;
}

// ───────── data fiktif ─────────
type Gender = "L" | "P";
const STAFF = [
  { email: "admin", nama: "Rina Kartika", role: "admin" },
  { email: "resepsionis", nama: "Dewi Anggraini", role: "resepsionis" },
  { email: "dr.umum", nama: "dr. Andi Pratama", role: "dokter" },
  { email: "dr.gigi", nama: "drg. Sinta Maharani", role: "dokter" },
  { email: "dr.anak", nama: "dr. Bayu Wicaksono, Sp.A", role: "dokter" },
  { email: "dr.umum2", nama: "dr. Maya Puspita", role: "dokter" },
] as const;

// [nama, gender, tgl_lahir] — 7 anak untuk Poli Anak, sisanya dewasa.
const PASIEN: [string, Gender, string][] = [
  ["Budi Santoso", "L", "1988-04-12"], // pasien@ — akun demo
  ["Siti Rahmawati", "P", "1992-09-03"], ["Agus Setiawan", "L", "1979-01-22"],
  ["Lina Marlina", "P", "1985-06-17"], ["Hendra Gunawan", "L", "1990-11-30"],
  ["Ratna Sari", "P", "1975-03-08"], ["Fajar Nugroho", "L", "1996-07-25"],
  ["Wulan Kusuma", "P", "2000-12-14"], ["Taufik Hidayat", "L", "1983-05-02"],
  ["Indah Permata", "P", "1998-02-19"], ["Yusuf Maulana", "L", "1969-08-11"],
  ["Nur Aini", "P", "1994-10-27"], ["Dimas Saputra", "L", "2001-04-05"],
  ["Rizky Ananda", "L", "2017-03-15"], ["Aisyah Putri", "P", "2019-08-21"],
  ["Kevin Pratama", "L", "2015-11-02"], ["Nabila Zahra", "P", "2021-01-09"],
  ["Arka Wijaya", "L", "2018-06-30"], ["Keisha Amanda", "P", "2016-09-12"],
  ["Rafi Ramadhan", "L", "2022-04-18"], ["Salma Nuraini", "P", "1987-12-01"],
];
const isAnak = (tgl: string) => Number(tgl.slice(0, 4)) >= 2014;

// Catatan pemeriksaan contoh per poli.
type Catatan = { kode: string; keluhan: string; tindakan: string; resep: string; saran: string };
const CATATAN: Record<string, Catatan[]> = {
  U: [
    { kode: "J06.9", keluhan: "Batuk pilek 3 hari, tenggorokan gatal", tindakan: "Pemeriksaan fisik", resep: "Paracetamol 500 mg 3×1, Ambroxol 30 mg 3×1", saran: "Banyak minum air hangat, istirahat cukup" },
    { kode: "K29.7", keluhan: "Nyeri ulu hati, mual setelah makan", tindakan: "Pemeriksaan fisik abdomen", resep: "Antasida sirup 3×1 C, Omeprazole 20 mg 1×1", saran: "Makan teratur, hindari pedas dan kopi" },
    { kode: "I10", keluhan: "Kontrol tensi, kadang pusing", tindakan: "Pengukuran tekanan darah", resep: "Amlodipine 5 mg 1×1", saran: "Kurangi garam, kontrol 2 minggu lagi" },
    { kode: "R51", keluhan: "Sakit kepala sejak kemarin", tindakan: "Pemeriksaan fisik", resep: "Paracetamol 500 mg 3×1 bila perlu", saran: "Tidur cukup, kurangi layar" },
    { kode: "M54.5", keluhan: "Pegal punggung bawah setelah angkat barang", tindakan: "Pemeriksaan muskuloskeletal", resep: "Ibuprofen 400 mg 2×1 sesudah makan", saran: "Kompres hangat, hindari angkat berat" },
    { kode: "A09", keluhan: "BAB cair 4× sejak pagi", tindakan: "Pemeriksaan fisik, evaluasi dehidrasi", resep: "Oralit tiap BAB, Zinc 20 mg 1×1", saran: "Minum cukup, kembali jika lemas" },
  ],
  G: [
    { kode: "K02.9", keluhan: "Gigi geraham ngilu saat minum dingin", tindakan: "Penambalan komposit", resep: "-", saran: "Sikat gigi 2× sehari, kontrol 6 bulan" },
    { kode: "K04.0", keluhan: "Gigi berdenyut terutama malam hari", tindakan: "Perawatan saluran akar tahap 1", resep: "Asam mefenamat 500 mg 3×1", saran: "Kontrol 1 minggu untuk tahap berikutnya" },
    { kode: "K05.1", keluhan: "Gusi mudah berdarah saat sikat gigi", tindakan: "Scaling", resep: "Obat kumur klorheksidin 2×1", saran: "Gunakan sikat gigi berbulu lembut" },
    { kode: "K08.1", keluhan: "Sisa akar gigi, ingin dicabut", tindakan: "Pencabutan gigi", resep: "Amoksisilin 500 mg 3×1, Asam mefenamat 500 mg 3×1", saran: "Gigit kapas 30 menit, jangan berkumur keras hari ini" },
  ],
  A: [
    { kode: "J00", keluhan: "Pilek dan bersin 2 hari", tindakan: "Pemeriksaan fisik", resep: "Paracetamol sirup 3×1 cth bila demam", saran: "Cukup minum, istirahat" },
    { kode: "R50.9", keluhan: "Demam sejak semalam", tindakan: "Pemeriksaan fisik", resep: "Paracetamol sirup 3×1 cth", saran: "Kompres hangat, kembali jika demam > 3 hari" },
    { kode: "A09", keluhan: "Diare 3× hari ini, masih mau minum", tindakan: "Evaluasi dehidrasi", resep: "Oralit, Zinc sirup 1×1 cth", saran: "Lanjutkan ASI/makan, pantau BAB" },
    { kode: "H66.9", keluhan: "Telinga sakit, rewel", tindakan: "Pemeriksaan otoskopi", resep: "Amoksisilin sirup 3×1 cth", saran: "Habiskan antibiotik, kontrol 5 hari" },
  ],
};
const namaIcd = (kode: string) => ICD10.find((d) => d.kode === kode)?.nama ?? kode;

// ───────── 1. bersihkan data demo lama ─────────
async function wipe() {
  for (const t of ["kunjungan", "antrean", "audit_log", "libur", "jadwal_praktik", "dokters", "polis"]) {
    await must(db.from(t).delete().not("id", "is", null), `hapus ${t}`);
  }
  for (let page = 1; ; page++) {
    const { users } = await must(db.auth.admin.listUsers({ page, perPage: 1000 }), "list users");
    const demo = users.filter((u) => u.email?.endsWith(`@${DOMAIN}`));
    for (const u of demo) await must(db.auth.admin.deleteUser(u.id), `hapus ${u.email}`);
    if (users.length < 1000) break;
  }
}

async function createUser(email: string, nama: string) {
  const { user } = await must(
    db.auth.admin.createUser({ email: `${email}@${DOMAIN}`, password: PASSWORD, email_confirm: true, user_metadata: { nama } }),
    `buat ${email}`,
  );
  return user!.id;
}

export async function seedDemo(client: SupabaseClient, log: (msg: string) => void = console.log) {
  db = client;
  seed = 20261120;
  // WIB = UTC+7 tanpa DST.
  todayWib = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  log(`Seed AntreSehat — hari ini (WIB): ${todayWib}`);
  await wipe();
  log("✓ data demo lama dihapus");

  // ───────── 2. akun ─────────
  const staff: Record<string, string> = {};
  for (const s of STAFF) {
    staff[s.email] = await createUser(s.email, s.nama);
    await must(db.from("profiles").update({ role: s.role, no_hp: `0812${int(10000000, 99999999)}` }).eq("id", staff[s.email]), "role staf");
  }

  const pasien: { id: string; anak: boolean }[] = [];
  for (const [i, [nama, jk, tgl]] of PASIEN.entries()) {
    const id = await createUser(i === 0 ? "pasien" : `pasien${String(i).padStart(2, "0")}`, nama);
    await must(db.from("profiles").update({ no_hp: `0813${int(10000000, 99999999)}`, tgl_lahir: tgl, jenis_kelamin: jk }).eq("id", id), "profil pasien");
    // NIK fiktif: 3271 (kode wilayah contoh) + 8 digit + nomor urut.
    await must(db.rpc("set_nik", { p_profile_id: id, p_nik: `3271${int(10000000, 99999999)}${String(i + 1).padStart(4, "0")}` }), "set NIK");
    pasien.push({ id, anak: isAnak(tgl) });
  }
  const demoPasien = pasien[0].id;
  log(`✓ ${STAFF.length} akun staf + ${pasien.length} pasien`);

  // ───────── 3. poli, dokter, jadwal ─────────
  const polis = await must(
    db.from("polis").insert([
      { nama: "Poli Umum", kode_prefix: "U", warna: "#2f6f62" },
      { nama: "Poli Gigi", kode_prefix: "G", warna: "#3b5b8c" },
      { nama: "Poli Anak", kode_prefix: "A", warna: "#a8642a" },
    ]).select(),
    "poli",
  );
  const poliBy = Object.fromEntries(polis.map((p) => [p.kode_prefix as string, p]));

  const dokters = await must(
    db.from("dokters").insert([
      { profile_id: staff["dr.umum"], poli_id: poliBy.U.id, nama: "dr. Andi Pratama", spesialis: "Dokter Umum" },
      { profile_id: staff["dr.umum2"], poli_id: poliBy.U.id, nama: "dr. Maya Puspita", spesialis: "Dokter Umum" },
      { profile_id: staff["dr.gigi"], poli_id: poliBy.G.id, nama: "drg. Sinta Maharani", spesialis: "Dokter Gigi" },
      { profile_id: staff["dr.anak"], poli_id: poliBy.A.id, nama: "dr. Bayu Wicaksono, Sp.A", spesialis: "Spesialis Anak" },
    ]).select(),
    "dokter",
  );
  const [andi, maya, sinta, bayu] = dokters;

  // Senin (1) – Sabtu (6).
  const jadwalRows = [];
  for (let hari = 1; hari <= 6; hari++) {
    const sabtu = hari === 6;
    jadwalRows.push({ dokter_id: andi.id, hari, jam_mulai: "08:00", jam_selesai: "12:00", kuota: 20, menit_per_pasien: 10 });
    if (!sabtu) jadwalRows.push({ dokter_id: andi.id, hari, jam_mulai: "16:00", jam_selesai: "20:00", kuota: 16, menit_per_pasien: 12 });
    jadwalRows.push({ dokter_id: maya.id, hari, jam_mulai: "09:00", jam_selesai: "13:00", kuota: 16, menit_per_pasien: 12 });
    jadwalRows.push({ dokter_id: sinta.id, hari, jam_mulai: "09:00", jam_selesai: "12:00", kuota: 8, menit_per_pasien: 20 });
    if (!sabtu) jadwalRows.push({ dokter_id: sinta.id, hari, jam_mulai: "16:00", jam_selesai: "19:00", kuota: 8, menit_per_pasien: 20 });
    jadwalRows.push({ dokter_id: bayu.id, hari, jam_mulai: "08:00", jam_selesai: "11:00", kuota: 12, menit_per_pasien: 15 });
    if ([1, 3, 5].includes(hari)) jadwalRows.push({ dokter_id: bayu.id, hari, jam_mulai: "17:00", jam_selesai: "20:00", kuota: 10, menit_per_pasien: 15 });
  }
  const jadwal = await must(db.from("jadwal_praktik").insert(jadwalRows).select(), "jadwal");
  const poliOfDokter = Object.fromEntries(dokters.map((d) => [d.id as string, polis.find((p) => p.id === d.poli_id)!]));
  log(`✓ ${polis.length} poli, ${dokters.length} dokter, ${jadwal.length} jadwal`);

  // Contoh cuti dokter dalam 7 hari ke depan (supaya tanggal nonaktif terlihat di booking).
  let cuti = addDays(todayWib, 3);
  if (dow(cuti) === 0) cuti = addDays(cuti, 1);
  await must(db.from("libur").insert({ tanggal: cuti, dokter_id: sinta.id, keterangan: "Cuti — mengikuti seminar" }), "libur");

  // ───────── 4. antrean & kunjungan ─────────
  const antrean: Record<string, unknown>[] = [];
  const kunjungan: Record<string, unknown>[] = [];
  const now = new Date();

  for (let offset = -30; offset <= 0; offset++) {
    const tanggal = addDays(todayWib, offset);
    const isToday = offset === 0;
    const sesi = jadwal
      .filter((j) => j.hari === dow(tanggal))
      .sort((a, b) => String(a.jam_mulai).localeCompare(String(b.jam_mulai)));
    if (!sesi.length) continue; // Minggu

    const nomorPoli: Record<string, number> = {};
    const pool: Record<string, string[]> = {};

    for (const j of sesi) {
      const poli = poliOfDokter[j.dokter_id];
      const kode = poli.kode_prefix as string;
      const mulai = at(tanggal, j.jam_mulai);
      const menit = j.menit_per_pasien as number;

      if (!pool[kode]) {
        const kandidat = pasien.filter((p) => p.anak === (kode === "A")).map((p) => p.id);
        pool[kode] = shuffle(kandidat.filter((id) => id !== demoPasien));
        // Pasien demo punya riwayat rutin di Poli Umum & sesekali Poli Gigi; hari ini dibooking terpisah di bawah.
        if (!isToday && ((kode === "U" && offset % 5 === 0) || (kode === "G" && offset % 11 === 0))) pool[kode].unshift(demoPasien);
      }

      const jumlah = Math.min(pool[kode].length, isToday ? (kode === "U" ? 9 : 5) : int(3, kode === "U" ? 7 : 5));
      const sudahMulai = now >= mulai;

      // Hari ini: status dibuat mundur dari "sekarang" supaya realistis kapan pun seed dijalankan.
      // Urutan: selesai… → diperiksa → dipanggil → check-in ×2 → menunggu…
      const jumlahSelesai = Math.max(0, Math.min(jumlah - 5, 3));
      const statusHariIni = (i: number) => {
        if (!sudahMulai) return i < 2 ? "check_in" : "menunggu";
        if (i < jumlahSelesai) return "selesai";
        if (i === jumlahSelesai) return "diperiksa";
        if (i === jumlahSelesai + 1) return "dipanggil";
        if (i <= jumlahSelesai + 3) return "check_in";
        return "menunggu";
      };

      let cursor = mulai;
      for (let i = 0; i < jumlah; i++) {
        const pasienId = pool[kode].shift()!;
        nomorPoli[kode] = (nomorPoli[kode] ?? 0) + 1;
        const nomor = nomorPoli[kode];
        const walkin = rand() < 0.2;
        // Sesi yang sedang berjalan: yang belum dilayani diestimasi dari sekarang, supaya tidak
        // langsung kena aturan tidak-datang otomatis begitu data demo di-reset.
        const estimasi =
          isToday && sudahMulai && i > jumlahSelesai + 1
            ? new Date(Math.max(addMin(mulai, i * menit).getTime(), addMin(now, (i - jumlahSelesai - 1) * menit).getTime()))
            : addMin(mulai, i * menit);

        let status: string;
        if (isToday) status = statusHariIni(i);
        else {
          const r = rand();
          status = r < 0.08 ? "tidak_datang" : r < 0.12 ? "batal" : "selesai";
        }

        const row: Record<string, unknown> = {
          id: randomUUID(),
          kode_tiket: kodeTiket(),
          tanggal,
          poli_id: poli.id,
          dokter_id: j.dokter_id,
          jadwal_id: j.id,
          pasien_id: pasienId,
          nomor,
          nomor_label: formatNomor(kode, nomor),
          sumber: walkin ? "walkin" : "booking",
          status,
          urutan: nomor,
          jumlah_dilewati: status === "tidak_datang" && rand() < 0.5 ? 2 : 0,
          estimasi_jam: estimasi.toISOString(),
          waktu_booking: (walkin ? addMin(estimasi, -int(10, 40)) : addMin(mulai, -int(60, 3 * 24 * 60))).toISOString(),
        };

        if (["check_in", "dipanggil", "diperiksa", "selesai"].includes(status)) {
          row.waktu_checkin = (walkin ? new Date(row.waktu_booking as string) : addMin(estimasi, -int(5, 30))).toISOString();
        }

        if (["dipanggil", "diperiksa", "selesai"].includes(status)) {
          let dipanggil: Date, mulaiPeriksa: Date | null = null, selesai: Date | null = null;
          if (isToday) {
            // Mundur dari sekarang: yang diperiksa mulai setengah slot lalu, yang selesai berjajar sebelumnya.
            const mulaiDiperiksa = addMin(now, -Math.round(menit / 2));
            if (status === "dipanggil") dipanggil = addMin(now, -1);
            else if (status === "diperiksa") { mulaiPeriksa = mulaiDiperiksa; dipanggil = addMin(mulaiPeriksa, -1); }
            else {
              selesai = addMin(mulaiDiperiksa, -1 - (jumlahSelesai - 1 - i) * menit);
              mulaiPeriksa = addMin(selesai, -Math.round(menit * 0.9));
              dipanggil = addMin(mulaiPeriksa, -2);
            }
          } else {
            dipanggil = new Date(Math.max(cursor.getTime(), addMin(estimasi, int(-5, 15)).getTime()));
            mulaiPeriksa = addMin(dipanggil, int(1, 3));
            selesai = addMin(mulaiPeriksa, Math.round(menit * (0.6 + rand() * 0.7)));
            cursor = selesai;
          }
          row.waktu_dipanggil = dipanggil.toISOString();
          if (mulaiPeriksa) row.waktu_mulai = mulaiPeriksa.toISOString();
          if (selesai) row.waktu_selesai = selesai.toISOString();
        }

        antrean.push(row);

        if (status === "selesai") {
          const c = pick(CATATAN[kode]);
          kunjungan.push({
            antrean_id: row.id,
            dokter_id: j.dokter_id,
            pasien_id: pasienId,
            keluhan: c.keluhan,
            tensi: kode === "A" ? null : `${int(105, 150)}/${int(65, 95)}`,
            suhu: Number((36 + rand() * (c.kode === "R50.9" ? 2.5 : 1.2)).toFixed(1)),
            berat: kode === "A" ? int(9, 35) : int(45, 88),
            diagnosis: namaIcd(c.kode),
            icd10: c.kode,
            tindakan: c.tindakan,
            resep: c.resep,
            saran: c.saran,
            created_at: row.waktu_selesai,
          });
        }
      }
    }

    // Pasien demo: booking aktif hari ini di Poli Umum, di belakang antrean yang sedang berjalan.
    if (isToday) {
      const sesiUmum = sesi.find((j) => j.dokter_id === andi.id && now < at(tanggal, j.jam_selesai, -30)) ?? null;
      if (sesiUmum) {
        nomorPoli.U = (nomorPoli.U ?? 0) + 1;
        const terisi = antrean.filter((a) => a.tanggal === tanggal && a.jadwal_id === sesiUmum.id).length;
        antrean.push({
          id: randomUUID(),
          kode_tiket: "DEMO000001",
          tanggal,
          poli_id: poliBy.U.id,
          dokter_id: andi.id,
          jadwal_id: sesiUmum.id,
          pasien_id: demoPasien,
          nomor: nomorPoli.U,
          nomor_label: formatNomor("U", nomorPoli.U),
          sumber: "booking",
          status: "menunggu",
          urutan: nomorPoli.U,
          // Tepat setelah antrean terakhir di sesinya (minimal sekarang).
          estimasi_jam: new Date(
            Math.max(
              now.getTime(),
              addMin(at(tanggal, sesiUmum.jam_mulai), terisi * sesiUmum.menit_per_pasien).getTime(),
              ...antrean
                .filter((a) => a.tanggal === tanggal && a.jadwal_id === sesiUmum.id)
                .map((a) => Date.parse(a.estimasi_jam as string) + sesiUmum.menit_per_pasien * 60e3),
            ),
          ).toISOString(),
          waktu_booking: addMin(now, -45).toISOString(),
        });
      }
    }
  }

  // Seed dijalankan malam / hari Minggu → booking pasien demo dipindah ke hari praktik berikutnya.
  if (!antrean.some((a) => a.pasien_id === demoPasien && a.status === "menunggu")) {
    let tanggal = addDays(todayWib, 1);
    if (dow(tanggal) === 0) tanggal = addDays(tanggal, 1);
    const sesiAndi = jadwal.find((j) => j.dokter_id === andi.id && j.hari === dow(tanggal))!;
    antrean.push({
      id: randomUUID(), kode_tiket: "DEMO000001", tanggal, poli_id: poliBy.U.id, dokter_id: andi.id, jadwal_id: sesiAndi.id,
      pasien_id: demoPasien, nomor: 1, nomor_label: "U-001", sumber: "booking", status: "menunggu", urutan: 1,
      estimasi_jam: at(tanggal, sesiAndi.jam_mulai).toISOString(), waktu_booking: addMin(now, -45).toISOString(),
    });
  }

  for (let i = 0; i < antrean.length; i += 500) await must(db.from("antrean").insert(antrean.slice(i, i + 500), { defaultToNull: false }), "antrean");
  for (let i = 0; i < kunjungan.length; i += 500) await must(db.from("kunjungan").insert(kunjungan.slice(i, i + 500), { defaultToNull: false }), "kunjungan");

  const hariIni = antrean.filter((a) => a.tanggal === todayWib).length;
  log(`✓ ${antrean.length} antrean (${hariIni} hari ini) + ${kunjungan.length} catatan kunjungan`);
  if (!hariIni) log("  (hari ini Minggu — klinik tutup, jadi tidak ada antrean hari ini)");
  log(`\nSelesai. Semua akun demo memakai password: ${PASSWORD}`);
}
