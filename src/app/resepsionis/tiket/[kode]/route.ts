import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";
import { formatJamWib, labelSesi } from "@/lib/antrean";
import { createClient } from "@/lib/supabase/server";
import { formatTanggalPendek } from "@/lib/time";

const MM = 72 / 25.4; // pt per mm
const LEBAR = 58 * MM; // kertas struk 58mm
const TINGGI = 112 * MM;
const TEPI = 4 * MM;

// GET /resepsionis/tiket/<kode> → PDF tiket struk 58mm (PRD 5.3). Hanya resepsionis/admin.
export async function GET(_req: Request, { params }: { params: Promise<{ kode: string }> }) {
  const { kode } = await params;
  if (!/^[A-Z0-9]{6,16}$/.test(kode)) return new Response("Kode tidak valid", { status: 400 });

  const supabase = await createClient();
  const { data: role } = await supabase.rpc("app_role");
  if (role !== "resepsionis" && role !== "admin") return new Response("Tidak diizinkan", { status: 403 });

  const { data: t } = await supabase
    .from("antrean")
    .select("kode_tiket, tanggal, nomor_label, estimasi_jam, polis(nama), dokters(nama), jadwal_praktik(jam_mulai, jam_selesai)")
    .eq("kode_tiket", kode)
    .maybeSingle();
  if (!t || !t.polis || !t.dokters || !t.jadwal_praktik) return new Response("Tiket tidak ditemukan", { status: 404 });

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Tiket ${t.nomor_label}`);
  const page = pdf.addPage([LEBAR, TINGGI]);
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const hitam = rgb(0.086, 0.094, 0.106);
  const abu = rgb(0.36, 0.39, 0.43);

  let y = TINGGI - TEPI;
  const tengah = (teks: string, size: number, font = reg, color = hitam) => {
    y -= size;
    page.drawText(teks, { x: (LEBAR - font.widthOfTextAtSize(teks, size)) / 2, y, size, font, color });
    y -= size * 0.45;
  };
  const garis = () => {
    y -= 4;
    page.drawLine({ start: { x: TEPI, y }, end: { x: LEBAR - TEPI, y }, thickness: 0.5, color: abu, dashArray: [2, 2] });
    y -= 8;
  };

  tengah("Klinik AntreSehat", 10, bold);
  tengah("Tiket antrean walk-in", 7, reg, abu);
  garis();
  tengah("NOMOR ANTREAN", 6.5, reg, abu);
  tengah(t.nomor_label, 30, bold);
  tengah(t.polis.nama, 9, bold);
  tengah(t.dokters.nama, 7.5);
  garis();
  tengah(`${formatTanggalPendek(t.tanggal)} · ${labelSesi(t.jadwal_praktik)}`, 7);
  if (t.estimasi_jam) tengah(`Perkiraan dilayani ± ${formatJamWib(t.estimasi_jam)} WIB`, 7);

  const qr = await pdf.embedPng(await QRCode.toBuffer(t.kode_tiket, { margin: 0, width: 300, errorCorrectionLevel: "M" }));
  const sisi = 30 * MM;
  y -= sisi + 4;
  page.drawImage(qr, { x: (LEBAR - sisi) / 2, y, width: sisi, height: sisi });
  y -= 4;
  tengah(t.kode_tiket, 7, reg, abu);
  garis();
  tengah("Pantau posisi antrean di layar ruang tunggu.", 5.5, reg, abu);
  tengah("Demo portofolio - data fiktif.", 5.5, reg, abu);

  const bytes = await pdf.save();
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="tiket-${t.nomor_label}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
