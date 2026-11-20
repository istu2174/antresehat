"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2Icon, ScanLineIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { checkIn } from "@/lib/actions/resepsionis";

/** Check-in: ketik kode tiket atau scan QR dari kamera (PRD 5.3). */
export function CheckInPanel() {
  const [kode, setKode] = useState("");
  const [scan, setScan] = useState(false);
  const [pending, start] = useTransition();

  function kirim(k: string) {
    start(async () => {
      const r = await checkIn(k);
      if (r.error) toast.error(r.error);
      else {
        toast.success(r.pesan);
        setKode("");
      }
    });
  }

  return (
    <section aria-labelledby="checkin-title" className="neu-raised rounded-3xl p-5">
      <h2 id="checkin-title" className="font-semibold tracking-tight">Check-in pasien</h2>
      <form
        className="mt-3 grid gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          kirim(kode);
        }}
      >
        <label htmlFor="kode-tiket" className="text-xs text-muted-foreground">Kode tiket</label>
        <div className="flex gap-2">
          <Input
            id="kode-tiket"
            value={kode}
            onChange={(e) => setKode(e.target.value.toUpperCase())}
            placeholder="mis. 7KQ2MX9A"
            autoComplete="off"
            spellCheck={false}
            className="font-mono uppercase placeholder:font-sans placeholder:normal-case"
          />
          <Button type="submit" disabled={pending || kode.trim().length < 6}>
            {pending && <Loader2Icon className="animate-spin" aria-hidden />}
            Check-in
          </Button>
        </div>
      </form>
      <Button variant="outline" className="mt-3 w-full" onClick={() => setScan(true)}>
        <ScanLineIcon aria-hidden />
        Scan QR dari kamera
      </Button>

      <Dialog open={scan} onOpenChange={setScan}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Scan QR tiket</DialogTitle>
            <DialogDescription>Arahkan QR di tiket pasien ke kamera.</DialogDescription>
          </DialogHeader>
          {scan && (
            <Pemindai
              onHasil={(k) => {
                setScan(false);
                kirim(k);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Pemindai({ onHasil }: { onHasil: (kode: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const selesai = useRef(false);
  // Simpan callback di ref: dashboard sering re-render (realtime) dan kamera jangan ikut restart.
  const hasilRef = useRef(onHasil);
  hasilRef.current = onHasil;

  useEffect(() => {
    let stop: (() => void) | undefined;
    let batal = false;
    (async () => {
      try {
        // Muat zxing hanya saat dialog dibuka supaya bundle dashboard tetap ringan.
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        if (batal || !video.current) return;
        const controls = await new BrowserQRCodeReader().decodeFromVideoDevice(undefined, video.current, (res) => {
          if (!res || selesai.current) return;
          selesai.current = true;
          controls.stop();
          hasilRef.current(res.getText().trim().toUpperCase());
        });
        stop = () => controls.stop();
        if (batal) stop();
      } catch {
        setError("Kamera tidak bisa dibuka. Izinkan akses kamera, atau ketik kode tiket secara manual.");
      }
    })();
    return () => {
      batal = true;
      stop?.();
    };
  }, []);

  if (error) return <p role="alert" className="neu-inset rounded-xl px-4 py-3 text-sm text-destructive">{error}</p>;
  return (
    <div className="neu-inset overflow-hidden rounded-2xl">
      <video ref={video} className="aspect-square w-full object-cover" muted playsInline aria-label="Pratinjau kamera" />
    </div>
  );
}
