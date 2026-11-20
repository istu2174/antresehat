"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { DownloadIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { batalkanBooking } from "@/lib/actions/booking";

type Gambar = { nomor: string; poli: string; dokter: string; tanggal: string; sesi: string; estimasi: string };

// Gambar tiket ke canvas lalu unduh sebagai PNG ("Simpan ke galeri").
async function unduhTiket(kode: string, g: Gambar) {
  const W = 720, H = 1180, S = 2; // S = skala supaya tajam di layar HP
  const canvas = document.createElement("canvas");
  canvas.width = W * S;
  canvas.height = H * S;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(S, S);
  const font = getComputedStyle(document.body).fontFamily;
  const text = (s: string, x: number, y: number, size: number, weight = 400, color = "#16181b", align: CanvasTextAlign = "left") => {
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(s, x, y);
  };

  ctx.fillStyle = "#eceef1";
  ctx.fillRect(0, 0, W, H);
  text("Klinik AntreSehat", 60, 90, 26, 600);
  text(g.poli, 60, 128, 22, 400, "#5d636d");

  // Blok nomor dengan gradasi hitam
  const grad = ctx.createLinearGradient(60, 160, 660, 420);
  grad.addColorStop(0, "#3a3d43");
  grad.addColorStop(1, "#0c0d0f");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(60, 160, 600, 250, 32);
  ctx.fill();
  text("NOMOR ANTREAN", W / 2, 225, 18, 500, "rgba(244,245,247,0.6)", "center");
  text(g.nomor, W / 2, 345, 112, 600, "#f4f5f7", "center");

  const qr = new Image();
  qr.src = await QRCode.toDataURL(kode, { margin: 1, width: 600, color: { dark: "#16181b", light: "#ffffff" } });
  await qr.decode();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(210, 450, 300, 300, 24);
  ctx.fill();
  ctx.drawImage(qr, 225, 465, 270, 270);
  text(kode, W / 2, 800, 28, 600, "#16181b", "center");
  text("Tunjukkan QR ini saat check-in", W / 2, 838, 18, 400, "#5d636d", "center");

  const rows: [string, string][] = [["Dokter", g.dokter], ["Tanggal", g.tanggal], ["Sesi", g.sesi], ["Perkiraan dilayani", g.estimasi]];
  rows.forEach(([k, v], i) => {
    const y = 910 + i * 52;
    text(k, 60, y, 22, 400, "#5d636d");
    text(v, 660, y, 22, 600, "#16181b", "right");
  });
  text("Demo portofolio — data fiktif", W / 2, H - 40, 16, 400, "#8a9099", "center");

  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("Gagal membuat gambar");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tiket-${g.nomor}.png`;
  a.click();
  URL.revokeObjectURL(url);
}

type Props = { kode: string; bisaBatal: boolean; statusMenunggu: boolean; gambar: Gambar };

export function TicketActions({ kode, bisaBatal, statusMenunggu, gambar }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pending, startTransition] = useTransition();

  async function simpan() {
    setSaving(true);
    try {
      await unduhTiket(kode, gambar);
    } catch {
      toast.error("Gagal menyimpan gambar tiket.");
    } finally {
      setSaving(false);
    }
  }

  function batal() {
    startTransition(async () => {
      const { error } = await batalkanBooking(kode);
      if (error) {
        toast.error(error);
        return;
      }
      setOpen(false);
      toast.success("Booking dibatalkan. Kuota dikembalikan.");
      router.refresh();
    });
  }

  return (
    <div className="mt-6 grid gap-3">
      <Button variant="outline" size="lg" onClick={simpan} disabled={saving}>
        {saving ? <Loader2Icon className="animate-spin" aria-hidden /> : <DownloadIcon aria-hidden />}
        Simpan ke galeri
      </Button>

      {bisaBatal ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button variant="ghost" size="lg" className="text-destructive hover:text-destructive" />}>
            Batalkan booking
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Batalkan nomor {gambar.nomor}?</DialogTitle>
            <DialogDescription>
              Nomor ini akan dilepas dan kuotanya kembali tersedia untuk pasien lain. Pembatalan tidak bisa diurungkan.
            </DialogDescription>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Tidak jadi</DialogClose>
              <Button variant="destructive" onClick={batal} disabled={pending}>
                {pending && <Loader2Icon className="animate-spin" aria-hidden />}
                Ya, batalkan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : (
        statusMenunggu && (
          <p className="text-center text-xs text-muted-foreground">Pembatalan hanya bisa sampai 1 jam sebelum sesi dimulai.</p>
        )
      )}
    </div>
  );
}
