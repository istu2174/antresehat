-- AntreSehat — aturan bisnis 7: booking yang belum check-in sampai 15 menit setelah estimasinya
-- otomatis TIDAK DATANG. Kuota otomatis kembali karena ambil_nomor_antrean() & kuota_terpakai()
-- tidak menghitung status tidak_datang.

create extension if not exists pg_cron;

create function public.tandai_tidak_datang() returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_jumlah int;
begin
  with ditandai as (
    update public.antrean a
       set status = 'tidak_datang'
     where a.status = 'menunggu'
       and a.waktu_checkin is null
       and a.estimasi_jam + interval '15 minutes' < now()
    returning a.id, a.nomor_label, a.estimasi_jam
  ), dicatat as (
    -- actor_id null = dilakukan sistem.
    insert into public.audit_log (actor_id, aksi, entitas, entitas_id, data)
    select null, 'tidak_datang_otomatis', 'antrean', d.id::text,
           jsonb_build_object('nomor', d.nomor_label, 'estimasi', d.estimasi_jam)
      from ditandai d
    returning 1
  )
  select count(*) into v_jumlah from dicatat;
  return v_jumlah;
end $$;

-- Hanya dijalankan oleh pg_cron (role postgres), tidak bisa dipanggil dari API.
revoke execute on function public.tandai_tidak_datang() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'antresehat-tidak-datang';
select cron.schedule('antresehat-tidak-datang', '* * * * *', 'select public.tandai_tidak_datang()');
