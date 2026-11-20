import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AntreSehat — Antrean Klinik",
    short_name: "AntreSehat",
    description: "Booking dan antrean klinik online yang realtime.",
    lang: "id",
    start_url: "/",
    display: "standalone",
    background_color: "#eceef1",
    theme_color: "#eceef1",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
