-- ============================================================================
-- Halkora — @kullanıcıadı ile davet (Faz 3C madde 2)
-- SQL Editor'de çalıştır. Ayrıca Dashboard'da 4. bir DB Webhook eklemen
-- gerekiyor (bu dosyanın SQL'i webhook'u kuramaz) — adımlar altta.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. invites tablosu — bir kişi bir challenge'a bir kere davet edilebilir
--    (unique constraint). RLS: gönderen yalnızca ÜYESİ OLDUĞU bir challenge
--    için, kendi adına yazabilir (nudge/message ile aynı desen — Ek K'nın
--    "üyelik şartı" düzeltmesi burada da baştan var).
-- ----------------------------------------------------------------------------
create table if not exists invites (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references challenges(id) on delete cascade,
  from_user uuid not null references auth.users(id),
  to_user uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (challenge_id, to_user)
);
alter table invites enable row level security;

drop policy if exists "insert own invite" on invites;
create policy "insert own invite" on invites
  for insert with check (from_user = auth.uid() and is_member(challenge_id));

drop policy if exists "read own invites" on invites;
create policy "read own invites" on invites
  for select using (to_user = auth.uid() or from_user = auth.uid());

create index if not exists invites_to_user_idx on invites (to_user);

-- ----------------------------------------------------------------------------
-- 2. Realtime YOK gerekmiyor — davet bildirimi push ile gidiyor (aşağıya
--    bak), uygulama içi bir "davetlerim" listesi yok (MVP sonrası, Faz 3C
--    notunda "💡" olarak işaretli).
-- ----------------------------------------------------------------------------

-- ============================================================================
-- 🔑 Dashboard'da MANUEL adım: 4. DB Webhook
-- ============================================================================
-- Database → Webhooks → yeni webhook:
--   Ad:     notify-invite
--   Tablo:  invites
--   Event:  INSERT
--   URL:    https://<PROJECT_REF>.supabase.co/functions/v1/notify   (aynı URL, diğer 3'üyle aynı)
--   Header: Authorization: Bearer <SERVICE_ROLE_KEY>
--   Header: x-webhook-secret: <WEBHOOK_SECRET>                      (Ek I'de kullandığın AYNI değer)
--
-- notify Edge Function'ı bu commit'te 'invites' tablosunu da işleyecek şekilde
-- güncellendi (supabase/functions/notify/index.ts) — bu yüzden Edge Function'ı
-- da yeniden deploy etmen gerekiyor: `supabase functions deploy notify --no-verify-jwt`
