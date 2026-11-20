-- AntreSehat — skema inti (PRD bagian 6 & 9)
-- Semua tanggal "hari ini" dihitung di Asia/Jakarta.

create extension if not exists pgcrypto with schema extensions;

-- ───────────── Enum ─────────────
create type public.user_role as enum ('pasien', 'resepsionis', 'dokter', 'admin');
create type public.jenis_kelamin as enum ('L', 'P');
create type public.sumber_antrean as enum ('booking', 'walkin');
create type public.status_antrean as enum (
  'menunggu', 'check_in', 'dipanggil', 'diperiksa', 'selesai', 'dilewati', 'batal', 'tidak_datang'
);

-- ───────────── Tabel ─────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'pasien',
  nama text not null,
  no_hp text,
  tgl_lahir date,
  jenis_kelamin public.jenis_kelamin,
  nik_terenkripsi bytea, -- diisi lewat fungsi set_nik(), dibaca lewat nik_tersamar()
  created_at timestamptz not null default now()
);

create table public.polis (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  kode_prefix text not null unique check (kode_prefix ~ '^[A-Z]{1,2}$'),
  warna text not null default '#16181b' check (warna ~ '^#[0-9a-fA-F]{6}$'),
  aktif boolean not null default true
);

create table public.dokters (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles (id) on delete set null,
  poli_id uuid not null references public.polis (id),
  nama text not null,
  spesialis text not null,
  foto_url text,
  aktif boolean not null default true
);

create table public.jadwal_praktik (
  id uuid primary key default gen_random_uuid(),
  dokter_id uuid not null references public.dokters (id) on delete cascade,
  hari smallint not null check (hari between 0 and 6), -- 0 = Minggu (sama dengan extract(dow))
  jam_mulai time not null,
  jam_selesai time not null,
  kuota int not null check (kuota > 0),
  menit_per_pasien int not null check (menit_per_pasien > 0),
  -- Jadwal yang dihapus admin dinonaktifkan saja karena antrean lama merujuk ke sini.
  aktif boolean not null default true,
  check (jam_selesai > jam_mulai)
);

create table public.libur (
  id uuid primary key default gen_random_uuid(),
  tanggal date not null,
  dokter_id uuid references public.dokters (id) on delete cascade, -- null = klinik libur
  keterangan text not null default '',
  unique nulls not distinct (tanggal, dokter_id)
);

create table public.antrean (
  id uuid primary key default gen_random_uuid(),
  kode_tiket text not null unique,
  tanggal date not null,
  poli_id uuid not null references public.polis (id),
  dokter_id uuid not null references public.dokters (id),
  jadwal_id uuid not null references public.jadwal_praktik (id),
  pasien_id uuid not null references public.profiles (id) on delete cascade,
  nomor int not null check (nomor > 0),
  nomor_label text not null,
  sumber public.sumber_antrean not null default 'booking',
  status public.status_antrean not null default 'menunggu',
  -- Kunci urutan panggilan. Awalnya = nomor; aksi "Lewati" (aturan 6) menggesernya.
  urutan numeric not null,
  jumlah_dilewati int not null default 0,
  estimasi_jam timestamptz,
  waktu_booking timestamptz not null default now(),
  waktu_checkin timestamptz,
  waktu_dipanggil timestamptz,
  waktu_mulai timestamptz,
  waktu_selesai timestamptz,
  unique (tanggal, poli_id, nomor)
);

-- Aturan 3: 1 booking aktif per pasien per poli per hari.
create unique index antrean_satu_aktif_per_poli
  on public.antrean (tanggal, poli_id, pasien_id)
  where status in ('menunggu', 'check_in', 'dipanggil', 'diperiksa', 'dilewati');

create index antrean_tanggal_jadwal on public.antrean (tanggal, jadwal_id);
create index antrean_pasien on public.antrean (pasien_id);

create table public.kunjungan (
  id uuid primary key default gen_random_uuid(),
  antrean_id uuid not null unique references public.antrean (id) on delete cascade,
  dokter_id uuid not null references public.dokters (id),
  pasien_id uuid not null references public.profiles (id) on delete cascade,
  keluhan text not null default '',
  tensi text check (tensi ~ '^\d{2,3}/\d{2,3}$'),
  suhu numeric(4, 1) check (suhu between 30 and 45),
  berat numeric(5, 1) check (berat between 0 and 300),
  diagnosis text not null default '',
  icd10 text,
  tindakan text not null default '',
  resep text not null default '',
  saran text not null default '',
  created_at timestamptz not null default now()
);

create index kunjungan_pasien on public.kunjungan (pasien_id);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  aksi text not null,
  entitas text not null,
  entitas_id text,
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index audit_log_created on public.audit_log (created_at desc);

-- ───────────── Helper ─────────────
create function public.hari_ini_wib() returns date
language sql stable set search_path = ''
as $$ select (now() at time zone 'Asia/Jakarta')::date $$;

-- security definer supaya bisa dipakai di policy tanpa rekursi RLS profiles.
create function public.app_role() returns public.user_role
language sql stable security definer set search_path = ''
as $$ select role from public.profiles where id = (select auth.uid()) $$;

create function public.my_dokter_id() returns uuid
language sql stable security definer set search_path = ''
as $$ select id from public.dokters where profile_id = (select auth.uid()) $$;

-- ───────────── Profil otomatis saat daftar ─────────────
-- Role selalu 'pasien'; metadata dari klien tidak dipercaya untuk role.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, nama)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'nama'), ''), split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────── NIK terenkripsi ─────────────
-- Kunci dibuat sekali per database dan tidak pernah keluar dari Postgres.
create schema if not exists private;
revoke all on schema private from public;

create table private.kunci (
  id int primary key default 1 check (id = 1),
  nik_key text not null
);
alter table private.kunci enable row level security; -- tanpa policy: hanya fungsi security definer yang membaca
insert into private.kunci (nik_key) values (encode(extensions.gen_random_bytes(32), 'hex'));

create function public.set_nik(p_profile_id uuid, p_nik text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_key text;
begin
  if not (p_profile_id = auth.uid()
          or public.app_role() in ('resepsionis', 'admin')
          or auth.role() = 'service_role') then
    raise exception 'AKSES_DITOLAK';
  end if;

  if nullif(p_nik, '') is null then
    update public.profiles set nik_terenkripsi = null where id = p_profile_id;
    return;
  end if;

  if p_nik !~ '^\d{16}$' then
    raise exception 'NIK_TIDAK_VALID';
  end if;

  select nik_key into v_key from private.kunci;
  update public.profiles
    set nik_terenkripsi = extensions.pgp_sym_encrypt(p_nik, v_key)
    where id = p_profile_id;
end $$;

-- Mengembalikan NIK tersamar, mis. 3271********0001. Null kalau tidak berhak / kosong.
create function public.nik_tersamar(p_profile_id uuid) returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_nik text;
begin
  if not (p_profile_id = auth.uid()
          or public.app_role() in ('resepsionis', 'dokter', 'admin')
          or auth.role() = 'service_role') then
    return null;
  end if;

  select extensions.pgp_sym_decrypt(p.nik_terenkripsi, k.nik_key)
    into v_nik
    from public.profiles p, private.kunci k
    where p.id = p_profile_id;

  if v_nik is null then
    return null;
  end if;
  return left(v_nik, 4) || repeat('*', 8) || right(v_nik, 4);
end $$;

-- ───────────── Ambil nomor antrean ─────────────
-- Aturan 1–5. Lock advisory per (tanggal, poli) di dalam transaksi fungsi ini
-- menjamin dua booking bersamaan tidak pernah mendapat nomor yang sama.
-- Error dilempar sebagai kode (mis. KUOTA_HABIS) — klien yang menerjemahkan ke pesan ramah.
create function public.ambil_nomor_antrean(
  p_jadwal_id uuid,
  p_tanggal date,
  p_pasien_id uuid default null,
  p_sumber public.sumber_antrean default 'booking'
) returns public.antrean
language plpgsql security definer set search_path = ''
as $$
declare
  v_role public.user_role := public.app_role();
  v_pasien uuid;
  v_jadwal public.jadwal_praktik;
  v_poli public.polis;
  v_mulai timestamptz;
  v_selesai timestamptz;
  v_terisi int;
  v_nomor int;
  v_row public.antrean;
begin
  if auth.uid() is null or v_role is null then
    raise exception 'BELUM_MASUK';
  end if;

  -- Pasien hanya boleh booking untuk dirinya sendiri; walk-in hanya oleh resepsionis/admin.
  if v_role = 'pasien' then
    if p_sumber <> 'booking' or (p_pasien_id is not null and p_pasien_id <> auth.uid()) then
      raise exception 'AKSES_DITOLAK';
    end if;
    v_pasien := auth.uid();
  elsif v_role in ('resepsionis', 'admin') then
    if p_pasien_id is null then
      raise exception 'PASIEN_WAJIB';
    end if;
    v_pasien := p_pasien_id;
  else
    raise exception 'AKSES_DITOLAK';
  end if;

  select j.* into v_jadwal
    from public.jadwal_praktik j
    join public.dokters d on d.id = j.dokter_id and d.aktif
    where j.id = p_jadwal_id and j.aktif;
  if not found then
    raise exception 'JADWAL_TIDAK_ADA';
  end if;

  select p.* into v_poli
    from public.polis p join public.dokters d on d.poli_id = p.id
    where d.id = v_jadwal.dokter_id and p.aktif;
  if not found then
    raise exception 'JADWAL_TIDAK_ADA';
  end if;

  if extract(dow from p_tanggal) <> v_jadwal.hari then
    raise exception 'JADWAL_TIDAK_ADA';
  end if;

  -- Aturan 4: dibuka H-7.
  if p_tanggal < public.hari_ini_wib() or p_tanggal > public.hari_ini_wib() + 7 then
    raise exception 'TANGGAL_DI_LUAR_JANGKAUAN';
  end if;

  v_mulai := (p_tanggal + v_jadwal.jam_mulai) at time zone 'Asia/Jakarta';
  v_selesai := (p_tanggal + v_jadwal.jam_selesai) at time zone 'Asia/Jakarta';

  -- Aturan 4: booking ditutup 30 menit sebelum sesi berakhir; walk-in sampai sesi selesai.
  if (p_sumber = 'booking' and now() >= v_selesai - interval '30 minutes')
     or (p_sumber = 'walkin' and now() >= v_selesai) then
    raise exception 'BOOKING_DITUTUP';
  end if;

  if exists (select 1 from public.libur l
             where l.tanggal = p_tanggal
               and (l.dokter_id is null or l.dokter_id = v_jadwal.dokter_id)) then
    raise exception 'LIBUR';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_tanggal::text || v_poli.id::text, 0));

  if exists (select 1 from public.antrean a
             where a.tanggal = p_tanggal and a.poli_id = v_poli.id and a.pasien_id = v_pasien
               and a.status in ('menunggu', 'check_in', 'dipanggil', 'diperiksa', 'dilewati')) then
    raise exception 'SUDAH_BOOKING';
  end if;

  -- Batal & tidak datang tidak memakan kuota (aturan 7).
  select count(*) into v_terisi
    from public.antrean a
    where a.tanggal = p_tanggal and a.jadwal_id = v_jadwal.id
      and a.status not in ('batal', 'tidak_datang');
  if v_terisi >= v_jadwal.kuota then
    raise exception 'KUOTA_HABIS';
  end if;

  select coalesce(max(a.nomor), 0) + 1 into v_nomor
    from public.antrean a
    where a.tanggal = p_tanggal and a.poli_id = v_poli.id;

  insert into public.antrean (
    kode_tiket, tanggal, poli_id, dokter_id, jadwal_id, pasien_id,
    nomor, nomor_label, sumber, status, urutan, estimasi_jam, waktu_checkin
  ) values (
    upper(encode(extensions.gen_random_bytes(5), 'hex')),
    p_tanggal, v_poli.id, v_jadwal.dokter_id, v_jadwal.id, v_pasien,
    v_nomor,
    v_poli.kode_prefix || '-' || lpad(v_nomor::text, greatest(3, length(v_nomor::text)), '0'),
    p_sumber,
    -- Walk-in sudah ada di klinik, jadi langsung check-in.
    (case when p_sumber = 'walkin' then 'check_in' else 'menunggu' end)::public.status_antrean,
    v_nomor,
    -- Aturan 5: jam mulai + posisi × menit per pasien (tidak lebih awal dari sekarang).
    greatest(now(), v_mulai + make_interval(mins => v_terisi * v_jadwal.menit_per_pasien)),
    case when p_sumber = 'walkin' then now() end
  )
  returning * into v_row;

  return v_row;
end $$;
