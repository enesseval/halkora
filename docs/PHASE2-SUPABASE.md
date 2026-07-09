# Faz 2 — Supabase + Auth + Onboarding Checklist

> Faz 1 mimarisi buna hazır: tüm veri erişimi `src/hooks/index.ts` arkasında.
> Faz 2'de **sadece** o katmanın içi (`src/stores/mockStore.ts` → Supabase sorguları)
> değişecek; ekranların hook imzaları aynı kalacak.

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

- [ ] supabase.com → yeni proje oluştur, **Project URL** ve **anon public key**'i not al.
- [ ] Auth → Providers: **Anonymous** aç (hızlı test için). **Email** opsiyonel.
- [ ] Auth → URL Configuration: redirect URL'e uygulama şeması ekle → `thechallenge://`
      (app.json'da `scheme: "thechallenge"` zaten var).

## 2. Şema + RLS (SQL Editor'de çalıştır)

- [ ] Tabloları oluştur (özet — tam SQL aşağıda "Ek A"):
  - `profiles(id→auth.users, name, initials)`
  - `challenges(id, owner_id, title, daily_action, total_days, start_date, timezone, status, invite_code UNIQUE, joker_allowance)`
  - `participants(challenge_id, user_id, UNIQUE(challenge_id,user_id))`
  - `check_ins(participant_id, challenge_id, day_number, type∈{done,joker}, UNIQUE(participant_id,day_number))`
  - `messages(challenge_id, user_id, day_number, kind∈{message,system}, text)`
  - `message_reactions(message_id, user_id, emoji, UNIQUE(message_id,user_id,emoji))`
  - `stakes(challenge_id, mode∈{direct,vote}, text)` + `stake_options(stake_id,label)` + `stake_votes(option_id,user_id UNIQUE)`
  - `nudges(challenge_id, from_user, to_user)`
- [ ] **RLS aç** (her tabloda `enable row level security`).
- [ ] Politikalar:
  - Bir kullanıcı **üyesi olduğu** challenge'ın satırlarını okuyabilir.
  - Kullanıcı **kendi** check_in / message / reaction / vote / nudge satırını yazabilir.
  - `invite_code` ile challenge önizlemesi herkese açık okunabilir (join ekranı için) —
    ya ayrı bir "public preview" view'ı, ya da güvenli bir RPC ile.
- [ ] `profiles` için: yeni `auth.users` eklendiğinde otomatik boş profil açan **trigger**
      (`on auth.users insert → create profile`).

## 3. İstemci entegrasyonu (uygulamada)

- [ ] Paketler: `npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill`
- [ ] `.env` + `app.config` ile `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- [ ] **Yeni dosya `src/lib/supabase.ts`**: AsyncStorage'lı Supabase client (session persist).
- [ ] TanStack Query kur: `npm i @tanstack/react-query` → `app/_layout.tsx`'te `QueryClientProvider` ile sar.

## 4. Auth + Onboarding (senin asıl istediğin akış)

- [ ] **Yeni `src/hooks/useAuth.ts`** (veya store): session'ı dinle (`supabase.auth.onAuthStateChange`).
- [ ] `app/_layout.tsx`'te yönlendirme mantığı:
  - session yok → `(auth)/welcome` (E1)
  - session var + profil ismi yok → **onboarding: isim iste** (yeni ekran `app/(auth)/onboarding.tsx`)
  - session var + isim var → `(main)` (Home)
- [ ] **E1 Welcome** butonları:
  - [ ] "Apple ile devam et" → (şimdilik) `signInAnonymously()`, sonra dev build'de gerçek Apple.
  - [ ] (opsiyonel) "İsimle hızlı başla" → anonim giriş.
- [ ] **Onboarding ekranı**: tek input "Adın" + Devam → `profiles.name` güncelle → Home.
      (İleride buraya değer önerisi / kısa tur eklersin — "onu hallederiz" dediğin kısım.)

## 5. Mock → Supabase geçişi (hook hook)

`src/hooks/index.ts` imzaları AYNI kalır; içleri Supabase/Query olur:

- [ ] `useTodayStatus()` → `challenges` + bugünkü `check_ins` join eden Query.
- [ ] `useChallenge(id)` → tek challenge + participants + messages Query.
- [ ] `useCheckIn(id)` → **optimistic mutation** (`check_ins` insert, `day_number`'ı sunucu doğrular).
- [ ] `useChallengeActions(id)` → sendMessage/react/nudge/useJoker/restart/endEarly = ilgili insert/update mutation'ları.
- [ ] `useCreateChallenge()` → `challenges` insert (owner = ben) + `participants` insert (ben) + stake insert.
- [ ] `useJoin()` → `invite_code`'dan challenge bul + `participants` insert (ben).
- [ ] Bittiğinde `src/stores/mockStore.ts` ve `src/data/mock.ts` kaldırılabilir.

## 6. Create / Join akışları (uçtan uca)

- [ ] Create (E3) bitince gerçek `invite_code` üret (DB default: `gen_random_uuid` kısaltması) → E4 Davet.
- [ ] E4 "Daveti paylaş" linki: `https://thechallenge.app/j/{invite_code}` **+** `thechallenge://join/{invite_code}` deep link.
- [ ] `join/[code]` (E5): koddan önizleme (public read) → "Katıl" → participant ekle → Detay.
- [ ] app.json `scheme` + (ileride) Universal Links / App Links kurulumu.

## 7. Realtime + Edge Functions + Push

- [ ] **Realtime**: sohbet mesajları ve check-in'ler için `supabase.channel().on('postgres_changes')` → Query invalidate.
- [ ] **Edge Function `check-in`**: `day_number`'ı challenge `start_date` + `timezone`'a göre sunucuda hesapla,
      "günde bir" ve joker kuralını doğrula (istemciye güvenme).
- [ ] **Edge Function `join`** (opsiyonel): koddan güvenli katılım.
- [ ] **Push**: `npx expo install expo-notifications` → token'ı `profiles`'a yaz →
      DB trigger/function ile "herkes bekliyor / X tamamladı" bildirimi. (Push da dev build ister.)

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
