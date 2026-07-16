-- ============================================================================
-- Halkora — Mesaj bildirimini aralıklı özete çevirme (docs/PHASE2-SUPABASE.md "Ek P")
-- SQL Editor'de çalıştır.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. profiles.last_message_notified_at — her kullanıcı için "buraya kadarki
--    mesajları zaten bildirdim" işareti. default now(): kolon eklendiği anda
--    var olan TÜM geçmiş mesajları "yeni" sayıp herkese dev bir bildirim
--    patlatmasın diye.
-- ----------------------------------------------------------------------------
alter table profiles
  add column if not exists last_message_notified_at timestamptz not null default now();

-- ----------------------------------------------------------------------------
-- 2. pg_cron — message-digest fonksiyonunu düzenli çalıştır.
--    Önce TEST modu (1 dakikada bir) kur, denemeni yap, sonra prod'a geçerken
--    aynı SQL'i saatlik zamanlamayla tekrar çalıştır (cron.schedule aynı isimle
--    çağrılınca zamanlamayı GÜNCELLER, yeni bir job oluşturmaz).
--
-- 🧪 TEST — her 1 dakikada bir:
select cron.schedule(
  'message-digest',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/message-digest',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
      'x-webhook-secret', '<WEBHOOK_SECRET>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 🚀 PROD — testin bitince bunu çalıştır (saatlik, aynı job'ı günceller):
-- select cron.schedule(
--   'message-digest',
--   '0 * * * *',
--   $$
--   select net.http_post(
--     url := 'https://<PROJECT_REF>.supabase.co/functions/v1/message-digest',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
--       'x-webhook-secret', '<WEBHOOK_SECRET>',
--       'Content-Type', 'application/json'
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );
