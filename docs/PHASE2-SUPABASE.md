# Faz 2 — Supabase + Auth + Onboarding Checklist

> Faz 1 mimarisi buna hazır: tüm veri erişimi `src/hooks/index.ts` arkasında.
> Faz 2'de **sadece** o katmanın içi (`src/stores/mockStore.ts` → Supabase sorguları)
> değişecek; ekranların hook imzaları aynı kalacak.

## 📍 Şu an neredeyiz

**Bitti:** 1–6. maddeler (proje, şema, RLS, auth/onboarding, check-in/create/join/chat
gerçek Supabase) + realtime aboneliği (madde 7'nin ilk parçası).

**Yarım kalanlar (bilerek):**
- `check-in`'in gün numarası hâlâ istemcide hesaplanıyor — sunucu doğrulaması yok.
- `restart` / `endEarly` hâlâ sadece mock (Supabase'e yazmıyor).
- Davet linki deep-link olarak (`thechallenge://join/...`) hiç test edilmedi.
- `mockStore`/`mock.ts` bilerek duruyor (optimistic-UI + Supabase kapalıyken fallback katmanı).

**Yapılmadı:** Edge Function (check-in doğrulama), Push, Apple native girişi (madde 7'nin geri kalanı + madde 8) — hepsi dev build gerektiriyor, en sona bırakıldı.

**Sıradaki en mantıklı adım:** check-in Edge Function'ı (güvenlik açığını kapatır) **veya**
`restart`/`endEarly`'i gerçek yazıma taşımak (mockStore'u tamamen kaldırmanın önündeki son engel).

---

## ⚠️ 0. Önce bunu bil (sıralamayı bu belirliyor)

- **Apple ile Giriş, Expo Go'da ÇALIŞMAZ.** Native "Sign in with Apple" için
  Apple entitlement + **development build** (dev-client) gerekir. Expo Go'nun
  bundle id'si Apple'a kayıtlı değil.
- Sen Windows'tasın → iOS dev build'i **EAS Build (bulut)** ile alırsın (Mac gerekmez).
- **Öneri:** Önce her şeyi **anonim auth** ile Expo Go'da bitir (isim sorma, create,
  join, check-in gerçek veriyle çalışsın). **Apple'ı en sona bırak** — dev build ile ekle.
- Gerekli hesaplar: Supabase (ücretsiz), Apple Developer Program (Apple girişi için, yıllık $99),
  Expo/EAS hesabı (dev build için, ücretsiz başlar).

---

## 1. Supabase projesi

- [x] supabase.com → yeni proje oluştur, **Project URL** ve **anon public key**'i not al.
- [x] Auth → Providers: **Anonymous** aç (hızlı test için). **Email** opsiyonel.
- [ ] Auth → URL Configuration: redirect URL'e uygulama şeması ekle → `thechallenge://`
      (app.json'da `scheme: "thechallenge"` zaten var — dashboard tarafı teyit edilmedi).

## 2. Şema + RLS (SQL Editor'de çalıştır)

- [x] Tabloları oluştur (özet — tam SQL aşağıda "Ek A"):
  - `profiles(id→auth.users, name, initials)`
  - `challenges(id, owner_id, title, daily_action, total_days, start_date, timezone, status, invite_code UNIQUE, joker_allowance)`
  - `participants(challenge_id, user_id, UNIQUE(challenge_id,user_id))`
  - `check_ins(participant_id, challenge_id, day_number, type∈{done,joker}, UNIQUE(participant_id,day_number))`
  - `messages(challenge_id, user_id, day_number, kind∈{message,system}, text)`
  - `message_reactions(message_id, user_id, emoji, UNIQUE(message_id,user_id,emoji))`
  - `stakes(challenge_id, mode∈{direct,vote}, text)` + `stake_options(stake_id,label)` + `stake_votes(option_id,user_id UNIQUE)`
  - `nudges(challenge_id, from_user, to_user)`
- [x] **RLS aç** (her tabloda `enable row level security`).
- [x] Politikalar (Ek A + B + C + D + E ile tamamlandı):
  - Bir kullanıcı **üyesi olduğu** challenge'ın satırlarını okuyabilir.
  - Kullanıcı **kendi** check_in / message / reaction / vote / nudge satırını yazabilir.
  - `invite_code` ile challenge önizlemesi herkese açık okunabilir (join ekranı için) —
    RPC ile çözüldü (Ek C).
  - Co-participant `profiles` okuma (Ek E) — "Katılımcı" fallback bug'ının düzeltmesi.
- [x] `profiles` için: yeni `auth.users` eklendiğinde otomatik boş profil açan **trigger**
      (`on auth.users insert → create profile`).

## 3. İstemci entegrasyonu (uygulamada)

- [x] Paketler: `npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill`
- [x] `.env` + `app.config` ile `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- [x] **Yeni dosya `src/lib/supabase.ts`**: AsyncStorage'lı Supabase client (session persist).
- [x] TanStack Query kur: `npm i @tanstack/react-query` → `app/_layout.tsx`'te `QueryClientProvider` ile sar.

## 4. Auth + Onboarding (senin asıl istediğin akış)

- [x] **Yeni `src/hooks/useAuth.ts`**: session'ı dinler (`onAuthStateChange`) + açılışta `getUser()` ile
      sunucuya karşı doğrulama (silinmiş kullanıcı → otomatik sign-out, "hayalet oturum" koruması).
- [x] `app/_layout.tsx`'te yönlendirme mantığı:
  - session yok → `(auth)/welcome` (E1)
  - session var + profil ismi yok → **onboarding** (O1–O6: kanca, mekanik, bahis, isim, oluştur/katıl, kodla katıl)
  - session var + isim var → `(main)` (Home)
- [x] **E1 Welcome** butonları: ikisi de (Apple/Google) → `signInAnonymously()` (Apple gerçek native girişi Faz 2'nin en sonunda, dev build ile).
- [x] **Onboarding ekranı**: O1–O6 tam akış, isim → `profiles.name` güncelle → `/start` (oluştur/katıl seçimi).

## 5. Mock → Supabase geçişi (hook hook)

`src/hooks/index.ts` imzaları AYNI kaldı; içleri Supabase/Query oldu:

- [x] `useTodayStatus()` → `challenges` + `check_ins` join eden Query (+ 5sn polling fallback).
- [x] `useChallenge(id)` / `useChallengeMessages(id)` → challenge + participants + messages gerçek veriden.
- [x] `useCheckIn(id)` → optimistic mutation (`check_ins` insert) + rollback.
      ⚠️ `day_number` hâlâ **istemcide** hesaplanıp gönderiliyor — sunucu tarafı doğrulama yok (bkz. madde 7'deki Edge Function, henüz yapılmadı).
- [x] `useChallengeActions(id)` → `sendMessage` / `react` / `nudge` / `useJoker` gerçek Supabase insert'leri (optimistic + rollback + realtime + polling).
      ⚠️ `restart` / `endEarly` **hâlâ sadece mock** — `challenges.status` güncellemesi Supabase'e yazılmıyor.
- [x] `useCreateChallenge()` → `challenges` + `participants` + `stakes` insert.
- [x] `useJoin()` → `join_challenge_by_code` RPC ile `participants` insert.
- [ ] `src/stores/mockStore.ts` / `src/data/mock.ts` kaldırılması — bilinçli olarak **henüz yapılmadı**:
      store hâlâ optimistic-UI + local cache katmanı olarak kullanılıyor (Supabase configured değilken de
      çalışmaya devam etmesi için). Kaldırmak, restart/endEarly'nin de gerçek yazıma taşınmasını gerektirir.

## 6. Create / Join akışları (uçtan uca)

- [x] Create (E3) bitince gerçek `invite_code` üret (DB default) → E4 Davet.
- [~] E4 "Daveti paylaş" linki: şu an yalnızca `thechallenge.app/j/{invite_code}` (düz metin,
      `https://` prefiksi yok). **`thechallenge://join/{invite_code}` deep link hiç test edilmedi** —
      linke gerçekten tıklayınca uygulamanın açılıp doğru ekrana düştüğü doğrulanmadı.
- [x] `join/[code]` (E5): `get_challenge_preview` RPC ile önizleme → "Katıl" → `participants` insert → Detay.
      Ayrıca: geri/kapat butonu, isim tekrar sormama, klavye davranışı düzeltildi.
- [x] app.json `scheme: "thechallenge"` eklendi. Universal Links / App Links kurulumu **yapılmadı** (ileride).
- [x] Home'daki "+" → `QuickStartSheet` (oluştur / kodla katıl, pano otomatik yakalama) — checklist'te
      yoktu ama aynı akışın parçası olarak eklendi.

## 7. Realtime + Edge Functions + Push

- [x] **Realtime**: `useRealtimeChallenge(id)` — check_ins/participants/messages/message_reactions için
      `postgres_changes` aboneliği + Query invalidate. Ayrıca **polling fallback** (4–5sn) eklendi çünkü
      realtime'ın senin projende gerçekten tetiklendiği net doğrulanamadı (Ek D'nin publication adımı kritik).
- [ ] **Edge Function `check-in`**: yapılmadı. `day_number` hâlâ istemci tarafından hesaplanıp gönderiliyor —
      teorik olarak sahtelenebilir. **Sıradaki en önemli iş bu.**
- [ ] **Edge Function `join`**: ayrı bir Edge Function yerine RPC (`join_challenge_by_code`, Ek C) ile
      çözüldü — aynı güvenlik amacına hizmet ediyor, bu haliyle kapatılmış sayılabilir.
- [ ] **Push**: yapılmadı (dev build gerektiriyor, en sona bırakıldı).

## 8. Apple ile Giriş (EN SON — dev build)

- [ ] Apple Developer'da App ID + "Sign in with Apple" capability + Service ID.
- [ ] Supabase Auth → Apple provider'ı doldur (Service ID, Team ID, Key).
- [ ] `npx expo install expo-apple-authentication` → `app.json` plugin + iOS `usesAppleSignIn: true`.
- [ ] `eas build --profile development --platform ios` → cihaza kur (dev-client).
- [ ] E1'de `AppleAuthentication.signInAsync()` → `identityToken` → `supabase.auth.signInWithIdToken({ provider:'apple', token })`.
- [ ] İlk Apple girişinde isim gelmeyebilir → onboarding isim ekranı yine devrede.

---

## Önerilen sıra (en az sürtünme)

1. Supabase proje + şema + RLS (bölüm 1–2)
2. Client + Query + `src/lib/supabase.ts` (bölüm 3)
3. **Anonim auth + isim onboarding** (bölüm 4) → Expo Go'da çalışır
4. Hook'ları tek tek Supabase'e geçir (bölüm 5) — create/join/check-in gerçek veriyle
5. Realtime + check-in edge function (bölüm 7)
6. Dev build + Apple + Push (bölüm 8) — en son

---

## Ek A — Başlangıç SQL'i (iskele, gözden geçir)

```sql
-- profiles
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  name text,
  initials text,
  created_at timestamptz default now()
);
alter table profiles enable row level security;
create policy "own profile" on profiles for all using (auth.uid() = id);

-- challenges
create table challenges (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users,
  title text not null,
  daily_action text not null,
  total_days int not null,
  start_date date not null,
  timezone text not null default 'Europe/Istanbul',
  status text not null default 'upcoming',           -- upcoming|active|completed
  invite_code text unique not null default substr(md5(random()::text),1,6),
  joker_allowance int not null default 1,
  created_at timestamptz default now()
);

-- participants
create table participants (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid references challenges on delete cascade,
  user_id uuid references auth.users,
  joined_at timestamptz default now(),
  unique (challenge_id, user_id)
);

-- check_ins  (günde bir; done|joker)
create table check_ins (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid references participants on delete cascade,
  challenge_id uuid references challenges on delete cascade,
  day_number int not null,
  type text not null check (type in ('done','joker')),
  created_at timestamptz default now(),
  unique (participant_id, day_number)
);

-- messages / reactions
create table messages (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid references challenges on delete cascade,
  user_id uuid references auth.users,
  day_number int not null,
  kind text not null default 'message' check (kind in ('message','system')),
  text text not null,
  created_at timestamptz default now()
);
create table message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references messages on delete cascade,
  user_id uuid references auth.users,
  emoji text not null,
  unique (message_id, user_id, emoji)
);

-- stakes
create table stakes (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid references challenges on delete cascade,
  mode text not null check (mode in ('direct','vote')),
  text text
);
create table stake_options (
  id uuid primary key default gen_random_uuid(),
  stake_id uuid references stakes on delete cascade,
  label text not null
);
create table stake_votes (
  id uuid primary key default gen_random_uuid(),
  option_id uuid references stake_options on delete cascade,
  user_id uuid references auth.users,
  unique (option_id, user_id)
);

-- nudges
create table nudges (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid references challenges on delete cascade,
  from_user uuid references auth.users,
  to_user uuid references auth.users,
  created_at timestamptz default now()
);

-- yeni kullanıcı → boş profil
create function public.handle_new_user() returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
```

> RLS politikalarını (üyelik bazlı okuma, kendi satırını yazma, invite_code ile public
> önizleme) tabloları kurduktan sonra ekle. Karmaşık okuma kuralları için
> `is_member(challenge_id)` gibi bir `security definer` yardımcı fonksiyon işini kolaylaştırır.
```

## Ek B — RLS politikaları (challenge oluşturma için ZORUNLU)

`challenges` insert 403 (`42501`) alıyorsan sebebi budur — RLS açık ama politika yok:

```sql
-- recursion'ı önlemek için security definer yardımcı
create or replace function public.is_member(cid uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from participants
    where challenge_id = cid and user_id = auth.uid()
  );
$$;

-- challenges
alter table challenges enable row level security;
create policy "insert own challenge" on challenges
  for insert with check (owner_id = auth.uid());
create policy "read own or member challenges" on challenges
  for select using (owner_id = auth.uid() or public.is_member(id));
create policy "owner updates challenge" on challenges
  for update using (owner_id = auth.uid());

-- participants
alter table participants enable row level security;
create policy "join as self" on participants
  for insert with check (user_id = auth.uid());
create policy "read co-participants" on participants
  for select using (public.is_member(challenge_id));

-- stakes
alter table stakes enable row level security;
create policy "owner writes stake" on stakes
  for insert with check (
    exists (select 1 from challenges c
            where c.id = challenge_id and c.owner_id = auth.uid())
  );
create policy "read member stakes" on stakes
  for select using (public.is_member(challenge_id));

-- check_ins (needed for the real check-in write — Faz 2 step "check-in gerçek")
alter table check_ins enable row level security;
create policy "insert own check-in" on check_ins
  for insert with check (
    exists (select 1 from participants p
            where p.id = participant_id and p.user_id = auth.uid())
  );
create policy "delete own check-in" on check_ins
  for delete using (
    exists (select 1 from participants p
            where p.id = participant_id and p.user_id = auth.uid())
  );
create policy "read co-participant check-ins" on check_ins
  for select using (public.is_member(challenge_id));
```

## Ek C — Join by code (E5) RPC'leri (ZORUNLU — join ekranı için)

Bir davet koduyla gelen kullanıcı henüz `participants`'ta yok, o yüzden normal RLS
altında challenge satırını okuyamaz (SELECT politikası owner/member şartlı).
Çözüm: minimal, güvenli bilgi döndüren iki `security definer` RPC — tüm tabloyu
açmadan yalnız önizleme + katılım için gereken alanları expose eder.

```sql
-- Public preview by invite code — anon + authenticated okuyabilir.
create or replace function public.get_challenge_preview(p_code text)
returns table (
  id uuid,
  title text,
  daily_action text,
  total_days int,
  start_date date,
  status text,
  stake_text text,
  participant_count int,
  sample_names text[]
) language sql security definer stable as $$
  select
    c.id, c.title, c.daily_action, c.total_days, c.start_date, c.status,
    (select s.text from stakes s where s.challenge_id = c.id limit 1) as stake_text,
    (select count(*)::int from participants p where p.challenge_id = c.id) as participant_count,
    (select array_agg(pr.name order by p.joined_at)
       from participants p join profiles pr on pr.id = p.user_id
       where p.challenge_id = c.id limit 5) as sample_names
  from challenges c
  where c.invite_code = p_code
  limit 1;
$$;
grant execute on function public.get_challenge_preview(text) to anon, authenticated;

-- Join by code — idempotent participant insert, code is the only key needed.
create or replace function public.join_challenge_by_code(p_code text)
returns uuid language plpgsql security definer as $$
declare
  v_challenge_id uuid;
begin
  select id into v_challenge_id from challenges where invite_code = p_code;
  if v_challenge_id is null then
    raise exception 'Davet kodu bulunamadı';
  end if;

  insert into participants (challenge_id, user_id)
  values (v_challenge_id, auth.uid())
  on conflict (challenge_id, user_id) do nothing;

  return v_challenge_id;
end;
$$;
grant execute on function public.join_challenge_by_code(text) to authenticated;
```

> Not: `join/[code]` route'u şu an `_layout.tsx` guard'ında `(auth)` grubunda değil,
> yani oturumsuz biri davet linkine tıklarsa önce `/welcome`'a düşer (kod kaybolur).
> Gerçek deep-link-before-auth akışı (E5'e önce, onboarding'e sonra) ayrı bir iş —
> şimdilik "signed in (anon dahil) + code" akışı çalışıyor.

> Not: create sonrası `.select('id, invite_code')` çalışsın diye `challenges` SELECT
> politikasında `owner_id = auth.uid()` şart (insert anında henüz participant yoksun).

## Ek D — Sohbet RLS + Realtime (ZORUNLU — madde 7 için)

Mesaj/tepki/nudge artık gerçek Supabase'e yazılıyor (`useChallengeActions`).
RLS politikaları:

```sql
-- messages
alter table messages enable row level security;
create policy "insert own message" on messages
  for insert with check (user_id = auth.uid());
create policy "read member messages" on messages
  for select using (public.is_member(challenge_id));

-- message_reactions
alter table message_reactions enable row level security;
create policy "insert own reaction" on message_reactions
  for insert with check (user_id = auth.uid());
create policy "read member reactions" on message_reactions
  for select using (
    exists (select 1 from messages m
            where m.id = message_id and public.is_member(m.challenge_id))
  );

-- nudges
alter table nudges enable row level security;
create policy "insert own nudge" on nudges
  for insert with check (from_user = auth.uid());
create policy "read member nudges" on nudges
  for select using (public.is_member(challenge_id));
```

**Realtime'ı açman gerekiyor** — yoksa `postgres_changes` aboneliği hiç tetiklenmez.
Supabase Dashboard → **Database → Replication** → `supabase_realtime` publication'a
şu tabloları ekle (toggle ile), ya da SQL Editor'de:

```sql
alter publication supabase_realtime add table check_ins, messages, message_reactions, participants;
```

> Zaten "All tables" seçiliyse bu adıma gerek yok — dashboard'da kontrol et.

Detay ekranı artık her açılışta bir `postgres_changes` kanalına abone oluyor
(`useRealtimeChallenge`): biri check-in yapınca, katılınca, mesaj/tepki atınca
diğer cihazlar **pull-to-refresh'e gerek kalmadan** otomatik güncelleniyor.

## Ek E — Co-participant profil okuma (ZORUNLU — "Katılımcı" fallback'i için)

`profiles` üzerindeki `"own profile"` politikası (`for all using (auth.uid() = id)`)
yalnızca **kendi** profilini okumana izin veriyor. Katılımcı listesi, sohbet yazar
adları ve davet önizlemesi başka kullanıcıların `profiles.name`'ini okumaya çalıştığında
RLS bunu sessizce engelliyor — sorgu hata vermiyor, sadece o satırı döndürmüyor, bu
yüzden kodumuzdaki fallback (`'Katılımcı'`) devreye giriyor. Bu, aynı challenge'ı
paylaşan biri için ekle:

```sql
create policy "read co-participant profiles" on profiles
  for select using (
    exists (
      select 1 from participants p1
      join participants p2 on p1.challenge_id = p2.challenge_id
      where p1.user_id = auth.uid() and p2.user_id = profiles.id
    )
  );
```

Bu, mevcut `"own profile"` politikasının **yanına eklenir** (OR'lanır) — kendi
profilini okuma hâlâ çalışır, ayrıca seninle en az bir challenge'ı paylaşan
herkesin adını/baş harflerini de okuyabilirsin. Bunu çalıştırdıktan sonra
katılımcı listesindeki, sohbetteki ve davet önizlemesindeki "Katılımcı"
yer tutucuları gerçek isimlere döner (uygulamayı yeniden açmana gerek yok —
sıradaki fetch'te otomatik gelir).

## Ek F — Check-in Edge Function (madde 7'nin en kritik parçası)

**Neden gerekli:** Şu ana kadar check-in'in `day_number`'ı **istemci tarafından**
hesaplanıp gönderiliyordu (telefonun/tarayıcının yerel saatine göre). Teoride biri
uygulamayı değiştirip herhangi bir günü işaretleyebilir, ya da telefon saatini
oynayabilir. Bu Edge Function, `day_number`'ı **sunucuda**, challenge'ın kendi
`start_date` + `timezone`'una göre hesaplayıp doğruluyor — istemciye artık hiç
güvenmiyoruz. Joker hakkı ve "gerçekten kaçırılmış mı" kontrolü de sunucuda.

Kod zaten repoda: [`supabase/functions/check-in/index.ts`](../supabase/functions/check-in/index.ts).
İstemci tarafı (`src/data/checkins.ts`, `src/hooks/index.ts`) bu fonksiyonu
`supabase.functions.invoke('check-in', ...)` ile çağıracak şekilde **zaten güncellendi** —
tek eksik, fonksiyonu senin Supabase projene **deploy etmen**.

### Deploy adımları

1. Supabase CLI'ı kur (bir kere):
   ```powershell
   npm install -g supabase
   ```
2. Giriş yap ve projeni bağla (proje ref'i Dashboard → Project Settings → General'da):
   ```powershell
   supabase login
   supabase link --project-ref <PROJECT_REF>
   ```
   (`D:\theChallange` klasöründe çalıştır — `supabase/functions/check-in` zaten orada.)
3. Deploy et:
   ```powershell
   supabase functions deploy check-in
   ```
   `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` ortam değişkenleri
   Supabase tarafından fonksiyona **otomatik** enjekte edilir — elle bir secret
   ayarlaman gerekmiyor.
4. JWT doğrulaması varsayılan olarak **açık** kalmalı (`--no-verify-jwt` **kullanma**) —
   yalnızca giriş yapmış kullanıcıların çağırabilmesini istiyoruz; `supabase.functions.invoke()`
   zaten aktif oturumun token'ını otomatik ekliyor.

### Deploy sonrası

Kod tarafında değişiklik gerekmiyor — check-in/joker butonlarına basınca istemci
otomatik olarak bu fonksiyonu çağıracak. Hata mesajları artık gerçekten sunucudan
geliyor (`"Joker hakkın kalmadı."`, `"Bu challenge henüz başlamadı."` gibi) —
`errMessage()` / `FunctionsHttpError` üzerinden okunuyor.

> Not: `check_ins` tablosundaki mevcut RLS politikaları (Ek B) hâlâ duruyor ve
> zararsız — Edge Function `service_role` ile yazdığı için onları bypass ediyor,
> ama tabloyu doğrudan (fonksiyon dışından) yazmaya çalışan biri için hâlâ geçerli
> bir güvenlik katmanı.

## Ek G — restart / endEarly RPC'leri (madde 5'in son mock-only aksiyonları)

E10 Momentum sheet'indeki "Yeniden başlat" / "Erken bitir" artık gerçek Supabase'e
yazıyor. Genel bir `UPDATE` RLS politikası yerine (ki bu, bir katılımcının title/owner
gibi alakasız alanları da değiştirebilmesi anlamına gelirdi) iki dar RPC kullanıyoruz —
yalnızca `start_date`+`status` ya da yalnızca `status` günceller:

```sql
create or replace function public.restart_challenge(p_challenge_id uuid)
returns void language plpgsql security definer as $$
begin
  if not public.is_member(p_challenge_id) then
    raise exception 'Bu challenge''in üyesi değilsin.';
  end if;
  update challenges
  set start_date = current_date, status = 'active'
  where id = p_challenge_id;
end;
$$;
grant execute on function public.restart_challenge(uuid) to authenticated;

create or replace function public.end_challenge_early(p_challenge_id uuid)
returns void language plpgsql security definer as $$
begin
  if not public.is_member(p_challenge_id) then
    raise exception 'Bu challenge''in üyesi değilsin.';
  end if;
  update challenges set status = 'completed' where id = p_challenge_id;
end;
$$;
grant execute on function public.end_challenge_early(uuid) to authenticated;
```

> ⚠️ Bilinen eksik: E9 (Bitiş & Kutlama) ekranındaki `finishStats` (kişi/check-in/
> tamamlama %) ve katılımcı sıralaması hâlâ yalnızca **mock arşiv verisinde**
> (`archive1`) dolu geliyor — gerçek bir challenge'ı `endEarly` ile bitirince o
> istatistikler henüz `check_ins`'ten hesaplanmıyor. Ayrı bir iş olarak bırakıldı.

## Ek H — EAS Build çökme sorunu (ZORUNLU — TestFlight için)

**Neydi:** `.env` doğru şekilde git'e dahil değil (bu doğru — sırlar commit'lenmemeli).
Ama EAS Build bulutta senin repo'nun **git kopyasını** kullanıyor; `.env` orada hiç yok.
Sonuç: `EXPO_PUBLIC_SUPABASE_URL`/`KEY` build sırasında boş string olarak geliyordu,
`createClient('', '')` de **senkron olarak fırlıyordu** (`"supabaseUrl is required."`).
Bu, `src/lib/supabase.ts` modül yüklenirken (React hiç mount olmadan) çalıştığı için
uygulama açılışta anında çöküyordu — TestFlight'ta gördüğün tam olarak buydu.

**Kod tarafında ne yapıldı (zaten yapıldı, senin bir şey yapmana gerek yok):**
`src/lib/supabase.ts`, gerçek env değişkenleri yoksa artık zararsız bir placeholder
URL/key kullanıyor — `createClient` asla fırlamıyor. Uygulama artık **hiçbir zaman**
bu yüzden çökmeyecek; env değişkenleri eksikse sadece mock moda düşecek (`isSupabaseConfigured=false`).
`eas.json` da repoya eklendi (development/preview/production build profilleri, her biri
kendi EAS "environment"ına bağlı).

### Senin yapman gereken (gerçek Supabase'e bağlı bir build için ZORUNLU)

Çökme artık imkansız, ama **gerçek veriyle çalışan bir TestFlight build'i** istiyorsan
Supabase URL/key'in EAS'a da tanıtılması lazım — yoksa uygulama sessizce mock modda çalışır
(çökmez ama Supabase'e hiç bağlanmaz). İki değişkeni EAS'a ekle:

```powershell
npx eas-cli env:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://hyzowqwjqoxuqvzwxmml.supabase.co" --visibility plaintext --environment production
npx eas-cli env:create --scope project --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value "sb_publishable_..." --visibility plaintext --environment production
```

- `--environment production` → `eas.json`'daki `build.production.environment` ile eşleşiyor.
  `preview`/`development` profillerini de kullanacaksan aynı komutları `--environment preview`
  ve `--environment development` ile de çalıştır (ya da `eas env:create` sırasında "hangi
  environment'lar" diye soran interaktif moda "hepsi" de).
- Değerleri Supabase Dashboard → Project Settings → API'den al (Project URL + Publishable/anon key)
  — bunlar zaten `.env` dosyanda var, oradan kopyalayabilirsin.
- `--visibility plaintext` yeterli, bunlar **public** anahtarlar (RLS zaten gerçek korumayı sağlıyor) —
  service role key'i **asla** buraya veya istemci koduna koyma.

Ekledikten sonra tekrar build al:
```powershell
npx eas-cli build --platform ios --profile production
```

Yeni build'de uygulama artık gerçek Supabase'e bağlanacak. Doğrulamak için: build bitince
cihazda aç, Welcome → giriş → onboarding akışının çalıştığını gör (mock modda kalsaydı da
UI aynı görünürdü, ama `git ls-files` ile göremeyeceğin şekilde arka planda gerçek ağ
isteği gitmiyor olurdu — emin olmak istersen cihazı Mac'e bağlayıp Safari Web Inspector'dan
ya da Xcode Console'dan ağ loglarına bakabilirsin).

## Ek I — Push Bildirimleri (Faz 3A-1)

**İstemci tarafı (kod, zaten yapıldı):** `expo-notifications` kuruldu, onboarding'e
bir izin adımı eklendi (O5 "Grubun seni dürtebilsin"), `useSyncPushToken()`
(`src/hooks/useAuth.ts`) her açılışta token'ı tazeleyip `profiles.push_token`'a
yazıyor, ve bildirime dokununca `app/_layout.tsx`'teki `useNotificationDeepLink()`
`halkora://challenge/{id}`'ye yönlendiriyor. Geriye şunlar kalıyor:

### 1. Şema

`push_token` **`profiles`'ta değil ayrı bir tabloda** — "co-participant
profiles" politikası (Ek E) satırın TÜM kolonlarını okutuyor, yani token
`profiles`'ta kalsaydı aynı challenge'ı paylaştığın herkes onu okuyup senin
adına push gönderebilirdi. Sadece sahibinin okuyup yazabildiği ayrı bir
tabloya taşındı:

```sql
create table if not exists push_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token text not null,
  updated_at timestamptz not null default now()
);
alter table push_tokens enable row level security;
create policy "own push token" on push_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table profiles add column if not exists last_reminder_date date;
```

> ⚠️ Daha önce `profiles.push_token` kolonunu eklediysen (bu dokümanın önceki
> bir sürümünde önerilmişti): `alter table profiles drop column if exists push_token;`
> ile kaldır — istemci ve Edge Function'lar artık ona hiç yazmıyor/okumuyor.

`last_reminder_date` hassas değil (sadece bir tarih), `profiles`'ta kalması
zararsız — mevcut "own profile" politikası zaten kendi satırını güncellemene
izin veriyor.

### 2. Edge Function'ları deploy et + gizli anahtarı ayarla

İki fonksiyon var, ikisi de repoda hazır:
[`supabase/functions/notify`](../supabase/functions/notify/index.ts) (anlık —
check-in/mesaj/nudge) ve
[`supabase/functions/evening-reminder`](../supabase/functions/evening-reminder/index.ts)
(saatlik cron — "Halkan bekliyor"). İkisi de artık bir **paylaşılan sırla**
korunuyor — `--no-verify-jwt` ile deploy edildikleri için (çağıran taraf bir
kullanıcı değil, Supabase'in kendisi) bu olmadan URL'i bilen HERKES sahte
payload'la kullanıcılara push gönderebilirdi.

```powershell
# Rastgele, uzun bir sır üret (bir kere) ve HER İKİ fonksiyona da tanımla:
supabase secrets set WEBHOOK_SECRET=<uzun-rastgele-bir-değer>

supabase functions deploy notify --no-verify-jwt
supabase functions deploy evening-reminder --no-verify-jwt
```

Aşağıdaki DB Webhook'larda ve pg_net cron çağrısında **aynı** `WEBHOOK_SECRET`
değerini `x-webhook-secret` header'ı olarak eklemen gerekiyor — yoksa fonksiyon
her isteği 401 ile geri çevirir (bilerek "kapalı başlıyor": sır yoksa hiçbir
çağrıya güvenilmiyor).

### 3. `notify`'ı DB Webhook'larıyla bağla (Dashboard → Database → Webhooks)

Üç webhook oluştur, üçü de `notify` fonksiyonuna INSERT'te POST etsin:

| Webhook adı | Tablo | Event | URL |
|---|---|---|---|
| notify-checkin | `check_ins` | INSERT | `https://<PROJECT_REF>.supabase.co/functions/v1/notify` |
| notify-message | `messages` | INSERT | aynı URL |
| notify-nudge | `nudges` | INSERT | aynı URL |

Header olarak ikisini ekle:
- `Authorization: Bearer <SERVICE_ROLE_KEY>` (Dashboard'un webhook formu bunu zaten önerir)
- `x-webhook-secret: <WEBHOOK_SECRET>` (yukarıda `supabase secrets set` ile ayarladığın değer — **aynısı**)

`record` payload'ı otomatik gönderilir — kod tarafında ekstra bir şey ayarlamana gerek yok.

### 4. `evening-reminder`'ı saatlik çalıştır (pg_cron + pg_net)

Database → Extensions'tan `pg_cron` ve `pg_net`'i aç, sonra SQL Editor'de
(kendi project ref + service role key + `WEBHOOK_SECRET`'inle):

```sql
select cron.schedule(
  'evening-reminder-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/evening-reminder',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
      'x-webhook-secret', '<WEBHOOK_SECRET>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Fonksiyon kendi içinde her challenge'ın kendi timezone'una göre "şu an 20:00 mi"
kontrolü yapıyor, saatte bir tetiklenmesi yeterli — 20:00'i kaçıran timezone
olmuyor. `profiles.last_reminder_date` aynı gün içinde ikinci bir hatırlatmayı
engelliyor.

### 5. 🔑 Apple Developer — Push capability + APNs key (ZORUNLU, cihazda görmek için)

Kod ve backend hazır olsa da, gerçek bir cihazda bildirim **görünmesi** için:

1. Apple Developer → Certificates, IDs & Profiles → senin App ID'nde
   **Push Notifications** capability'sini aç.
2. Keys'ten yeni bir **APNs Auth Key** (.p8) oluştur, indir (bir kere indirilir).
3. `npx eas-cli credentials` → iOS → Push Notifications → bu key'i EAS'a yükle
   (EAS, Expo push servisinin arkasında bu key'i kullanarak APNs'e konuşuyor —
   ayrı bir push sunucusu kurmana gerek yok).
4. `expo prebuild` kullandığın için Xcode projesi yerelde üretiliyor — prebuild
   sonrası Xcode'da **Signing & Capabilities**'te Push Notifications'ın
   göründüğünü doğrula (app.json'daki `expo-notifications` plugin'i bunu
   otomatik ekliyor olması gerekir, ama bir build alıp kontrol et).
5. Yeni bir production build al (`npx eas-cli build --platform ios --profile production`) —
   Push capability'siz eski bir build'de bildirim **asla** gelmez.

> Not: Simülatörde push token asla alınamaz (`registerForPushToken()` bunu
> sessizce `null` döndürüp yutuyor) — gerçek cihazda test et.

## Ek J — Apple Sign-In + anonim hesap yükseltme (Faz 3A-3)

**İstemci tarafı (kod, zaten yapıldı):** `expo-apple-authentication` kuruldu,
`src/hooks/useAuth.ts`'teki `signInWithApple()` artık gerçek native Apple
girişini deniyor (iOS + capability yoksa/Android'de sessizce anonim girişe
düşüyor), `linkAppleIdentity()` mevcut anonim kullanıcıyı **aynı** user id'yi
koruyarak Apple'a bağlıyor (Ayarlar → "Hesap" satırı → `secureAccount()`).
Google butonu kaldırıldı — gerçekte anonim giriş yapıp Google gibi görünüyordu,
yanıltıcıydı (`docs/ROADMAP.md` Faz 3A-3'ün izin verdiği iki seçenekten biri).

Geriye şunlar kalıyor, hepsi 🔑 (senin hesap/dashboard işin):

### 1. Apple Developer

1. Certificates, IDs & Profiles → App ID'nde **"Sign in with Apple"**
   capability'sini aç.
2. Identifiers → Services IDs → yeni bir Service ID oluştur (Supabase'in Apple
   provider ayarında "Client ID" olarak bunu kullanacaksın).
3. Keys → yeni bir **Sign in with Apple key** (.p8) oluştur, indir (bir kere
   indirilir) — Supabase'e "Client Secret" üretmek için lazım.

### 2. Supabase Dashboard → Authentication → Providers → Apple

- Yukarıdaki Service ID + Key ile Apple provider'ı etkinleştir (Supabase'in
  kendi Apple provider ekranı hangi alanları isteyeceğini adım adım gösteriyor:
  Team ID, Key ID, Service ID, .p8 içeriği).
- **Authentication → Settings → "Allow manual linking"**'i aç — `linkIdentity()`
  bu ayar kapalıyken hata döner, anonim→Apple yükseltmesi bu yüzden şart.

### 3. `app.json` / native

- `expo-apple-authentication` kendi config plugin'ini otomatik uyguluyor
  (Sign in with Apple entitlement'ı prebuild sırasında ekleniyor) — elle bir
  şey eklemen gerekmiyor.
- Yeni bir production build al; eski bir build'de capability yoksa
  `AppleAuthentication.isAvailableAsync()` `false` döner ve kod otomatik
  anonim girişe düşer (çökme yok, ama gerçek Apple girişi de olmaz).

### 4. Doğrulama

Gerçek cihazda: Welcome → "Apple ile devam et" → sistem Apple sheet'i açılmalı
(simülatörde de açılır ama gerçek bir Apple ID gerektirir). Ayarlar → "Hesap"
satırında anonim bir kullanıcı için "Güvence yok" görünür ve dokununca aynı
sheet açılıp bağlandıktan sonra "Apple ile bağlı"ya döner — uygulamayı silip
tekrar kursan bile aynı challenge'lar geri gelir (artık anonim değilsin).
