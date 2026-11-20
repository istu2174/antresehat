import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { ChevronLeftIcon } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { formatJamWib, labelSesi } from "@/lib/antrean";
import { wib } from "@/lib/booking";
import { createClient } from "@/lib/supabase/server";
import { formatTanggalPendek, todayWib } from "@/lib/time";
import { LiveQueue } from "./live-queue";
import { TicketActions } from "./ticket-actions";

type Params = { params: Promise<{ kode: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { kode } = await params;
  return { title: `Tiket ${kode}` };
}

export default async function TiketPage({ params }: Params) {
  const { kode } = await params;
  if (!/^[A-Z0-9]{6,16}$/.test(kode)) notFound();

  // RLS: pasien hanya bisa membaca tiket miliknya — kode orang lain menghasilkan 404.
  const supabase = await createClient();
  const { data: t } = await supabase
    .from("antrean")
    .select("id, jadwal_id, dokter_id, kode_tiket, tanggal, nomor_label, status, estimasi_jam, polis(nama, warna), dokters(nama), jadwal_praktik(jam_mulai, jam_selesai, menit_per_pasien)")
    .eq("kode_tiket", kode)
    .maybeSingle();
  if (!t || !t.polis || !t.dokters || !t.jadwal_praktik) notFound();

  const qrSvg = await QRCode.toString(t.kode_tiket, {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark: "#16181b", light: "#ffffff" },
  });

  const mulaiSesi = wib(t.tanggal, t.jadwal_praktik.jam_mulai);
  const bisaBatal = t.status === "menunggu" && Date.now() <= mulaiSesi.getTime() - 60 * 60e3;
  const tanggal = formatTanggalPendek(t.tanggal);
  const sesi = labelSesi(t.jadwal_praktik);
  const estimasi = t.estimasi_jam ? `± ${formatJamWib(t.estimasi_jam)} WIB` : "—";
  const today = todayWib();
  const hariH = t.tanggal === today;

  // Booking yang dibatalkan karena admin menambah libur/cuti: tampilkan alasannya (PRD 5.5).
  const { data: libur } =
    t.status === "batal"
      ? await supabase
          .from("libur")
          .select("keterangan, dokter_id")
          .eq("tanggal", t.tanggal)
          .or(`dokter_id.is.null,dokter_id.eq.${t.dokter_id}`)
          .limit(1)
          .maybeSingle()
      : { data: null };

  return (
    <div className="mx-auto max-w-md pt-6 sm:pt-10">
      <Link href="/riwayat" className="inline-flex h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeftIcon className="size-4" aria-hidden />
        Riwayat
      </Link>

      {/* Di hari H, posisi antrean langsung jadi informasi utama */}
      {hariH && (
        <LiveQueue
          antreanId={t.id}
          jadwalId={t.jadwal_id}
          tanggal={t.tanggal}
          kode={t.kode_tiket}
          nomor={t.nomor_label}
          poli={t.polis.nama}
          jadwal={{ jam_mulai: t.jadwal_praktik.jam_mulai, menit_per_pasien: t.jadwal_praktik.menit_per_pasien }}
        />
      )}

      <article aria-labelledby="nomor" className="neu-raised mt-4 rounded-3xl p-5 sm:p-6">
        <header className="flex items-center justify-between gap-3">
          <span className="inline-flex min-w-0 items-center gap-2 font-medium">
            <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: t.polis.warna }} />
            <span className="truncate">{t.polis.nama}</span>
          </span>
          <StatusBadge status={t.status} />
        </header>

        <div className="neu-ink mt-5 rounded-2xl py-7 text-center">
          <p className="text-xs tracking-[0.2em] text-white/60 uppercase">Nomor antrean</p>
          <p id="nomor" className="mt-1 text-6xl font-semibold tabular-nums tracking-tight sm:text-7xl">{t.nomor_label}</p>
        </div>

        <div className="mt-5 grid grid-cols-[auto_1fr] items-center gap-5">
          {/* QR selalu hitam di atas putih supaya mudah dipindai kamera resepsionis */}
          <div className="neu-inset rounded-2xl p-3">
            <div
              role="img"
              aria-label={`QR code tiket ${t.kode_tiket}`}
              className="size-28 rounded-lg bg-white p-2 [&>svg]:size-full"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Kode tiket</p>
            <p className="font-mono text-lg font-semibold tracking-wider break-all">{t.kode_tiket}</p>
            <p className="mt-1 text-xs text-muted-foreground">Tunjukkan QR ini saat check-in.</p>
          </div>
        </div>

        <dl className="mt-6 grid gap-3 text-sm">
          {[
            ["Dokter", t.dokters.nama],
            ["Tanggal", tanggal],
            ["Sesi", sesi],
            // Di hari H perkiraan langsung ada di blok atas.
            ...(hariH ? [] : [["Perkiraan dilayani", estimasi]]),
          ].map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-4">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="text-right font-medium tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </article>

      {libur && (
        <p role="status" className="neu-inset mt-4 rounded-2xl p-4 text-sm">
          Booking ini dibatalkan klinik karena {libur.dokter_id ? `${t.dokters.nama} cuti` : "klinik libur"}: {libur.keterangan}. Silakan booking di
          tanggal lain.
        </p>
      )}

      {t.tanggal > today && t.status === "menunggu" && (
        <p className="neu-inset mt-4 rounded-2xl p-4 text-sm text-muted-foreground">
          Posisi antrean langsung tampil di sini pada hari H ({tanggal}).
        </p>
      )}

      <TicketActions
        kode={t.kode_tiket}
        bisaBatal={bisaBatal}
        statusMenunggu={t.status === "menunggu"}
        gambar={{ nomor: t.nomor_label, poli: t.polis.nama, dokter: t.dokters.nama, tanggal, sesi, estimasi }}
      />
    </div>
  );
}
