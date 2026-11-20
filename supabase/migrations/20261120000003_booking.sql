-- AntreSehat — RPC untuk wizard booking & pembatalan (PRD 5.2, aturan 4 & 7)

-- Jumlah slot terpakai per jadwal per tanggal. Pasien tidak bisa membaca antrean orang lain
-- (RLS), jadi sisa kuota dihitung di sini dan hanya angka agregat yang keluar.
create function public.kuota_terpakai(p_dari date, p_sampai date)
returns table (jadwal_id uuid, tanggal date, terisi int)
language sql stable security definer set search_path = ''
as $$
  select a.jadwal_id, a.tanggal, count(*)::int
  from public.antrean a
  where a.tanggal between p_dari and least(p_sampai, p_dari + 31)
    and a.status not in ('batal', 'tidak_datang')
  group by a.jadwal_id, a.tanggal
$$;

revoke execute on function public.kuota_terpakai(date, date) from public;
grant execute on function public.kuota_terpakai(date, date) to anon, authenticated;

-- Pasien membatalkan booking miliknya: hanya status MENUNGGU dan paling lambat 1 jam sebelum sesi.
create function public.batalkan_booking(p_kode text) returns public.antrean
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.antrean;
  v_mulai timestamptz;
begin
  select a.* into v_row
    from public.antrean a
    where a.kode_tiket = p_kode and a.pasien_id = auth.uid()
    for update;
  if not found then
    raise exception 'TIKET_TIDAK_ADA';
  end if;

  if v_row.status <> 'menunggu' then
    raise exception 'TIDAK_BISA_DIBATALKAN';
  end if;

  select (v_row.tanggal + j.jam_mulai) at time zone 'Asia/Jakarta' into v_mulai
    from public.jadwal_praktik j where j.id = v_row.jadwal_id;
  if now() > v_mulai - interval '1 hour' then
    raise exception 'BATAS_BATAL_LEWAT';
  end if;

  update public.antrean set status = 'batal' where id = v_row.id returning * into v_row;
  return v_row;
end $$;

revoke execute on function public.batalkan_booking(text) from public, anon;
grant execute on function public.batalkan_booking(text) to authenticated;
