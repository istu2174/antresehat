-- AntreSehat — Row Level Security (PRD bagian 4, aturan 9, NFR keamanan)
-- Prinsip: anon hanya membaca data publik; pasien hanya datanya sendiri;
-- staf sesuai perannya. Menulis antrean baru hanya lewat ambil_nomor_antrean().

alter table public.profiles       enable row level security;
alter table public.polis          enable row level security;
alter table public.dokters        enable row level security;
alter table public.jadwal_praktik enable row level security;
alter table public.libur          enable row level security;
alter table public.antrean        enable row level security;
alter table public.kunjungan      enable row level security;
alter table public.audit_log      enable row level security;

-- Anon tidak pernah menulis apa pun.
revoke insert, update, delete, truncate on all tables in schema public from anon;

-- ───────────── profiles ─────────────
create policy "profil: diri sendiri atau staf" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.app_role() in ('resepsionis', 'dokter', 'admin'));

create policy "profil: ubah diri sendiri / admin" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or public.app_role() = 'admin')
  with check (id = (select auth.uid()) or public.app_role() = 'admin');

-- Kolom role & NIK tidak bisa diubah langsung dari klien (role lewat service role, NIK lewat set_nik).
revoke insert, update, delete on public.profiles from authenticated;
grant update (nama, no_hp, tgl_lahir, jenis_kelamin) on public.profiles to authenticated;
revoke select on public.profiles from anon;

-- ───────────── master data: publik baca, admin tulis ─────────────
create policy "poli: publik" on public.polis for select to anon, authenticated using (true);
create policy "poli: admin" on public.polis for all to authenticated
  using (public.app_role() = 'admin') with check (public.app_role() = 'admin');

create policy "dokter: publik" on public.dokters for select to anon, authenticated using (true);
create policy "dokter: admin" on public.dokters for all to authenticated
  using (public.app_role() = 'admin') with check (public.app_role() = 'admin');

create policy "jadwal: publik" on public.jadwal_praktik for select to anon, authenticated using (true);
create policy "jadwal: admin" on public.jadwal_praktik for all to authenticated
  using (public.app_role() = 'admin') with check (public.app_role() = 'admin');

create policy "libur: publik" on public.libur for select to anon, authenticated using (true);
create policy "libur: admin" on public.libur for all to authenticated
  using (public.app_role() = 'admin') with check (public.app_role() = 'admin');

-- ───────────── antrean ─────────────
-- Publik (landing, /display, posisi di tiket) membaca antrean HARI INI sebagai anon,
-- dan hanya kolom yang tidak menunjuk ke pasien (tanpa pasien_id & kode_tiket).
revoke select on public.antrean from anon;
grant select (id, tanggal, poli_id, dokter_id, jadwal_id, nomor, nomor_label, sumber, status,
              urutan, jumlah_dilewati, estimasi_jam, waktu_dipanggil, waktu_mulai, waktu_selesai)
  on public.antrean to anon;

create policy "antrean: publik hari ini" on public.antrean
  for select to anon
  using (tanggal = public.hari_ini_wib());

create policy "antrean: pasien miliknya, staf sesuai peran" on public.antrean
  for select to authenticated
  using (
    pasien_id = (select auth.uid())
    or public.app_role() in ('resepsionis', 'admin')
    or (public.app_role() = 'dokter' and dokter_id = public.my_dokter_id())
  );

-- Insert hanya lewat ambil_nomor_antrean() (security definer) → tidak ada policy insert.
create policy "antrean: resepsionis/admin ubah" on public.antrean
  for update to authenticated
  using (public.app_role() in ('resepsionis', 'admin'))
  with check (public.app_role() in ('resepsionis', 'admin'));

create policy "antrean: dokter ubah pasiennya" on public.antrean
  for update to authenticated
  using (public.app_role() = 'dokter' and dokter_id = public.my_dokter_id())
  with check (public.app_role() = 'dokter' and dokter_id = public.my_dokter_id());

-- ───────────── kunjungan (catatan medis — aturan 9) ─────────────
create policy "kunjungan: dokter, admin, pasien pemilik" on public.kunjungan
  for select to authenticated
  using (
    pasien_id = (select auth.uid())
    or public.app_role() in ('dokter', 'admin')
  );

-- Dokter hanya menulis catatan untuk pasien di antreannya sendiri.
create policy "kunjungan: dokter tulis untuk antreannya" on public.kunjungan
  for insert to authenticated
  with check (
    public.app_role() = 'dokter'
    and dokter_id = public.my_dokter_id()
    and exists (select 1 from public.antrean a
                where a.id = antrean_id
                  and a.dokter_id = public.my_dokter_id()
                  and a.pasien_id = kunjungan.pasien_id)
  );

create policy "kunjungan: dokter ubah catatannya" on public.kunjungan
  for update to authenticated
  using (public.app_role() = 'dokter' and dokter_id = public.my_dokter_id())
  with check (public.app_role() = 'dokter' and dokter_id = public.my_dokter_id());

revoke select on public.kunjungan from anon;

-- ───────────── audit_log ─────────────
create policy "audit: admin baca" on public.audit_log
  for select to authenticated
  using (public.app_role() = 'admin');

create policy "audit: staf tulis atas namanya" on public.audit_log
  for insert to authenticated
  with check (actor_id = (select auth.uid()) and public.app_role() in ('resepsionis', 'dokter', 'admin'));

revoke update, delete on public.audit_log from authenticated;
revoke select on public.audit_log from anon;

-- ───────────── Fungsi: siapa yang boleh memanggil ─────────────
revoke execute on function public.ambil_nomor_antrean(uuid, date, uuid, public.sumber_antrean) from public, anon;
grant execute on function public.ambil_nomor_antrean(uuid, date, uuid, public.sumber_antrean) to authenticated;
revoke execute on function public.set_nik(uuid, text) from public, anon;
grant execute on function public.set_nik(uuid, text) to authenticated, service_role;
revoke execute on function public.nik_tersamar(uuid) from public, anon;
grant execute on function public.nik_tersamar(uuid) to authenticated, service_role;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ───────────── Realtime ─────────────
-- Realtime mengikuti RLS & hak kolom di atas: anon hanya menerima kolom publik antrean hari ini.
alter publication supabase_realtime add table public.antrean;
