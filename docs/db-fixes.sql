-- ============================================================================
-- Halkora — DB düzeltmeleri (14 Tem 2026 denetimi sonucu)
-- docs/db-audit.sql çıktısıyla canlı DB karşılaştırıldı; eksik/yanlış olan
-- her şey bu TEK dosyada. Baştan sona SQL Editor'de çalıştır — hepsi
-- idempotent (if not exists / create or replace / drop if exists).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. profiles.locale — dile göre push için ZORUNLU (Ek N §1)
--    ⚠️ Yeni notify/evening-reminder fonksiyonları bu kolonu SELECT ediyor;
--    kolon yokken onları deploy edersen push TAMAMEN kırılır. Önce bu SQL.
-- ----------------------------------------------------------------------------
alter table profiles add column if not exists locale text not null default 'tr';

-- ----------------------------------------------------------------------------
-- 2. Davet kodu entropisi (Ek K §2) — canlıda hâlâ 6 karakterlik default var
-- ----------------------------------------------------------------------------
alter table challenges
  alter column invite_code set default substr(md5(random()::text || clock_timestamp()::text), 1, 10);

-- ----------------------------------------------------------------------------
-- 3. Nudge hız sınırı (Ek K §1) — canlıda index yok, spam hâlâ mümkün
-- ----------------------------------------------------------------------------
create unique index if not exists nudges_one_per_recipient_per_day
  on nudges (from_user, to_user, ((created_at at time zone 'utc')::date));

-- ----------------------------------------------------------------------------
-- 4. RPC'ler: prose yerine hata kodları (Ek G + Ek M §2) — canlıdaki
--    join_challenge_by_code / restart_challenge / end_challenge_early hâlâ
--    Türkçe metin fırlatıyor; İngilizce kullanıcı Türkçe hata görür.
--    (get_challenge_preview canlıda zaten güncel — dokunmaya gerek yok.)
--    Not: `set search_path = public` Supabase linter'ının SECURITY DEFINER
--    uyarısını da kapatıyor.
-- ----------------------------------------------------------------------------
create or replace function public.join_challenge_by_code(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_challenge_id uuid;
  v_start_date date;
  v_timezone text;
  v_restrict boolean;
  v_current_day int;
begin
  select id, start_date, timezone, first_day_join_only
    into v_challenge_id, v_start_date, v_timezone, v_restrict
    from challenges where invite_code = p_code;
  if v_challenge_id is null then
    raise exception 'INVITE_NOT_FOUND';
  end if;

  if v_restrict then
    v_current_day := ((now() at time zone v_timezone)::date - v_start_date) + 1;
    if v_current_day > 1 then
      raise exception 'JOIN_WINDOW_CLOSED';
    end if;
  end if;

  insert into participants (challenge_id, user_id)
  values (v_challenge_id, auth.uid())
  on conflict (challenge_id, user_id) do nothing;

  return v_challenge_id;
end;
$$;
grant execute on function public.join_challenge_by_code(text) to authenticated;

create or replace function public.restart_challenge(p_challenge_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member(p_challenge_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  update challenges c
  set start_date = (now() at time zone c.timezone)::date, status = 'active'
  where c.id = p_challenge_id;
end;
$$;
grant execute on function public.restart_challenge(uuid) to authenticated;

create or replace function public.end_challenge_early(p_challenge_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member(p_challenge_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  update challenges set status = 'completed' where id = p_challenge_id;
end;
$$;
grant execute on function public.end_challenge_early(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 5. 🐛 stakes'e SELECT politikası — DENETİMİN BULDUĞU GERÇEK BUG:
--    İstemci Detay ekranı için stakes'i doğrudan okuyor
--    (src/data/challenges.ts) ama canlıda stakes'te yalnızca INSERT
--    politikası var → RLS her satırı gizliyor → gerçek modda bahis metni
--    HİÇBİR ZAMAN görünmüyor.
-- ----------------------------------------------------------------------------
drop policy if exists "read member stakes" on stakes;
create policy "read member stakes" on stakes
  for select using (is_member(challenge_id));

-- ----------------------------------------------------------------------------
-- 6. Insert politikalarını üyelikle sınırla — mevcut politikalar yalnızca
--    "kendi adına yazıyor mu"ya bakıyor; challenge uuid'sini öğrenen biri
--    üyesi OLMADIĞI bir halkaya mesaj/nudge/tepki yazabilir (nudge push
--    tetiklediği için spam kapısı). participants'taki "join as self" de
--    join penceresi (first_day_join_only) kontrolünü bypass ederek
--    herhangi bir challenge'a doğrudan katılmaya izin veriyordu — doğrudan
--    insert'e yalnızca kurucunun kendi challenge'ı için izin veriyoruz
--    (create akışı); herkes zaten join_challenge_by_code RPC'sinden geçiyor
--    (SECURITY DEFINER olduğu için bu politikaya takılmaz).
-- ----------------------------------------------------------------------------
drop policy if exists "insert own message" on messages;
create policy "insert own message" on messages
  for insert with check (user_id = auth.uid() and is_member(challenge_id));

drop policy if exists "insert own nudge" on nudges;
create policy "insert own nudge" on nudges
  for insert with check (from_user = auth.uid() and is_member(challenge_id));

drop policy if exists "insert own reaction" on message_reactions;
create policy "insert own reaction" on message_reactions
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from messages m
                where m.id = message_id and is_member(m.challenge_id))
  );

drop policy if exists "join as self" on participants;
drop policy if exists "owner joins own challenge" on participants;
create policy "owner joins own challenge" on participants
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from challenges c
                where c.id = challenge_id and c.owner_id = auth.uid())
  );

-- ----------------------------------------------------------------------------
-- 7. Performans index'leri — FK kolonlarına Postgres otomatik index açmaz;
--    Home poll'u (fetchMyChallenges) ve evening-reminder bu yollarla tarıyor.
--    Bugün veri küçükken fark etmez, büyüyünce eder — ucuzken ekle.
-- ----------------------------------------------------------------------------
create index if not exists participants_user_idx on participants (user_id);
create index if not exists check_ins_challenge_day_idx on check_ins (challenge_id, day_number);
create index if not exists messages_challenge_created_idx on messages (challenge_id, created_at);
create index if not exists message_reactions_message_idx on message_reactions (message_id);
create index if not exists nudges_challenge_idx on nudges (challenge_id);
create index if not exists stakes_challenge_idx on stakes (challenge_id);

-- ----------------------------------------------------------------------------
-- 8. status kolonuna CHECK — 'upcoming/active/completed' dışına yazım
--    kazayla bile mümkün olmasın (diğer text kolonlarının hepsinde vardı,
--    bunda yoktu).
-- ----------------------------------------------------------------------------
alter table challenges drop constraint if exists challenges_status_check;
alter table challenges add constraint challenges_status_check
  check (status in ('upcoming', 'active', 'completed'));

-- ----------------------------------------------------------------------------
-- 9. Mevcut SECURITY DEFINER yardımcılarına da search_path sabitle
--    (Supabase linter uyarısı; davranış değişikliği yok).
-- ----------------------------------------------------------------------------
alter function public.is_member(uuid) set search_path = public;
alter function public.handle_new_user() set search_path = public;
alter function public.get_challenge_preview(text) set search_path = public;
