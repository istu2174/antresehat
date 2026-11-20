"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Volume2Icon } from "lucide-react";
import { useAntreanRealtime } from "@/hooks/use-antrean-realtime";
import { sedangDilayani, type PublicAntrean } from "@/lib/antrean-live";
import { kalimatPanggilan } from "@/lib/panggilan";
import { TZ, todayWib } from "@/lib/time";
import { cn } from "@/lib/utils";

type Poli = { id: string; nama: string; warna: string };
type Panggilan = { id: string; poliId: string; teks: string };

const KLINIK = "Klinik AntreSehat";

/** Bel dua nada (ding-dong) via Web Audio — tanpa file audio. */
function bel(ctx: AudioContext): Promise<void> {
  const t = ctx.currentTime;
  [659.25, 523.25].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t + i * 0.45);
    gain.gain.exponentialRampToValueAtTime(0.4, t + i * 0.45 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.45 + 0.9);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t + i * 0.45);
    osc.stop(t + i * 0.45 + 0.95);
  });
  return new Promise((r) => setTimeout(r, 1400));
}

function ucapkan(teks: string): Promise<void> {
  return new Promise((selesai) => {
    if (!("speechSynthesis" in window)) return selesai();
    const u = new SpeechSynthesisUtterance(teks);
    u.lang = "id-ID";
    u.rate = 0.9;
    const suara = speechSynthesis.getVoices().find((v) => v.lang.replace("_", "-").startsWith("id"));
    if (suara) u.voice = suara;
    // Chrome kadang tidak memanggil onend → batas waktu supaya antrean pengumuman tidak macet.
    const batas = setTimeout(selesai, 12_000);
    u.onend = u.onerror = () => {
      clearTimeout(batas);
      selesai();
    };
    speechSynthesis.speak(u);
  });
}

function useJam() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function DisplayBoard({
  tanggal,
  polis,
  dokters,
  initial,
}: {
  tanggal: string;
  polis: Poli[];
  dokters: { id: string; nama: string }[];
  initial: PublicAntrean[];
}) {
  const { rows, status } = useAntreanRealtime({ tanggal }, { initial });
  const now = useJam();
  const [suaraAktif, setSuaraAktif] = useState(false);
  const [kedip, setKedip] = useState<string | null>(null);

  const audio = useRef<AudioContext | null>(null);
  const antre = useRef<Panggilan[]>([]);
  const berjalan = useRef(false);
  // id → waktu_dipanggil yang sudah diumumkan. Panggil ulang mengubah waktu_dipanggil → diumumkan lagi.
  const terlihat = useRef<Map<string, string> | null>(null);

  const poliById = useMemo(() => new Map(polis.map((p) => [p.id, p])), [polis]);
  const dokterById = useMemo(() => new Map(dokters.map((d) => [d.id, d.nama])), [dokters]);

  async function prosesAntrean() {
    if (berjalan.current) return;
    berjalan.current = true;
    while (antre.current.length) {
      const p = antre.current.shift()!;
      setKedip(p.poliId);
      if (audio.current) {
        await bel(audio.current);
        await ucapkan(p.teks);
      } else {
        await new Promise((r) => setTimeout(r, 4000));
      }
    }
    setKedip(null);
    berjalan.current = false;
  }

  // Deteksi panggilan baru dari perubahan realtime.
  useEffect(() => {
    const sudah = terlihat.current;
    const dipanggil = rows.filter((r) => r.status === "dipanggil" && r.waktu_dipanggil);
    if (!sudah) {
      // Muat pertama: catat yang sudah dipanggil tanpa mengumumkannya.
      terlihat.current = new Map(dipanggil.map((r) => [r.id, r.waktu_dipanggil!]));
      return;
    }
    const baru = dipanggil
      .filter((r) => sudah.get(r.id) !== r.waktu_dipanggil)
      .sort((a, b) => a.waktu_dipanggil!.localeCompare(b.waktu_dipanggil!));
    if (!baru.length) return;
    for (const r of baru) {
      sudah.set(r.id, r.waktu_dipanggil!);
      antre.current.push({ id: r.id, poliId: r.poli_id, teks: kalimatPanggilan(r.nomor_label, poliById.get(r.poli_id)?.nama ?? "poli") });
    }
    prosesAntrean();
  }, [rows, poliById]);

  // TV menyala semalaman: muat ulang saat tanggal WIB berganti.
  useEffect(() => {
    if (now && todayWib(now) !== tanggal) window.location.reload();
  }, [now, tanggal]);

  function aktifkan() {
    // Browser hanya mengizinkan audio setelah interaksi pengguna — buka kuncinya di klik ini.
    audio.current ??= new AudioContext();
    audio.current.resume();
    if ("speechSynthesis" in window) speechSynthesis.speak(new SpeechSynthesisUtterance(""));
    document.documentElement.requestFullscreen?.().catch(() => {});
    setSuaraAktif(true);
  }

  const terakhir = rows
    .filter((r) => r.waktu_dipanggil && r.status !== "batal")
    .sort((a, b) => b.waktu_dipanggil!.localeCompare(a.waktu_dipanggil!))
    .slice(0, 5);

  return (
    // Menutupi header/footer situs: layar TV fullscreen tanpa scroll.
    <div className="fixed inset-0 z-50 grid grid-rows-[auto_1fr] gap-[2vh] overflow-hidden bg-background p-[2.5vh_2.5vw]">
      <header className="neu-raised flex items-center justify-between gap-6 rounded-3xl px-[2vw] py-[1.6vh]">
        <div className="flex items-center gap-4">
          <span className="neu-ink grid size-[6vh] place-items-center rounded-2xl text-[2.4vh] font-semibold">01</span>
          <div>
            <p className="text-[3.4vh] leading-tight font-semibold tracking-tight">{KLINIK}</p>
            <p className="text-[1.9vh] text-muted-foreground">Layar antrean ruang tunggu</p>
          </div>
        </div>
        <div className="text-right" aria-live="off">
          <p className="text-[4.6vh] leading-none font-semibold tabular-nums tracking-tight">
            {now ? new Intl.DateTimeFormat("id-ID", { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(now) : "--.--.--"}
          </p>
          <p className="mt-1 text-[1.9vh] text-muted-foreground">
            {now ? new Intl.DateTimeFormat("id-ID", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now) : ""}
          </p>
        </div>
      </header>

      <div className="grid min-h-0 grid-cols-[1fr_minmax(16rem,26vw)] gap-[2vw]">
        {/* Kartu per poli */}
        <section
          aria-label="Nomor yang sedang dipanggil"
          className="grid min-h-0 gap-[2vw]"
          style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(polis.length, 1), 3)}, minmax(0, 1fr))` }}
        >
          {polis.length === 0 && (
            <p className="neu-inset grid place-items-center rounded-3xl text-[3vh] text-muted-foreground">Data poli belum tersedia.</p>
          )}
          {polis.map((p) => {
            const aktif = sedangDilayani(rows.filter((r) => r.poli_id === p.id));
            return (
              <article
                key={p.id}
                className={cn(
                  "neu-raised relative flex min-h-0 flex-col items-center justify-center overflow-hidden rounded-[2rem] p-[2vh] text-center",
                  kedip === p.id && "display-kedip",
                )}
              >
                <span aria-hidden className="absolute inset-x-[30%] top-0 h-[0.6vh] rounded-b-full" style={{ backgroundColor: p.warna }} />
                <h2 className="text-[4vh] font-semibold tracking-tight">{p.nama}</h2>
                <p className="mt-[3vh] text-[2vh] tracking-[0.2em] text-muted-foreground uppercase">Nomor dipanggil</p>
                <p
                  className={cn(
                    "mt-[1.5vh] rounded-[1.5rem] px-[1.5vw] py-[1vh] text-[clamp(2.5rem,min(15vh,5.4vw),11rem)] leading-none font-bold whitespace-nowrap tabular-nums tracking-tight",
                    aktif ? "neu-ink" : "text-muted-foreground",
                  )}
                >
                  {aktif?.nomor_label ?? "—"}
                </p>
                <p className="mt-[3vh] min-h-[3.4vh] text-[3vh] font-medium">{aktif ? dokterById.get(aktif.dokter_id) : "Belum ada panggilan"}</p>
              </article>
            );
          })}
        </section>

        {/* 5 panggilan terakhir */}
        <aside aria-labelledby="terakhir-title" className="neu-raised flex min-h-0 flex-col rounded-[2rem] p-[2.5vh]">
          <h2 id="terakhir-title" className="text-[2.6vh] font-semibold tracking-tight">Panggilan terakhir</h2>
          <ol className="mt-[2vh] grid flex-1 content-start gap-[1.4vh]">
            {terakhir.length === 0 && <li className="text-[2.2vh] text-muted-foreground">Belum ada panggilan hari ini.</li>}
            {terakhir.map((r, i) => {
              const poli = poliById.get(r.poli_id);
              return (
                <li key={r.id} className={cn("flex items-center justify-between gap-3 rounded-2xl px-[1.2vw] py-[1.4vh]", i === 0 ? "neu-inset" : "")}>
                  <span className="flex min-w-0 items-center gap-3">
                    <span aria-hidden className="h-[3.6vh] w-1 shrink-0 rounded-full" style={{ backgroundColor: poli?.warna }} />
                    <span className="min-w-0">
                      <span className="block text-[4vh] leading-none font-bold tabular-nums">{r.nomor_label}</span>
                      <span className="block truncate text-[1.8vh] text-muted-foreground">{poli?.nama}</span>
                    </span>
                  </span>
                  <span className="text-[2vh] text-muted-foreground tabular-nums">
                    {new Intl.DateTimeFormat("id-ID", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(r.waktu_dipanggil!))}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="mt-[1.5vh] flex items-center gap-2 text-[1.6vh] text-muted-foreground">
            <span
              aria-hidden
              className={cn("size-2 rounded-full", status === "live" ? "bg-emerald-600" : status === "offline" ? "bg-destructive" : "bg-muted-foreground")}
            />
            {status === "live" ? "Tersambung" : status === "offline" ? "Terputus, mencoba lagi…" : "Menyambungkan…"}
          </p>
        </aside>
      </div>

      {/* Pengumuman untuk pembaca layar (suara TV tetap lewat speechSynthesis). */}
      <p className="sr-only" aria-live="assertive">
        {terakhir[0] && terakhir[0].status === "dipanggil" ? kalimatPanggilan(terakhir[0].nomor_label, poliById.get(terakhir[0].poli_id)?.nama ?? "") : ""}
      </p>

      {!suaraAktif && (
        <div className="absolute inset-0 grid place-items-center bg-background/70 backdrop-blur-sm">
          <div className="neu-raised max-w-md rounded-3xl p-8 text-center">
            <p className="text-xl font-semibold tracking-tight">Aktifkan suara panggilan</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Browser butuh satu klik sebelum boleh memutar bel dan suara. Layar juga akan masuk mode layar penuh.
            </p>
            <button
              type="button"
              autoFocus
              onClick={aktifkan}
              className="neu-ink mt-6 inline-flex h-12 items-center gap-2 rounded-xl px-6 font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              <Volume2Icon className="size-5" aria-hidden />
              Aktifkan suara
            </button>
            <button
              type="button"
              onClick={() => setSuaraAktif(true)}
              className="mt-3 block w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Lanjut tanpa suara
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
