"use client";

import { useEffect, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { applyChange, PUBLIC_COLUMNS, type PublicAntrean } from "@/lib/antrean-live";
import { createClient } from "@/lib/supabase/client";
import { createPublicClient } from "@/lib/supabase/public";

export type AntreanFilter = { tanggal: string; jadwal_id?: string; poli_id?: string; dokter_id?: string };
export type LiveStatus = "connecting" | "live" | "offline";

type Options<T> = {
  /** Kolom yang dibaca. Default: kolom publik (anon). */
  select?: string;
  /** true = pakai session user (staf butuh kolom pasien); false = anon. */
  auth?: boolean;
  /** Data awal dari server supaya tidak berkedip kosong. */
  initial?: T[];
};

/**
 * Antrean satu tanggal yang selalu sinkron dengan database lewat Supabase Realtime.
 * - Data awal diambil sekali, lalu setiap INSERT/UPDATE/DELETE diterapkan ke state lokal.
 * - Kalau channel putus/error, berlangganan ulang dengan jeda bertahap (1s, 2s, 4s … maks 30s)
 *   dan mengambil ulang data supaya event yang terlewat tidak hilang.
 * - Ambil ulang juga saat tab kembali terlihat atau koneksi internet pulih.
 */
export function useAntreanRealtime<T extends { id: string; tanggal: string } = PublicAntrean>(
  filter: AntreanFilter,
  { select = PUBLIC_COLUMNS, auth = false, initial = [] }: Options<T> = {},
) {
  const [rows, setRows] = useState<T[]>(initial);
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const { tanggal, jadwal_id, poli_id, dokter_id } = filter;

  useEffect(() => {
    const db = auth ? createClient() : createPublicClient();
    if (!db) {
      setStatus("offline");
      return;
    }

    // Realtime hanya mendukung satu filter kolom; tanggal disaring di sisi klien (dan oleh RLS untuk anon).
    const [col, val] = ([["jadwal_id", jadwal_id], ["poli_id", poli_id], ["dokter_id", dokter_id]] as const).find(([, v]) => v) ?? [];

    let stopped = false;
    let channel: RealtimeChannel | null = null;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function refetch() {
      let q = db!.from("antrean").select(select).eq("tanggal", tanggal);
      if (col && val) q = q.eq(col, val);
      const { data, error } = await q;
      if (!error && !stopped) setRows(data as unknown as T[]);
    }

    function subscribe() {
      const ch = db!
        .channel(`antrean:${tanggal}:${col ?? "semua"}:${val ?? ""}:${Math.random().toString(36).slice(2)}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "antrean", ...(col && val ? { filter: `${col}=eq.${val}` } : {}) },
          (payload) => {
            setRows((prev) => applyChange(prev, payload as never, tanggal));
            // Baris baru tidak membawa relasi (nama pasien dsb.) → ambil ulang sekali.
            if (payload.eventType === "INSERT" && select.includes("(")) refetch();
          },
        )
        .subscribe((s) => {
          if (stopped || ch !== channel) return; // callback dari channel lama
          if (s === "SUBSCRIBED") {
            retry = 0;
            setStatus("live");
            refetch();
          } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
            setStatus("offline");
            channel = null;
            db!.removeChannel(ch);
            timer = setTimeout(subscribe, Math.min(30_000, 1000 * 2 ** retry++));
          }
        });
      channel = ch;
    }

    subscribe();

    const wake = () => {
      if (document.visibilityState === "visible") refetch();
    };
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", wake);

    return () => {
      stopped = true;
      clearTimeout(timer);
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", wake);
      if (channel) db.removeChannel(channel);
    };
  }, [tanggal, jadwal_id, poli_id, dokter_id, select, auth]);

  return { rows, status };
}
