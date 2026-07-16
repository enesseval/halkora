-- ============================================================================
-- Halkora — DB denetim sorgusu
-- Supabase Dashboard → SQL Editor'de çalıştır, çıkan TÜM satırları kopyala.
-- (SQL Editor yalnızca son sorgunun sonucunu gösterir; bu yüzden her şey tek
-- sorguda birleştirildi. SORGU 2'yi ayrıca çalıştır — pg_cron kapalıysa hata
-- verir, o hata da başlı başına bir bulgudur.)
-- ============================================================================

-- SORGU 1 — şema, kısıtlar, index'ler, RLS, politikalar, fonksiyonlar,
--           trigger'lar (DB webhook'ları dahil), extension'lar, realtime,
--           storage, grant'lar
select section, line
from (
  -- Tablolar + kolonlar
  select 10 as ord, '1-COLUMNS' as section,
         c.table_name || '.' || c.column_name || ' : ' || c.data_type
         || case when c.is_nullable = 'NO' then ' NOT NULL' else '' end
         || coalesce(' DEFAULT ' || c.column_default, '') as line
  from information_schema.columns c
  where c.table_schema = 'public'

  union all
  -- PK / FK / UNIQUE / CHECK kısıtları
  select 20, '2-CONSTRAINTS',
         conrelid::regclass::text || ' : ' || conname || ' : ' || pg_get_constraintdef(oid)
  from pg_constraint
  where connamespace = 'public'::regnamespace

  union all
  -- Index'ler
  select 30, '3-INDEXES', tablename || ' : ' || indexdef
  from pg_indexes
  where schemaname = 'public'

  union all
  -- Tablo bazında RLS açık mı
  select 40, '4-RLS-ENABLED',
         relname || ' : rls=' || relrowsecurity::text || ' forced=' || relforcerowsecurity::text
  from pg_class
  where relnamespace = 'public'::regnamespace and relkind = 'r'

  union all
  -- RLS politikaları (tam ifadeleriyle)
  select 50, '5-POLICIES',
         tablename || ' : "' || policyname || '" : cmd=' || cmd
         || ' roles=' || array_to_string(roles, ',')
         || ' USING (' || coalesce(qual, '-') || ')'
         || ' WITH CHECK (' || coalesce(with_check, '-') || ')'
  from pg_policies
  where schemaname = 'public'

  union all
  -- public şemasındaki fonksiyonların TAM tanımları (RPC'ler + trigger fn'leri)
  select 60, '6-FUNCTIONS', pg_get_functiondef(p.oid)
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'

  union all
  -- Trigger'lar (public + auth) — Supabase DB Webhook'ları da trigger olarak
  -- görünür (supabase_functions.http_request çağrısı)
  select 70, '7-TRIGGERS', pg_get_triggerdef(t.oid)
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where not t.tgisinternal and n.nspname in ('public', 'auth')

  union all
  -- Extension'lar (pg_cron / pg_net açık mı burada görünür)
  select 80, '8-EXTENSIONS', extname || ' ' || extversion
  from pg_extension

  union all
  -- Realtime publication'a ekli tablolar (messages burada olmalı)
  select 90, '9-REALTIME', schemaname || '.' || tablename
  from pg_publication_tables
  where pubname = 'supabase_realtime'

  union all
  -- Storage bucket'ları (şu an hiç olmamalı)
  select 100, '10-STORAGE', id || ' : public=' || public::text
  from storage.buckets

  union all
  -- anon / authenticated rollerine tablo grant'ları
  select 110, '11-GRANTS',
         g.table_name || ' : ' || g.grantee || ' : ' || string_agg(g.privilege_type, ',')
  from information_schema.role_table_grants g
  where g.table_schema = 'public' and g.grantee in ('anon', 'authenticated')
  group by g.table_name, g.grantee
) x
order by ord, line;

-- ============================================================================
-- SORGU 2 — pg_cron işleri (AYRI çalıştır)
-- "schema cron does not exist" hatası alırsan: pg_cron extension'ı açık değil
-- demektir → evening-reminder cron'u hiç kurulmamış (YAPILACAKLAR.md §1 son madde).
-- ============================================================================
-- select jobid, jobname, schedule, active, command from cron.job;
