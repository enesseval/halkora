-- ============================================================================
-- Halkora — @kullanıcıadı (handle) sistemi (Faz 3C madde 1)
-- SQL Editor'de baştan sona çalıştır. Idempotent (if not exists / create or
-- replace / drop-then-create for the constraint+trigger that need it).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Rezerve isimler — marka/karışıklık riski taşıyan handle'lar hiç kimseye
--    verilmez. Buraya yenisini eklemek RPC/kod değişikliği gerektirmez.
-- ----------------------------------------------------------------------------
create table if not exists reserved_usernames (
  username text primary key
);
insert into reserved_usernames (username) values
  ('halkora'), ('admin'), ('root'), ('destek'), ('support'), ('help'),
  ('api'), ('www'), ('null'), ('undefined'), ('system'), ('moderator'),
  ('official'), ('halkoraapp'), ('info'), ('security'), ('me')
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- 2. profiles.username — her zaman küçük harf, [a-z0-9_], 3-20 karakter.
--    Büyük harf/boşluk/Türkçe karakter hiç kaydedilmez (client normalize
--    ediyor); CHECK bunu sunucu tarafında da garanti eder.
-- ----------------------------------------------------------------------------
alter table profiles add column if not exists username text;

alter table profiles drop constraint if exists profiles_username_format_check;
alter table profiles add constraint profiles_username_format_check
  check (username is null or username ~ '^[a-z0-9_]{3,20}$');

alter table profiles drop constraint if exists profiles_username_unique;
alter table profiles add constraint profiles_username_unique unique (username);

-- Defense-in-depth: "own profile" RLS politikası (Ek A) tüm kolonlara ALL
-- izni veriyor, yani biri set_username RPC'sini atlayıp doğrudan
-- `update profiles set username = 'admin'` çalıştırabilir. CHECK format'ı
-- zaten engeller ama rezerve listeyi CHECK'e gömmek yerine (her eklemede
-- migration gerektirir) bir trigger'la kontrol ediyoruz.
create or replace function public.reject_reserved_username()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.username is not null
     and exists (select 1 from reserved_usernames r where r.username = new.username) then
    raise exception 'USERNAME_RESERVED';
  end if;
  return new;
end;
$$;

drop trigger if exists reject_reserved_username_trigger on profiles;
create trigger reject_reserved_username_trigger
  before insert or update of username on profiles
  for each row execute function public.reject_reserved_username();

-- ----------------------------------------------------------------------------
-- 3. set_username — istemcinin tek yazma yolu. Format/rezerve/benzersizlik
--    hatalarını stabil kodlarla fırlatır (src/lib/errors.ts bunları
--    lokalize eder). Yalnızca çağıranın KENDİ satırını değiştirir.
-- ----------------------------------------------------------------------------
create or replace function public.set_username(p_username text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_clean text := lower(trim(p_username));
begin
  if v_clean !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'USERNAME_INVALID';
  end if;
  if exists (select 1 from reserved_usernames where username = v_clean) then
    raise exception 'USERNAME_RESERVED';
  end if;
  if exists (select 1 from profiles where username = v_clean and id <> auth.uid()) then
    raise exception 'USERNAME_TAKEN';
  end if;
  update profiles set username = v_clean where id = auth.uid();
end;
$$;
grant execute on function public.set_username(text) to authenticated;

-- ----------------------------------------------------------------------------
-- 4. find_user_by_username — davet için TAM eşleşme arama. Bilinçli olarak
--    prefix/ILIKE arama YOK: aksi halde biri 'a', 'b', 'c'... deneyerek tüm
--    kullanıcı tablosunu enumerate edebilir. co-participant RLS politikası
--    zaten halka arkadaşlarının profilini okutuyor — bu yalnızca halka DIŞI
--    davet için, SECURITY DEFINER ile.
-- ----------------------------------------------------------------------------
create or replace function public.find_user_by_username(p_username text)
returns table (id uuid, name text, initials text, username text)
language sql security definer set search_path = public stable as $$
  select p.id, p.name, p.initials, p.username
  from profiles p
  where p.username = lower(trim(p_username))
  limit 1;
$$;
grant execute on function public.find_user_by_username(text) to authenticated;
