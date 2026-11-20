// AntreSehat tidak memakai service worker. File ini hanya "penghapus": browser yang masih
// menyimpan service worker lama dari app lain di localhost:3000 akan mengambil file ini saat
// cek update, lalu service worker lama itu membersihkan cache-nya dan berhenti.
// shortcut: hapus/ganti file ini kalau nanti AntreSehat butuh service worker sendiri.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) await caches.delete(key);
      await self.registration.unregister();
      for (const client of await self.clients.matchAll({ type: "window" })) client.navigate(client.url);
    })(),
  );
});
