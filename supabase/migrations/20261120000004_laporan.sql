-- Laporan admin (PRD 5.5, Prompt 11). Semua agregasi dihitung di database supaya
-- layar, .xlsx, dan .csv memakai angka yang sama persis (dibulatkan di sini, 1 desimal).
--
-- Definisi:
--   kunjungan     = antrean berstatus 'selesai'
--   tidak datang  = status 'tidak_datang'; persen dari semua antrean yang tidak dibatalkan
--   waktu tunggu  = waktu_dipanggil − (waktu_checkin, atau waktu_booking kalau tanpa check-in)
--   durasi periksa= waktu_selesai − waktu_mulai (antrean selesai)
--   jam tersibuk  = jam (WIB) pasien datang: waktu_checkin, atau waktu_dipanggil

create function public.laporan(
  p_dari date,
  p_sampai date,
  p_poli_id uuid default null,
  p_dokter_id uuid default null
) returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare
  v jsonb;
begin
  if public.app_role() is distinct from 'admin' then
    raise exception 'HANYA_ADMIN' using errcode = '42501';
  end if;
  if p_sampai < p_dari or p_sampai - p_dari > 366 then
    raise exception 'RENTANG_TIDAK_VALID';
  end if;

  with a as (
    select x.*,
      extract(epoch from x.waktu_dipanggil - coalesce(x.waktu_checkin, x.waktu_booking)) / 60 as tunggu,
      extract(epoch from x.waktu_selesai - x.waktu_mulai) / 60 as periksa,
      coalesce(x.waktu_checkin, x.waktu_dipanggil) at time zone 'Asia/Jakarta' as datang
    from public.antrean x
    where x.tanggal between p_dari and p_sampai
      and x.status <> 'batal'
      and (p_poli_id is null or x.poli_id = p_poli_id)
      and (p_dokter_id is null or x.dokter_id = p_dokter_id)
  )
  select jsonb_build_object(
    'ringkasan', (
      select jsonb_build_object(
        'total_antrean', count(*),
        'kunjungan', count(*) filter (where status = 'selesai'),
        'tidak_datang', count(*) filter (where status = 'tidak_datang'),
        'persen_tidak_datang', coalesce(round(100.0 * count(*) filter (where status = 'tidak_datang') / nullif(count(*), 0), 1), 0),
        'rata_tunggu_menit', round(avg(tunggu) filter (where tunggu >= 0)::numeric, 1),
        'rata_periksa_menit', round(avg(periksa) filter (where status = 'selesai' and periksa >= 0)::numeric, 1)
      ) from a
    ),
    'per_hari', coalesce((
      select jsonb_agg(jsonb_build_object('tanggal', d::date, 'kunjungan', coalesce(h.kunjungan, 0)) order by d)
      from generate_series(p_dari, p_sampai, interval '1 day') d
      left join (
        select tanggal, count(*) filter (where status = 'selesai') as kunjungan from a group by tanggal
      ) h on h.tanggal = d::date
    ), '[]'),
    'per_poli', coalesce((
      select jsonb_agg(jsonb_build_object('poli', p.nama, 'kunjungan', s.kunjungan) order by s.kunjungan desc, p.nama)
      from (select poli_id, count(*) filter (where status = 'selesai') as kunjungan from a group by poli_id) s
      join public.polis p on p.id = s.poli_id
    ), '[]'),
    'heatmap', coalesce((
      select jsonb_agg(jsonb_build_object('hari', hari, 'jam', jam, 'jumlah', jumlah) order by hari, jam)
      from (
        select extract(dow from tanggal)::int as hari, extract(hour from datang)::int as jam, count(*) as jumlah
        from a where datang is not null group by 1, 2
      ) hm
    ), '[]'),
    'detail', coalesce((
      select jsonb_agg(jsonb_build_object(
        'tanggal', s.tanggal, 'poli', p.nama, 'dokter', d.nama,
        'antrean', s.antrean, 'kunjungan', s.kunjungan, 'tidak_datang', s.tidak_datang,
        'rata_tunggu_menit', s.rata_tunggu, 'rata_periksa_menit', s.rata_periksa
      ) order by s.tanggal desc, p.nama, d.nama)
      from (
        select tanggal, poli_id, dokter_id,
          count(*) as antrean,
          count(*) filter (where status = 'selesai') as kunjungan,
          count(*) filter (where status = 'tidak_datang') as tidak_datang,
          round(avg(tunggu) filter (where tunggu >= 0)::numeric, 1) as rata_tunggu,
          round(avg(periksa) filter (where status = 'selesai' and periksa >= 0)::numeric, 1) as rata_periksa
        from a group by tanggal, poli_id, dokter_id
      ) s
      join public.polis p on p.id = s.poli_id
      join public.dokters d on d.id = s.dokter_id
    ), '[]')
  ) into v;
  return v;
end;
$$;

revoke execute on function public.laporan(date, date, uuid, uuid) from public, anon;
grant execute on function public.laporan(date, date, uuid, uuid) to authenticated;
