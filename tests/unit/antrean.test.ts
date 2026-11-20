import { describe, expect, it } from "vitest";
import { formatNomor } from "@/lib/antrean";
import { BATAS_DILEWATI, hitungPosisi, pilihBerikutnya, urutanSetelahLewati, type PublicAntrean } from "@/lib/antrean-live";
import { hitungSlot } from "@/lib/booking";
import { kalimatPanggilan, terbilang } from "@/lib/panggilan";

describe("format nomor (aturan 1)", () => {
  it("prefix + 3 digit", () => {
    expect(formatNomor("U", 1)).toBe("U-001");
    expect(formatNomor("G", 12)).toBe("G-012");
    expect(formatNomor("A", 999)).toBe("A-999");
  });
  it("lebih dari 999 tidak dipotong", () => {
    expect(formatNomor("U", 1000)).toBe("U-1000");
  });
});

describe("kalimat panggilan", () => {
  it("terbilang", () => {
    expect(terbilang(0)).toBe("nol");
    expect(terbilang(11)).toBe("sebelas");
    expect(terbilang(12)).toBe("dua belas");
    expect(terbilang(40)).toBe("empat puluh");
    expect(terbilang(105)).toBe("seratus lima");
    expect(terbilang(999)).toBe("sembilan ratus sembilan puluh sembilan");
  });
  it("kalimat lengkap", () => {
    expect(kalimatPanggilan("U-012", "Poli Umum")).toBe("Nomor antrean U, dua belas, silakan ke Poli Umum.");
  });
});

// Senin 23 Nov 2026, sesi 08.00–12.00, 10 menit per pasien.
const SENIN = "2026-11-23";
const jadwal = { id: "j1", dokter_id: "d1", hari: 1, jam_mulai: "08:00:00", jam_selesai: "12:00:00", kuota: 5, menit_per_pasien: 10 };
const jam = (hhmm: string, tanggal = SENIN) => new Date(`${tanggal}T${hhmm}:00+07:00`);

describe("estimasi & status slot booking (aturan 4 & 5)", () => {
  const slotSenin = (terisi: number, now: Date, libur: { tanggal: string; dokter_id: string | null }[] = []) =>
    hitungSlot([jadwal], [{ jadwal_id: "j1", tanggal: SENIN, terisi }], libur, SENIN, now).find((s) => s.tanggal === SENIN)!;

  it("estimasi = jam mulai + posisi × menit per pasien", () => {
    const s = slotSenin(3, jam("06:00"));
    expect(s.estimasi).toBe("08.30");
    expect(s.sisa).toBe(2);
    expect(s.status).toBe("ok");
  });
  it("estimasi tidak lebih awal dari sekarang", () => {
    expect(slotSenin(0, jam("09:12")).estimasi).toBe("09.12");
  });
  it("kuota habis → penuh", () => {
    const s = slotSenin(5, jam("06:00"));
    expect(s.status).toBe("penuh");
    expect(s.sisa).toBe(0);
  });
  it("ditutup 30 menit sebelum sesi berakhir", () => {
    expect(slotSenin(0, jam("11:29")).status).toBe("ok");
    expect(slotSenin(0, jam("11:30")).status).toBe("tutup");
  });
  it("libur klinik atau dokter cuti → libur", () => {
    expect(slotSenin(0, jam("06:00"), [{ tanggal: SENIN, dokter_id: null }]).status).toBe("libur");
    expect(slotSenin(0, jam("06:00"), [{ tanggal: SENIN, dokter_id: "d1" }]).status).toBe("libur");
    expect(slotSenin(0, jam("06:00"), [{ tanggal: SENIN, dokter_id: "d2" }]).status).toBe("ok");
  });
  it("hanya hari ini s/d H+7, sesuai hari praktik", () => {
    const tanggal = hitungSlot([jadwal], [], [], SENIN, jam("06:00")).map((s) => s.tanggal);
    expect(tanggal).toEqual([SENIN, "2026-11-30"]);
  });
});

const row = (p: Partial<PublicAntrean> & Pick<PublicAntrean, "id" | "urutan" | "status">): PublicAntrean => ({
  tanggal: SENIN,
  poli_id: "p1",
  dokter_id: "d1",
  jadwal_id: "j1",
  nomor: p.urutan,
  nomor_label: formatNomor("U", p.urutan),
  jumlah_dilewati: 0,
  estimasi_jam: null,
  waktu_dipanggil: null,
  waktu_mulai: null,
  waktu_selesai: null,
  ...p,
});

describe("posisi & estimasi live (aturan 5)", () => {
  it("sesi belum mulai: jam mulai + posisi × menit", () => {
    const rows = [row({ id: "a", urutan: 1, status: "menunggu" }), row({ id: "b", urutan: 2, status: "check_in" }), row({ id: "me", urutan: 3, status: "menunggu" })];
    const p = hitungPosisi(rows, "me", jadwal, jam("07:00"));
    expect(p.didepan).toBe(2);
    expect(p.estimasi).toEqual(jam("08:20"));
  });
  it("sesi berjalan: pakai rata-rata durasi periksa hari itu", () => {
    const rows = [
      row({ id: "a", urutan: 1, status: "selesai", waktu_mulai: jam("08:00").toISOString(), waktu_selesai: jam("08:20").toISOString() }),
      row({ id: "b", urutan: 2, status: "diperiksa", waktu_dipanggil: jam("08:21").toISOString() }),
      row({ id: "c", urutan: 3, status: "check_in" }),
      row({ id: "me", urutan: 4, status: "menunggu" }),
    ];
    const p = hitungPosisi(rows, "me", jadwal, jam("08:30"));
    expect(p.dilayani).toBe("U-002");
    expect(p.didepan).toBe(1);
    // (1 di depan + 1 sedang diperiksa) × rata-rata 20 menit
    expect(p.estimasi).toEqual(jam("09:10"));
  });
  it("yang batal/tidak datang tidak dihitung di depan", () => {
    const rows = [row({ id: "a", urutan: 1, status: "batal" }), row({ id: "b", urutan: 2, status: "tidak_datang" }), row({ id: "me", urutan: 3, status: "menunggu" })];
    expect(hitungPosisi(rows, "me", jadwal, jam("07:00")).didepan).toBe(0);
  });
});

describe("aturan lewati (aturan 6)", () => {
  const antre = (...u: number[]) => u.map((urutan) => ({ urutan }));
  it("pindah ke antara posisi ke-3 dan ke-4 di belakangnya", () => {
    expect(urutanSetelahLewati(2, antre(3, 4, 5, 6, 7))).toBe(5.5);
  });
  it("kurang dari 4 di belakang → paling belakang", () => {
    expect(urutanSetelahLewati(2, antre(3, 4))).toBe(5);
  });
  it("sudah paling belakang → tetap", () => {
    expect(urutanSetelahLewati(9, antre(1, 2))).toBe(9);
  });
  it("dilewati 2× → tidak datang", () => {
    expect(BATAS_DILEWATI).toBe(2);
  });
  it("panggil berikutnya: sesi paling awal, urutan terkecil, lompati yang belum check-in", () => {
    const next = pilihBerikutnya([
      { id: "x", status: "menunggu" as const, urutan: 1, jam_mulai: "08:00:00" },
      { id: "y", status: "check_in" as const, urutan: 3, jam_mulai: "08:00:00" },
      { id: "z", status: "dilewati" as const, urutan: 2.5, jam_mulai: "08:00:00" },
      { id: "w", status: "check_in" as const, urutan: 1, jam_mulai: "16:00:00" },
    ]);
    expect(next?.id).toBe("z");
  });
});
