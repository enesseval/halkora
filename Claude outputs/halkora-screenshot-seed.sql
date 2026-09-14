-- =====================================================================
--  HALKORA · App Store ekran görüntüsü verisi
--  6 kare + 2 yedek kare için demo halkalar, katılımcılar ve check-in'ler
--
--  ÇALIŞTIRMA: Supabase Dashboard → SQL Editor → tümünü yapıştır → Run.
--  (SQL Editor "postgres" rolüyle çalışır, RLS'i baypas eder.)
--
--  ÖNEMLİ — çalıştırmadan önce iki şey:
--    1) Aşağıdaki  v_me  değişkenine, EKRAN GÖRÜNTÜSÜNÜ ÇEKECEĞİN
--       CİHAZDAKİ hesabın id'sini yaz. Uygulama anonim auth kullanıyor,
--       yani her temiz kurulum yeni bir id üretir. Bulmak için:
--
--          select id, name, username, created_at
--            from public.profiles
--           order by created_at desc;
--
--       Cihazda uygulamayı açıp bir isim verirsen hangi satır olduğu belli olur.
--
--    2) Bu betik yalnızca DEMO verisi ekler ve kendi eski demo verisini
--       siler. Gerçek halkalarına dokunmaz (ayıraç: invite_code 'demo-%').
--       Temizlemek için en alttaki "GERİ AL" bloğunu çalıştır.
--
--  HANGİ KARE HANGİ HALKADAN ÇIKIYOR
--    Kare 1  kanca ......... Ana ekran — üç aktif halka birlikte görünür
--                            (Koşu %52, Kitap %57, Meditasyon %20 dolu)
--    Kare 2  mekanik ....... "30 Sayfa Kitap" detayı — bugün işaretsiz,
--                            dün işaretli. Ekranı aç, check-in'e bas,
--                            segment dolarken çek.
--    Kare 3  grup .......... "Sabah Koşusu" katılımcı listesi — 5/8
--    Kare 4  rahatlama ..... "10 Dakika Meditasyon" — dün kaçırılmış,
--                            2 joker duruyor; halkayı açınca joker ekranı gelir
--    Kare 5  bahis ......... "Sabah Koşusu" bahis kartı
--    Kare 6  widget ........ Uygulamayı bir kez aç ve yenile (widget verisini
--                            App Group'a uygulama yazıyor, SQL değil), sonra
--                            ana ekrana widget ekle. Küçük widget en acil
--                            halkayı gösterir — akşama doğru çekersen
--                            "Sabah Koşusu" öne çıkar.
--    Yedek 7 paylaşım ...... "Şükran Günlüğü" dün bitti, 14/14 dolu →
--                            geçmiş/bitmiş halkadan paylaşım kartı
--    Yedek 8 sohbet ........ "Sabah Koşusu" sohbeti (4 mesaj + bir tepki)
--
--  SIRALAMA UYARISI: kare 2'de check-in'e bastığında o halkanın verisi
--  değişir. Betiği tekrar çalıştırmak her şeyi ilk haline döndürür.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Yan etkileri kapat
--    notify-* trigger'ları her check-in / mesaj için Edge Function'a
--    webhook atıyor. Kapatmazsan seed sırasında gerçek cihazlara push
--    bildirimi yağar. Sonunda tekrar açılıyorlar.
-- ---------------------------------------------------------------------
alter table public.check_ins  disable trigger "notify-checkin";
alter table public.messages   disable trigger "notify-message";
alter table public.messages   disable trigger messages_rate_limit;
alter table public.challenges disable trigger enforce_challenge_limit_trigger;  -- ücretsiz hesap 2 aktif halka sınırı


-- ---------------------------------------------------------------------
-- 2) Demo verisini kur
-- ---------------------------------------------------------------------
do $seed$
declare
  ------------------------------------------------------------------
  -- BURAYI DOLDUR
  ------------------------------------------------------------------
  v_me      uuid := '80fdf5d5-68f8-486d-907d-c05f40c81a3d';   -- <<< kendi hesabının id'si

  v_tz      constant text := 'Europe/Istanbul';
  v_today   date := (now() at time zone 'Europe/Istanbul')::date;

  -- Demo kullanıcılar (sabit id — betik tekrar çalıştırılabilir olsun diye)
  v_zeynep  uuid := 'd0000000-0000-4000-8000-000000000001';
  v_mert    uuid := 'd0000000-0000-4000-8000-000000000002';
  v_selin   uuid := 'd0000000-0000-4000-8000-000000000003';
  v_can     uuid := 'd0000000-0000-4000-8000-000000000004';
  v_elif    uuid := 'd0000000-0000-4000-8000-000000000005';
  v_burak   uuid := 'd0000000-0000-4000-8000-000000000006';
  v_deniz   uuid := 'd0000000-0000-4000-8000-000000000007';

  -- Halkalar
  v_a       uuid := 'c0000000-0000-4000-8000-00000000000a';  -- Sabah Koşusu   (kare 1,3,5,6)
  v_b       uuid := 'c0000000-0000-4000-8000-00000000000b';  -- 30 Sayfa Kitap (kare 2)
  v_c       uuid := 'c0000000-0000-4000-8000-00000000000c';  -- Meditasyon     (kare 4)
  v_d       uuid := 'c0000000-0000-4000-8000-00000000000d';  -- Bitmiş halka   (yedek 7)

  -- Başlangıç tarihleri — "bugün"e göre hesaplanır, betik hangi gün
  -- çalıştırılırsa çalıştırılsın halkalar aynı günde durur.
  v_a_start date := v_today - 11;   -- 21 günün 12. günü
  v_b_start date := v_today -  8;   -- 14 günün  9. günü
  v_c_start date := v_today -  6;   -- 30 günün  7. günü
  v_d_start date := v_today - 14;   -- 14 gün bitti (dün kapandı)

  r record;
begin
  if v_me is null or not exists (select 1 from public.profiles where id = v_me) then
    raise exception 'v_me geçersiz: % — profiles tablosunda böyle bir satır yok', v_me;
  end if;

  ------------------------------------------------------------------
  -- 2a) Eski demo verisini sil (challenges silinince participants,
  --     check_ins, messages, stakes, nudges cascade ile gider)
  ------------------------------------------------------------------
  delete from public.challenges where invite_code like 'demo-%';
  delete from auth.users
   where id in (v_zeynep, v_mert, v_selin, v_can, v_elif, v_burak, v_deniz);

  ------------------------------------------------------------------
  -- 2b) Demo kullanıcılar
  --     auth.users'a insert → on_auth_user_created trigger'ı
  --     profiles satırını kendisi açar; sonra adı/baş harfleri yazıyoruz.
  ------------------------------------------------------------------
  for r in
    select * from (values
      (v_zeynep, 'Zeynep Kaya',  'ZK', 'zeynepk'),
      (v_mert,   'Mert Aydın',   'MA', 'mertay'),
      (v_selin,  'Selin Nur',    'SN', 'selinnur'),
      (v_can,    'Can Demir',    'CD', 'candemir'),
      (v_elif,   'Elif Şahin',   'EŞ', 'elifsahin'),
      (v_burak,  'Burak Yılmaz', 'BY', 'burakyz'),
      (v_deniz,  'Deniz Arslan', 'DA', 'denizars')
    ) as t(uid, adi, bas, kadi)
  loop
    insert into auth.users (
      instance_id, id, aud, role, is_anonymous, is_sso_user,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000', r.uid, 'authenticated', 'authenticated', true, false,
      '{}'::jsonb, '{}'::jsonb,
      '', '', '', '',
      now() - interval '40 days', now() - interval '40 days'
    ) on conflict (id) do nothing;

    insert into public.profiles (id) values (r.uid) on conflict (id) do nothing;

    update public.profiles
       set name = r.adi, initials = r.bas, username = r.kadi, locale = 'tr'
     where id = r.uid;
  end loop;

  -- Kendi hesabının da ekranda düzgün bir adı olsun (istersen bu satırı sil)
  update public.profiles
     set name = coalesce(nullif(name, ''), 'Enes'),
         initials = coalesce(nullif(initials, ''), 'E')
   where id = v_me;


  -- ================================================================
  -- HALKA A · "Sabah Koşusu" — 21 gün, 12. gün, 8 kişi
  -- Kare 1 (ana ekran), Kare 3 (katılımcı listesi 5/8),
  -- Kare 5 (bahis kartı), Kare 6 (widget kaynağı)
  -- ================================================================
  insert into public.challenges
    (id, owner_id, title, daily_action, total_days, start_date, timezone,
     status, invite_code, joker_allowance, first_day_join_only, deadline_time, created_at)
  values
    (v_a, v_me, 'Sabah Koşusu', 'Her sabah 3 km koş', 21, v_a_start, v_tz,
     'active', 'demo-kosu', 2, false, '00:00', ((v_a_start - 2) + time '20:00') at time zone v_tz);

  insert into public.participants (challenge_id, user_id, joined_at)
  select v_a, u, (v_a_start + time '08:00') at time zone v_tz
    from unnest(array[v_me, v_zeynep, v_mert, v_selin, v_can, v_elif, v_burak, v_deniz]) as u;

  -- (kullanıcı, alışkanlık saati, 'done' günleri, 'joker' günleri)
  -- Bugün = 12. gün. Bugünü işaretleyenler: Zeynep, Mert, Selin, Can, Elif → 5/8.
  -- Sen ve Burak, Deniz bekliyor: kare 3'teki "bekleyenler" bölümü boş kalmasın.
  for r in
    select * from (values
      (v_me,     time '07:05', array[1,2,3,4,6,7,9,10,11],        array[5]),
      (v_zeynep, time '06:40', array[1,2,3,4,5,6,7,8,9,10,11,12], array[]::int[]),
      (v_mert,   time '07:20', array[1,2,3,4,5,7,8,9,10,11,12],   array[6]),
      (v_selin,  time '07:55', array[1,2,3,4,5,6,7,8,10,11,12],   array[]::int[]),
      (v_can,    time '08:30', array[1,2,3,5,6,7,8,9,10,11,12],   array[4]),
      (v_elif,   time '09:10', array[1,2,3,4,5,6,7,8,9,10,11,12], array[]::int[]),
      (v_burak,  time '21:15', array[1,2,3,4,5,6,7,8,9,10,11],    array[]::int[]),
      (v_deniz,  time '20:40', array[1,2,4,5,6,7,8,9,11],         array[3])
    ) as t(uid, saat, done_days, joker_days)
  loop
    insert into public.check_ins (participant_id, challenge_id, day_number, type, created_at)
    select p.id, v_a, x.n, x.typ,
           least(((v_a_start + (x.n - 1)) + r.saat) at time zone v_tz, now() - interval '4 minutes')
      from public.participants p,
           (select unnest(r.done_days) as n, 'done'::text as typ
            union all
            select unnest(r.joker_days) as n, 'joker'::text) x
     where p.challenge_id = v_a and p.user_id = r.uid
       on conflict (participant_id, day_number) do nothing;
  end loop;

  -- KARE 5 · bahis kartı. Metinde para yok; sonuç bir ikram.
  insert into public.stakes (challenge_id, mode, kind, text, threshold_missed)
  values (v_a, 'direct', 'individual', 'Üç günü kaçıran gruba kahve ısmarlar', 3);

  -- YEDEK 8 · halka sohbeti
  insert into public.messages (challenge_id, user_id, day_number, kind, text, created_at, notify_others)
  values
    (v_a, v_zeynep, 12, 'message', 'Bugünkü 3 km yokuş yukarıydı, oturamıyorum 😅',
       ((v_today + time '07:02') at time zone v_tz), false),
    (v_a, v_can,    12, 'message', 'Sabah yağmur vardı diye erteleyecektim, halka bildirimi gelince çıktım.',
       ((v_today + time '08:41') at time zone v_tz), false),
    (v_a, v_elif,   12, 'message', 'Bu hafta hiç kaçırmadım, kahveyi ısmarlayan ben olmayacağım 👀',
       ((v_today + time '09:16') at time zone v_tz), false),
    (v_a, v_mert,   12, 'message', 'Burak nerede kaldı?',
       ((v_today + time '10:05') at time zone v_tz), false);

  insert into public.message_reactions (message_id, user_id, emoji)
  select m.id, v_selin, '🔥' from public.messages m
   where m.challenge_id = v_a and m.user_id = v_elif and m.day_number = 12
   limit 1;


  -- ================================================================
  -- HALKA B · "30 Sayfa Kitap" — 14 gün, 9. gün, 4 kişi
  -- Kare 2 (check-in butonu). Serin temiz: dün işaretli, bugün açık,
  -- joker ekranı araya girmiyor → tek dokunuş sahnesi bozulmuyor.
  -- ================================================================
  insert into public.challenges
    (id, owner_id, title, daily_action, total_days, start_date, timezone,
     status, invite_code, joker_allowance, first_day_join_only, deadline_time, created_at)
  values
    (v_b, v_me, '30 Sayfa Kitap', 'Her gün 30 sayfa oku', 14, v_b_start, v_tz,
     'active', 'demo-kitap', 1, false, '00:00', ((v_b_start - 1) + time '22:10') at time zone v_tz);

  insert into public.participants (challenge_id, user_id, joined_at)
  select v_b, u, (v_b_start + time '10:00') at time zone v_tz
    from unnest(array[v_me, v_selin, v_can, v_elif]) as u;

  for r in
    select * from (values
      (v_me,    time '22:30', array[1,2,3,4,5,6,7,8],   array[]::int[]),
      (v_selin, time '07:50', array[1,2,3,4,5,6,7,8,9], array[]::int[]),
      (v_can,   time '12:20', array[1,2,3,4,5,6,8,9],   array[]::int[]),
      (v_elif,  time '23:10', array[1,2,3,4,5,6,7,8],   array[]::int[])
    ) as t(uid, saat, done_days, joker_days)
  loop
    insert into public.check_ins (participant_id, challenge_id, day_number, type, created_at)
    select p.id, v_b, x.n, x.typ,
           least(((v_b_start + (x.n - 1)) + r.saat) at time zone v_tz, now() - interval '4 minutes')
      from public.participants p,
           (select unnest(r.done_days) as n, 'done'::text as typ
            union all
            select unnest(r.joker_days) as n, 'joker'::text) x
     where p.challenge_id = v_b and p.user_id = r.uid
       on conflict (participant_id, day_number) do nothing;
  end loop;


  -- ================================================================
  -- HALKA C · "10 Dakika Meditasyon" — 30 gün, 7. gün, 3 kişi
  -- Kare 4 (joker). Dünü (6. gün) BİLEREK boş bıraktık:
  -- mapRow → hasMissedYesterday = true, jokerRemaining = 2
  -- → uygulamayı açınca joker/kaçırılan gün ekranı gelir.
  -- Sahibi Zeynep: böylece senin sahip olduğun aktif halka sayısı 2'de kalır
  -- (ücretsiz hesap sınırı), halka da "katıldığın bir halka" gibi görünür.
  -- ================================================================
  insert into public.challenges
    (id, owner_id, title, daily_action, total_days, start_date, timezone,
     status, invite_code, joker_allowance, first_day_join_only, deadline_time, created_at)
  values
    (v_c, v_zeynep, '10 Dakika Meditasyon', 'Günde 10 dakika nefes çalışması', 30, v_c_start, v_tz,
     'active', 'demo-medit', 2, false, '00:00', ((v_c_start - 1) + time '19:30') at time zone v_tz);

  insert into public.participants (challenge_id, user_id, joined_at)
  select v_c, u, (v_c_start + time '09:30') at time zone v_tz
    from unnest(array[v_me, v_zeynep, v_mert]) as u;

  for r in
    select * from (values
      (v_me,     time '08:00', array[1,2,3,4,5],     array[]::int[]),   -- 6. gün (dün) YOK
      (v_zeynep, time '06:55', array[1,2,3,4,5,6,7], array[]::int[]),
      (v_mert,   time '13:40', array[1,2,3,4,5,6],   array[]::int[])
    ) as t(uid, saat, done_days, joker_days)
  loop
    insert into public.check_ins (participant_id, challenge_id, day_number, type, created_at)
    select p.id, v_c, x.n, x.typ,
           least(((v_c_start + (x.n - 1)) + r.saat) at time zone v_tz, now() - interval '4 minutes')
      from public.participants p,
           (select unnest(r.done_days) as n, 'done'::text as typ
            union all
            select unnest(r.joker_days) as n, 'joker'::text) x
     where p.challenge_id = v_c and p.user_id = r.uid
       on conflict (participant_id, day_number) do nothing;
  end loop;


  -- ================================================================
  -- HALKA D · "Şükran Günlüğü" — 14 gün, DÜN BİTTİ (yedek kare 7)
  -- Paylaşım kartı bitmiş bir halkadan daha iyi görünür: 14/14 dolu halka.
  -- Bitmiş halka aktif sayılmadığı için 2 halka sınırını da zorlamaz.
  -- ================================================================
  insert into public.challenges
    (id, owner_id, title, daily_action, total_days, start_date, timezone,
     status, invite_code, joker_allowance, first_day_join_only, deadline_time, created_at)
  values
    (v_d, v_me, 'Şükran Günlüğü', 'Her akşam üç satır yaz', 14, v_d_start, v_tz,
     'active', 'demo-gunluk', 1, false, '00:00', ((v_d_start - 1) + time '21:00') at time zone v_tz);

  insert into public.participants (challenge_id, user_id, joined_at)
  select v_d, u, (v_d_start + time '21:00') at time zone v_tz
    from unnest(array[v_me, v_zeynep, v_selin, v_burak, v_deniz]) as u;

  for r in
    select * from (values
      (v_me,     time '23:05', array[1,2,3,4,5,6,7,8,10,11,12,13,14], array[9]),
      (v_zeynep, time '22:10', array[1,2,3,4,5,6,7,8,9,10,11,12,13,14], array[]::int[]),
      (v_selin,  time '21:40', array[1,2,3,4,5,6,7,9,10,11,12,13],    array[8]),
      (v_burak,  time '23:50', array[1,2,3,4,5,6,7,8,9,10,11],        array[]::int[]),
      (v_deniz,  time '20:25', array[1,2,3,4,6,7,8,9,10,12,13,14],    array[5])
    ) as t(uid, saat, done_days, joker_days)
  loop
    insert into public.check_ins (participant_id, challenge_id, day_number, type, created_at)
    select p.id, v_d, x.n, x.typ,
           least(((v_d_start + (x.n - 1)) + r.saat) at time zone v_tz, now() - interval '4 minutes')
      from public.participants p,
           (select unnest(r.done_days) as n, 'done'::text as typ
            union all
            select unnest(r.joker_days) as n, 'joker'::text) x
     where p.challenge_id = v_d and p.user_id = r.uid
       on conflict (participant_id, day_number) do nothing;
  end loop;

  raise notice 'Demo verisi hazır. Uygulamada aşağı çekip yenile.';
end
$seed$;


-- ---------------------------------------------------------------------
-- 3) Trigger'ları geri aç  (BU BLOĞU ATLAMA)
-- ---------------------------------------------------------------------
alter table public.check_ins  enable trigger "notify-checkin";
alter table public.messages   enable trigger "notify-message";
alter table public.messages   enable trigger messages_rate_limit;
alter table public.challenges enable trigger enforce_challenge_limit_trigger;


-- ---------------------------------------------------------------------
-- 4) Doğrulama — uygulamayı açmadan önce sayıları burada gör
--    "Sabah Koşusu" satırında bugun_tamamlayan = 5, kisi = 8 olmalı.
-- ---------------------------------------------------------------------
select c.title,
       cur.d                                   as bugun_kacinci_gun,
       c.total_days                            as toplam_gun,
       count(distinct p.id)                    as kisi,
       count(distinct ci.participant_id)
         filter (where ci.day_number = cur.d)  as bugun_tamamlayan,
       count(distinct ci.id) filter (where ci.type = 'joker') as joker_sayisi
  from public.challenges c
  cross join lateral (select (public.challenge_cycle_start(c.id) - c.start_date) + 1 as d) cur
  left join public.participants p on p.challenge_id = c.id
  left join public.check_ins   ci on ci.challenge_id = c.id
 where c.invite_code like 'demo-%'
 group by c.title, cur.d, c.total_days
 order by c.title;


-- =====================================================================
--  GERİ AL — demo verisini tamamen kaldırmak için yalnızca bunu çalıştır
-- =====================================================================
-- delete from public.challenges where invite_code like 'demo-%';
-- delete from auth.users where id::text like 'd0000000-0000-4000-8000-%';
