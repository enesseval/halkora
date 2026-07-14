# Halkora — Prod Öncesi YAPILACAKLAR (senin tarafın 🔑)

> Bu dosya, koddan bağımsız olarak **senin** yapman gereken tüm manuel adımların
> tek konsolide listesi. Detaylı SQL blokları ve ekran görüntülü anlatımlar
> `docs/PHASE2-SUPABASE.md`'de (Ek referansları aşağıda). Bir adımı bitirince
> kutucuğu işaretle — bu dosya repo'da kalıcı, her oturumda buradan devam ederiz.
>
> ✅ **DB denetimi yapıldı (14 Tem 2026)** — `docs/db-audit.sql` çıktısı
> incelendi. Zaten canlıda olanlar aşağıda işaretli; eksik çıkan HER ŞEY tek
> dosyada toplandı: **`docs/db-fixes.sql`**.

---

## 1. Supabase — SQL Editor

- [ ] **`docs/db-fixes.sql`'i baştan sona çalıştır** — denetimde eksik çıkan
      her şey tek dosyada, idempotent:
  - `profiles.locale` kolonu (⚠️ Edge Function deploy'undan ÖNCE — yoksa push kırılır)
  - Davet kodu default'u hâlâ 6 karakter → 10'a çıkarma (Ek K §2)
  - Nudge "günde 1" unique index'i canlıda yok → spam hâlâ mümkün (Ek K §1)
  - `join_challenge_by_code` / `restart_challenge` / `end_challenge_early`
    hâlâ Türkçe prose fırlatıyor → hata kodu versiyonları (Ek G + Ek M §2)
  - 🐛 `stakes`'e SELECT politikası (denetimin bulduğu gerçek bug: RLS
    yüzünden bahis metni gerçek modda hiç görünmüyordu)
  - Mesaj/nudge/tepki insert politikalarına üyelik şartı + `participants`
    doğrudan insert'ini kurucuyla sınırlama (join-penceresi bypass'ı kapanıyor)
  - FK index'leri, `status` CHECK'i, SECURITY DEFINER'lara `search_path`

Denetimde canlıda ZATEN DOĞRU çıkanlar (bir şey yapmana gerek yok):
- [x] `push_tokens` tablosu + RLS + `profiles.last_reminder_date` (Ek I §1)
- [x] `first_day_join_only` kolonu + güncel `get_challenge_preview` (Ek M)
- [x] `handle_new_user` trigger'ı, `is_member`, tüm tablolarda RLS açık
- [x] pg_cron + pg_net açık, `evening-reminder-hourly` cron'u kurulu ve aktif

## 1,5. Supabase — @kullanıcıadı sistemi (Faz 3C madde 1, yeni)

- [ ] **`docs/db-username.sql`'i SQL Editor'de baştan sona çalıştır** —
      `reserved_usernames` tablosu, `profiles.username` kolonu + format/
      benzersizlik kısıtları, rezerve-isim trigger'ı, `set_username` ve
      `find_user_by_username` RPC'leri. Detay: `docs/PHASE2-SUPABASE.md`
      "Ek O". Deploy gerekmiyor — istemci kodu zaten `main`'de, bu SQL
      çalışınca özellik anında aktif olur.
- [ ] Çalıştırdıktan sonra hızlı doğrulama: Ayarlar → "Kullanıcı adı" satırı
      artık `@` ile bir değer göstermeli (onboarding'de otomatik atanmış
      olmalı); satıra dokunup değiştirmeyi dene, rezerve bir isim (`admin`
      gibi) veya zaten alınmış bir isim denenince anlamlı hata görmelisin.
- [ ] **`docs/db-invites.sql`'i SQL Editor'de çalıştır** (Faz 3C madde 2 —
      handle ile davet) — `invites` tablosu + RLS. Detay: `docs/PHASE2-SUPABASE.md`
      "Ek O2".
- [ ] **Dashboard → Database → Webhooks'a 4. bir webhook ekle**: tablo
      `invites`, event `INSERT`, mevcut 3 webhook'la (Ek I §3) AYNI URL ve
      header'lar (`Authorization: Bearer <SERVICE_ROLE_KEY>` +
      `x-webhook-secret: <WEBHOOK_SECRET>`).
- [ ] Davet ekranında (`/challenge/{id}/invite`) "Kullanıcı adıyla davet et"
      alanı görünmeli (gerçek modda) — bir @handle yazıp gönder, ikinci bir
      hesapla/cihazla bildirim gelip gelmediğini doğrula.

## 2. Supabase — Edge Functions (CLI)

- [x] `WEBHOOK_SECRET` tanımlı (webhook + cron header'larında doğrulandı)
- [ ] **4 fonksiyonu da YENİDEN deploy et** — dördünün de kodu değişti (i18n
      hata kodları + dile göre push + `evening-reminder`'ın status filtresi
      düzeltmesi). ⚠️ Önce `db-fixes.sql` (locale kolonu), sonra deploy:
      ```powershell
      supabase functions deploy notify --no-verify-jwt
      supabase functions deploy evening-reminder --no-verify-jwt
      supabase functions deploy check-in
      supabase functions deploy delete-account
      ```

## 3. Supabase — Dashboard ayarları

- [x] 3 DB Webhook kurulu (`notify-checkin` / `notify-message` / `notify-nudge`,
      secret header'lı) — denetimde trigger olarak doğrulandı.
- [x] Realtime: `messages` publication'da (bonus: check_ins / reactions /
      participants da ekli).
- [ ] **Auth → URL Configuration**: redirect URL'e `halkora://` ekli mi teyit et
      (şema `thechallenge`'dan `halkora`'ya değişti — dashboard'da eskisi kalmış olabilir).
- [ ] **API rate limit** ayarlarının açık olduğunu doğrula (Settings → API) —
      `get_challenge_preview` herkese açık RPC (Ek K §2 notu).
- [ ] 🔐 **Not:** denetim çıktısında service role key + webhook secret görünüyor
      (webhook tanımları bunları header olarak taşıyor, normal) — o çıktıyı
      herkese açık bir yere yapıştırma. Paylaştıysan: Dashboard'dan JWT secret
      rotasyonu yap ve webhook/cron header'larını yeni key'le güncelle.

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

## 7,5. Test modu: 1 dakikalık günler (geçici, prod'a ÇIKMADAN KAPAT)

Challenge döngüsünü hızlı test etmek için "1 gün = 1 dakika" modu eklendi
(`src/lib/fastDays.ts`). İki tarafı BİRLİKTE aç/kapat:

- [ ] **Aç (istemci):** `.env`'e `EXPO_PUBLIC_FAST_DAYS=1` ekle, dev server'ı
      yeniden başlat (EAS build'de test edeceksen aynı değişkeni
      `--environment preview`'a da ekle).
- [ ] **Aç (sunucu):** `supabase secrets set FAST_DAYS=1` +
      `supabase functions deploy check-in`
- [ ] **Kapat (test bitince, prod build ÖNCESİ):** `.env`'den satırı sil,
      `supabase secrets unset FAST_DAYS` + `check-in`'i tekrar deploy et.

Bilinen test-modu tuhaflıkları (kabul edildi, prod'a hiç çıkmıyor):
"Yarın başla" ve "sadece ilk gün katılım" penceresi gerçek takvimle çalışmaya
devam eder (SQL tarafında hız modu yok); akşam hatırlatması dakika-günlere
uymaz. Gün çapası `created_at` olduğu için "Yeniden başlat" hızlı modda
challenge'ı 1. güne değil, oluşturulmasından bu yana geçen dakikaya döndürür.

## 8. Opsiyonel ama şiddetle önerilen (prod'a çıkmadan)

- [ ] **Sentry** hesabı aç (ücretsiz tier yeter) — DSN'i ver, `@sentry/react-native`
      entegrasyonunu ben yaparım. TestFlight'ta bir kez "sessiz çökme" yaşandı;
      prod'da crash görünürlüğü olmadan uçmak riskli.
- [ ] Sosyal handle'lar (@halkora) + Türk Patent / USPTO hızlı marka taraması.

---

*Kod tarafında yapılacaklar bu dosyada değil — onlar için `docs/ROADMAP.md`
ve oturum içi görev listesi. Bu dosyadaki her şey hesap/dashboard/cihaz işi.*
