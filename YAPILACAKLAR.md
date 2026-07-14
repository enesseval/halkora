# Halkora — Prod Öncesi YAPILACAKLAR (senin tarafın 🔑)

> Bu dosya, koddan bağımsız olarak **senin** yapman gereken tüm manuel adımların
> tek konsolide listesi. Detaylı SQL blokları ve ekran görüntülü anlatımlar
> `docs/PHASE2-SUPABASE.md`'de (Ek referansları aşağıda). Bir adımı bitirince
> kutucuğu işaretle — bu dosya repo'da kalıcı, her oturumda buradan devam ederiz.
>
> ⚠️ **Hangi SQL'lerin zaten çalıştırıldığını bilmiyoruz.** Önce
> `docs/db-audit.sql`'i SQL Editor'de çalıştırıp çıktısını paylaş — eksikleri
> netleştirip bu listeyi birlikte güncelleyeceğiz.

---

## 1. Supabase — SQL Editor

Sırası önemli değil, hepsi idempotent (`if not exists` / `create or replace`):

- [ ] **`push_tokens` tablosu + `last_reminder_date`** (Ek I §1) — push token'lar
      için ayrı, sahibine-özel tablo. Eski `profiles.push_token` kolonu varsa sil:
      `alter table profiles drop column if exists push_token;`
- [ ] **Nudge hız sınırı** (Ek K §1) — "aynı kişiye günde 1 nudge" unique index.
- [ ] **Davet kodu 10 karaktere çıkarma** (Ek K §2) — brute-force direnci.
- [ ] **`first_day_join_only` kolonu** (Ek M §1) — katılım penceresi özelliği.
- [ ] **`profiles.locale` kolonu** (Ek N §1) — dile göre push için ZORUNLU:
      ```sql
      alter table profiles add column if not exists locale text not null default 'tr';
      ```
- [ ] **RPC'leri yeniden çalıştır** (hepsi `create or replace`, drop gerekmez):
  - `join_challenge_by_code` (Ek M §2 — join penceresi + hata kodları)
  - `get_challenge_preview` (Ek M §3 — 10 karakterlik kod + `first_day_join_only`)
  - `restart_challenge` + `end_challenge_early` (Ek G — timezone düzeltmesi + hata kodları)
- [ ] **pg_cron + pg_net extension'larını aç** (Dashboard → Database → Extensions),
      sonra `evening-reminder` cron'unu kur (Ek I §4'teki `cron.schedule` SQL'i).

## 2. Supabase — Edge Functions (CLI)

- [ ] **`WEBHOOK_SECRET` üret ve tanımla** (bir kere):
      `supabase secrets set WEBHOOK_SECRET=<uzun-rastgele-değer>`
- [ ] **4 fonksiyonu da deploy et** (dördünün de kodu değişti — i18n hata kodları
      + dile göre push):
      ```powershell
      supabase functions deploy notify --no-verify-jwt
      supabase functions deploy evening-reminder --no-verify-jwt
      supabase functions deploy check-in
      supabase functions deploy delete-account
      ```

## 3. Supabase — Dashboard ayarları

- [ ] **3 DB Webhook** (Database → Webhooks): `check_ins` / `messages` / `nudges`
      INSERT → `notify` fonksiyonuna POST. Header'lar: `Authorization: Bearer
      <SERVICE_ROLE_KEY>` + `x-webhook-secret: <WEBHOOK_SECRET>` (Ek I §3).
- [ ] **Auth → URL Configuration**: redirect URL'e `halkora://` ekli mi teyit et
      (şema `thechallenge`'dan `halkora`'ya değişti — dashboard'da eskisi kalmış olabilir).
- [ ] **API rate limit** ayarlarının açık olduğunu doğrula (Settings → API) —
      `get_challenge_preview` herkese açık RPC (Ek K §2 notu).
- [ ] **Realtime**: `messages` tablosunun `supabase_realtime` publication'ında
      olduğunu doğrula (Ek D) — audit sorgusu bunu da gösterecek.

## 4. Apple Developer ($99/yıl hesap)

- [ ] **App ID**: `com.enesseval.halkora` olarak oluştur/güncelle
      (⚠️ app.json artık bu ID'yi kullanıyor — eski `com.anonymous.halkora`
      placeholder'ıydı, App Store'a bir kez çıkınca bundle ID değiştirilemez;
      farklı bir ID istiyorsan ŞİMDİ söyle, app.json'ı ona göre düzeltelim).
- [ ] App ID'de **Push Notifications** capability + **APNs Auth Key (.p8)**
      oluştur → `npx eas-cli credentials` ile EAS'a yükle (Ek I §5).
- [ ] App ID'de **Sign In with Apple** capability (primary) + Supabase
      Dashboard → Auth → Providers → Apple ayarları + "Allow manual linking" (Ek J).
- [ ] Associated Domains: build sonrası Xcode'da capability'nin göründüğünü doğrula.

## 5. EAS / Build

- [ ] **Supabase env'lerini EAS'a tanıt** (yoksa build sessizce mock modda çalışır — Ek H):
      ```powershell
      npx eas-cli env:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://<ref>.supabase.co" --visibility plaintext --environment production
      npx eas-cli env:create --scope project --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value "sb_publishable_..." --visibility plaintext --environment production
      ```
- [ ] Yeni production build: `npx eas-cli build --platform ios --profile production`
      (Push + Apple Sign-In + splash entitlement'ları ancak YENİ build'de aktif olur).
- [ ] Gerçek cihazda uçtan uca test: giriş → onboarding → create → davet linki →
      ikinci cihazdan join → check-in → push bildirimi geldi mi → dil değiştirme.

## 6. Domain + Web (davet linki için)

- [ ] **`halkora.app` domain'ini al** (~$12/yıl) — kodda davet linki
      `halkora.app/j/{kod}` yazıyor; domain alınmazsa linkler ölü.
- [ ] `web/j/index.html` + `web/_redirects`'i **Cloudflare Pages**'e deploy et.
- [ ] **`apple-app-site-association`** dosyasını domain köküne koy
      (Universal Links — yoksa link uygulamayı değil Safari'yi açar).
- [ ] Gerçek cihazda Universal Link testi: `https://halkora.app/j/<kod>` →
      uygulama açılıyor mu.

## 7. App Store / Yayın

- [ ] **Gizlilik politikası + kullanım koşulları** (anonim auth + push token
      topluyoruz — App Store zorunlu) → halkora.app'te barındır.
- [ ] App Store Connect: uygulama kaydı, metadata (TR + EN — uygulama artık
      iki dilli), ekran görüntüleri (6.7" + 6.1"), gizlilik etiketleri.
- [ ] **Hesap silme akışının çalıştığını** cihazda doğrula (App Store incelemesi
      bunu gerçekten test ediyor) — `delete-account` fonksiyonu deploy edilmiş olmalı.
- [ ] TestFlight'a yükle → küçük bir gerçek grupla 2-3 günlük smoke test.

## 8. Opsiyonel ama şiddetle önerilen (prod'a çıkmadan)

- [ ] **Sentry** hesabı aç (ücretsiz tier yeter) — DSN'i ver, `@sentry/react-native`
      entegrasyonunu ben yaparım. TestFlight'ta bir kez "sessiz çökme" yaşandı;
      prod'da crash görünürlüğü olmadan uçmak riskli.
- [ ] Sosyal handle'lar (@halkora) + Türk Patent / USPTO hızlı marka taraması.

---

*Kod tarafında yapılacaklar bu dosyada değil — onlar için `docs/ROADMAP.md`
ve oturum içi görev listesi. Bu dosyadaki her şey hesap/dashboard/cihaz işi.*
