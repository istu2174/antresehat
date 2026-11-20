import ExcelJS from "exceljs";
import { angka, argsRpc, bacaFilter, type Laporan } from "@/lib/laporan";
import { createClient } from "@/lib/supabase/server";

// GET /admin/laporan/ekspor?format=xlsx|csv&dari&sampai&poli&dokter
// Memanggil RPC yang sama dengan halaman → angka identik dengan yang tampil di layar.
export async function GET(req: Request) {
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const format = sp.format === "csv" ? "csv" : "xlsx";
  const f = bacaFilter(sp);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("laporan", argsRpc(f));
  if (error?.code === "42501" || error?.message === "HANYA_ADMIN") return new Response("Tidak diizinkan", { status: 403 });
  if (error || !data) return new Response("Laporan gagal dibuat", { status: 400 });
  const lap = data as unknown as Laporan;
  const nama = `laporan-antresehat-${f.dari}_${f.sampai}`;

  const KOLOM = ["Tanggal", "Poli", "Dokter", "Antrean", "Kunjungan", "Tidak datang", "Rata-rata tunggu (mnt)", "Rata-rata periksa (mnt)"];
  const baris = lap.detail.map((d) => [d.tanggal, d.poli, d.dokter, d.antrean, d.kunjungan, d.tidak_datang, d.rata_tunggu_menit, d.rata_periksa_menit] as const);
  const r = lap.ringkasan;
  const ringkasan: [string, number | null][] = [
    ["Total antrean (tanpa batal)", r.total_antrean],
    ["Total kunjungan", r.kunjungan],
    ["Rata-rata waktu tunggu (mnt)", r.rata_tunggu_menit],
    ["Rata-rata durasi periksa (mnt)", r.rata_periksa_menit],
    ["Tidak datang (pasien)", r.tidak_datang],
    ["Tidak datang (%)", r.persen_tidak_datang],
  ];

  if (format === "csv") {
    // Format Excel Indonesia: pemisah ";" dan desimal koma — sama dengan angka di layar.
    const sel = (v: string | number | null) => {
      const s = typeof v === "number" ? angka(v).replace(/\./g, "") : v === null ? "" : v;
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [KOLOM, ...baris].map((b) => b.map(sel).join(";")).join("\r\n");
    return new Response(`﻿${csv}\r\n`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nama}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "AntreSehat";
  const s1 = wb.addWorksheet("Ringkasan");
  s1.addRow(["Laporan AntreSehat", `${f.dari} s/d ${f.sampai}`]).font = { bold: true };
  s1.addRow([]);
  for (const [k, v] of ringkasan) s1.addRow([k, v]);
  s1.getColumn(1).width = 32;
  s1.getColumn(2).width = 22;
  s1.getColumn(2).numFmt = "0.#";
  s1.addRow([]);
  s1.addRow(["Data demo fiktif — bukan untuk penggunaan medis."]).font = { italic: true, color: { argb: "FF5D636D" } };

  const s2 = wb.addWorksheet("Detail");
  s2.addRow(KOLOM).font = { bold: true };
  for (const b of baris) s2.addRow([...b]);
  [12, 14, 28, 10, 11, 13, 22, 23].forEach((w, i) => (s2.getColumn(i + 1).width = w));
  s2.getColumn(7).numFmt = "0.0";
  s2.getColumn(8).numFmt = "0.0";
  s2.views = [{ state: "frozen", ySplit: 1 }];

  const s3 = wb.addWorksheet("Per hari");
  s3.addRow(["Tanggal", "Kunjungan"]).font = { bold: true };
  for (const h of lap.per_hari) s3.addRow([h.tanggal, h.kunjungan]);
  s3.getColumn(1).width = 12;

  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nama}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
