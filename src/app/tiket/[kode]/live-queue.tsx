"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellIcon, BellRingIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAntreanRealtime, type LiveStatus } from "@/hooks/use-antrean-realtime";
import { formatJamWib } from "@/lib/antrean";
import { hitungPosisi, STATUS_MENUNGGU } from "@/lib/antrean-live";
import { cn } from "@/lib/utils";

type Props = {
  antreanId: string;
  jadwalId: string;
  tanggal: string;
  kode: string;
  nomor: string;
  poli: string;
  jadwal: { jam_mulai: string; menit_per_pasien: number };
};

const BATAS_PENGINGAT = 3; // PRD 5.2: notifikasi saat tinggal 3 nomor lagi

function kirimNotifikasi(title: string, body: string, tag: string) {
  toast(title, { description: body });
  navigator.vibrate?.([250, 100, 250]);
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, tag, icon: "/favicon.ico" });
  } catch {
    // Chrome Android hanya mengizinkan notifikasi lewat service worker — toast + getar sudah cukup.
  }
}

function Koneksi({ status }: { status: LiveStatus }) {
  const label = { live: "Langsung", connecting: "Menyambungkan…", offline: "Terputus, mencoba lagi…" }[status];
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
      <span
        aria-hidden
        className={cn(
          "size-2 rounded-full",
          status === "live" ? "bg-emerald-600 motion-safe:animate-pulse" : status === "offline" ? "bg-destructive" : "bg-muted-foreground",
        )}
      />
      {label}
    </span>
  );
}

export function LiveQueue({ antreanId, jadwalId, tanggal, kode, nomor, poli, jadwal }: Props) {
  const router = useRouter();
  const { rows, status } = useAntreanRealtime({ tanggal, jadwal_id: jadwalId });

  // Estimasi bergantung pada jam sekarang → hitung ulang tiap 30 detik walau tidak ada event.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const { saya, dilayani, didepan, estimasi } = hitungPosisi(rows, antreanId, jadwal, now);
  const menunggu = saya ? STATUS_MENUNGGU.includes(saya.status) : false;

  // Status tiket berubah → segarkan bagian server (badge, tombol batal).
  const statusAwal = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!saya) return;
    if (statusAwal.current && statusAwal.current !== saya.status) router.refresh();
    statusAwal.current = saya.status;
  }, [saya, router]);

  // Notifikasi sekali per kejadian (disimpan per tab supaya tidak berulang saat refresh).
  useEffect(() => {
    if (!saya) return;
    const key = `antresehat:notif:${kode}`;
    let sudah: string[] = [];
    try {
      sudah = JSON.parse(sessionStorage.getItem(key) ?? "[]");
    } catch {}
    const kirim = (tag: string, title: string, body: string) => {
      if (sudah.includes(tag)) return;
      sudah.push(tag);
      try {
        sessionStorage.setItem(key, JSON.stringify(sudah));
      } catch {}
      kirimNotifikasi(title, body, kode);
    };

    if (saya.status === "dipanggil") {
      // Tag memakai waktu panggil supaya "Panggil ulang" memberi notifikasi lagi.
      kirim(`dipanggil:${saya.waktu_dipanggil}`, `Giliranmu! ${nomor}`, `Silakan masuk ke ${poli}.`);
    } else if (menunggu && didepan > 0 && didepan <= BATAS_PENGINGAT) {
      kirim("hampir", "Sebentar lagi giliranmu", `Tinggal ${didepan} orang lagi di depanmu. Bersiap di dekat ${poli}.`);
    }
  }, [saya, didepan, menunggu, kode, nomor, poli]);

  // Izin notifikasi harus diminta dari klik pengguna.
  const [izin, setIzin] = useState<NotificationPermission | "unsupported">("default");
  useEffect(() => {
    setIzin("Notification" in window ? Notification.permission : "unsupported");
  }, []);
  async function mintaIzin() {
    const hasil = await Notification.requestPermission();
    setIzin(hasil);
    if (hasil === "granted") toast.success("Notifikasi aktif. Kamu akan diberi tahu saat giliranmu dekat.");
  }

  let isi: React.ReactNode;
  if (!saya) {
    isi = (
      <div className="neu-inset rounded-2xl p-5 text-sm text-muted-foreground">
        {status === "offline" ? "Belum tersambung ke antrean. Mencoba lagi…" : "Memuat posisi antrean…"}
      </div>
    );
  } else if (saya.status === "dipanggil") {
    isi = (
      <div className="neu-ink relative overflow-hidden rounded-2xl p-6 text-center">
        <span aria-hidden className="absolute inset-0 rounded-2xl ring-4 ring-white/20 motion-safe:animate-ping" />
        <p className="text-sm text-white/70">Nomor {nomor}</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight">Giliranmu!</p>
        <p className="mt-2 text-white/80">Silakan masuk ke {poli}.</p>
      </div>
    );
  } else if (saya.status === "diperiksa") {
    isi = (
      <div className="neu-ink rounded-2xl p-6 text-center">
        <p className="text-2xl font-semibold tracking-tight">Sedang diperiksa</p>
        <p className="mt-1 text-sm text-white/70">Semoga lekas sehat.</p>
      </div>
    );
  } else if (saya.status === "selesai") {
    isi = (
      <div className="neu-inset rounded-2xl p-5">
        <p className="text-lg font-semibold">Pemeriksaan selesai</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Ringkasan dari dokter ada di <Link href="/riwayat" className="font-medium text-foreground underline underline-offset-4">riwayat</Link>.
        </p>
      </div>
    );
  } else if (saya.status === "batal" || saya.status === "tidak_datang") {
    isi = (
      <div className="neu-inset rounded-2xl p-5">
        <p className="text-lg font-semibold text-destructive">{saya.status === "batal" ? "Booking dibatalkan" : "Ditandai tidak datang"}</p>
        <p className="mt-1 text-sm text-muted-foreground">Nomor ini sudah tidak aktif. Kamu bisa booking ulang.</p>
      </div>
    );
  } else {
    // menunggu / check-in / dilewati
    isi = (
      <div className="neu-inset rounded-2xl p-5">
        {saya.status === "dilewati" && (
          <p className="mb-3 rounded-xl bg-amber-100/70 px-3 py-2 text-sm font-medium text-amber-900">
            Nomormu dilewati. Segera lapor ke resepsionis.
          </p>
        )}
        <p className="text-sm text-muted-foreground">Posisi kamu</p>
        <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">
          {didepan === 0 ? "Berikutnya" : `${didepan} orang lagi`}
        </p>
        {estimasi && (
          <p className="mt-2 text-sm">
            Perkiraan dilayani <span className="font-semibold tabular-nums">± {formatJamWib(estimasi.toISOString())} WIB</span>
          </p>
        )}
        {saya.status === "menunggu" && (
          <p className="mt-3 text-xs text-muted-foreground">Belum check-in. Tunjukkan QR di bawah ke resepsionis saat tiba.</p>
        )}
      </div>
    );
  }

  return (
    <section aria-labelledby="live-title" className="neu-raised mt-2 rounded-3xl p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 id="live-title" className="font-semibold tracking-tight">Antrean langsung</h2>
        <Koneksi status={status} />
      </div>

      {/* aria-live: pembaca layar mengumumkan perubahan posisi/status */}
      <div aria-live="polite" className="mt-4">{isi}</div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="neu-inset rounded-xl p-3">
          <dt className="text-xs text-muted-foreground">Sedang dilayani</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums">{dilayani ?? "—"}</dd>
        </div>
        <div className="neu-inset rounded-xl p-3">
          <dt className="text-xs text-muted-foreground">Nomor kamu</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums">{nomor}</dd>
        </div>
      </dl>

      {izin === "default" && menunggu && (
        <Button variant="outline" className="mt-4 w-full" onClick={mintaIzin}>
          <BellIcon aria-hidden />
          Aktifkan notifikasi giliran
        </Button>
      )}
      {izin === "granted" && menunggu && (
        <p className="mt-4 inline-flex items-center gap-2 text-xs text-muted-foreground">
          <BellRingIcon className="size-3.5" aria-hidden />
          Notifikasi aktif: saat tinggal {BATAS_PENGINGAT} nomor dan saat dipanggil.
        </p>
      )}
    </section>
  );
}
