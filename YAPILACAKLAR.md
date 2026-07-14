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

## 0. Yerel test artık Expo Go'da ÇALIŞMIYOR — development build şart

`@react-native-picker/picker` + `expo-blur` eklendi (native modüller) — Expo
Go (App Store'daki genel uygulama) yalnızca Expo'nun kendi resmi modül
setini çalıştırabiliyor, üçüncü parti/bazı native modüllerle kırmızı ekran
verip çöküyor. `expo-notifications`'ın Android'de zaten Expo Go'da tam
çalışmadığı (yalnızca uyarı veriyordu) noktadan, artık gerçek bir çökmeye
geldik.

- [ ] `npx eas-cli build --platform ios --profile development` — bir kere
      çalıştır, EAS'ın bulutunda derlenir (Mac gerekmez, Windows'tan çalışır).
      Bitince EAS bir kurulum linki verir, telefona kur.
- [ ] Bundan sonra `npx expo start --dev-client` ile başlat, projeyi
      **Expo Go değil, az önce kurduğun özel uygulamadan** aç.
- [ ] Yalnızca JS/TS değişikliklerinde (ekran, mantık, metin) bu build'i
      tekrar almana gerek yok — fast refresh çalışır. Yeni bir native modül
      eklendiğinde (yeni `expo-*` paketi veya üçüncü parti native paket)
      dev build'i tekrar almak gerekir — böyle bir değişiklik yaptığımda
      ayrıca söylerim.

## 1. Supabase — SQL Editor

- [x] **`docs/db-fixes.sql`'i baştan sona çalıştır** — denetimde eksik çıkan
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

- [x] **`docs/db-username.sql`'i SQL Editor'de baştan sona çalıştır** —
      `reserved_usernames` tablosu, `profiles.username` kolonu + format/
      benzersizlik kısıtları, rezerve-isim trigger'ı, `set_username` ve
      `find_user_by_username` RPC'leri. Detay: `docs/PHASE2-SUPABASE.md`
      "Ek O". Deploy gerekmiyor — istemci kodu zaten `main`'de, bu SQL
      çalışınca özellik anında aktif olur.
- [ ] Çalıştırdıktan sonra hızlı doğrulama: Ayarlar → "Kullanıcı adı" satırı
      artık `@` ile bir değer göstermeli (onboarding'de otomatik atanmış
      olmalı); satıra dokunup değiştirmeyi dene, rezerve bir isim (`admin`
      gibi) veya zaten alınmış bir isim denenince anlamlı hata görmelisin.
- [x] **`docs/db-invites.sql`'i SQL Editor'de çalıştır** (Faz 3C madde 2 —
      handle ile davet) — `invites` tablosu + RLS. Detay: `docs/PHASE2-SUPABASE.md`
      "Ek O2".
- [x] **Dashboard → Database → Webhooks'a 4. bir webhook ekle**: tablo
      `invites`, event `INSERT`, mevcut 3 webhook'la (Ek I §3) AYNI URL ve
      header'lar (`Authorization: Bearer <SERVICE_ROLE_KEY>` +
      `x-webhook-secret: <WEBHOOK_SECRET>`).
- [ ] Davet ekranında (`/challenge/{id}/invite`) "Kullanıcı adıyla davet et"
      alanı görünmeli (gerçek modda) — bir @handle yazıp gönder, ikinci bir
      hesapla/cihazla bildirim gelip gelmediğini doğrula.
- [x] **`docs/db-owner-settings.sql`'i SQL Editor'de çalıştır** (Faz 3C madde
      3 — kurucu ayarları) — `update_challenge_details` RPC'si. Detay:
      `docs/PHASE2-SUPABASE.md` "Ek O3". Deploy yok.
- [ ] Çalıştırdıktan sonra doğrulama: kurduğun bir halkanın Detay ekranında
      sağ üstte ⚙️ görünmeli, başlık/günlük eylem/bahis metnini değiştirip
      kaydedebilmelisin; kurmadığın bir halkada ⚙️ hiç görünmemeli.

## 2. Supabase — Edge Functions (CLI)

- [x] `WEBHOOK_SECRET` tanımlı (webhook + cron header'larında doğrulandı)
- [x] **4 fonksiyonu da YENİDEN deploy et** — dördünün de kodu değişti (i18n
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
- [x] **Auth → URL Configuration**: redirect URL'e `halkora://` ekli mi teyit et
      (şema `thechallenge`'dan `halkora`'ya değişti — dashboard'da eskisi kalmış olabilir).
- [x] ~~API rate limit ayarlarının açık olduğunu doğrula (Settings → API)~~ —
      **düzeltme:** bu yanlış bir yönlendirmeydi, Supabase Dashboard'da
      `get_challenge_preview` gibi herkese açık RPC'ler için genel amaçlı bir
      "API rate limit" toggle'ı **yok**. Dashboard'daki tek rate-limit paneli
      Authentication → Rate Limits — o da yalnızca auth uçlarını (OTP/e-posta
      gönderimi, kayıt, token yenileme) kapsıyor, RPC çağrılarını değil. Yani
      kontrol edecek bir yer yok; brute-force koruması tamamen Ek K §2'de
      yapılan kod alanı genişletmesine (10 hex karakter, ~1 trilyon
      kombinasyon) dayanıyor — bu, gerçekçi hiçbir saldırı hızında pratikte
      taranamayacak kadar büyük, ekstra bir dashboard ayarına ihtiyaç yok.
- [x] 🔐 **Not:** denetim çıktısında service role key + webhook secret görünüyor
      (webhook tanımları bunları header olarak taşıyor, normal) — o çıktıyı
      herkese açık bir yere yapıştırma. Paylaştıysan: Dashboard'dan JWT secret
      rotasyonu yap ve webhook/cron header'larını yeni key'le güncelle.

## 4. Apple Developer ($99/yıl hesap)

- [ ] ⚠️ **Bundle ID kesinleşti: `com.halkora.app`** — app.json güncellendi
      (hem `ios.bundleIdentifier` hem `android.package`). Şu an TestFlight'ta
      olan build `com.anonymous.halkora` ile atılmıştı (Expo'nun literal
      fallback placeholder'ı — kalıcı olması hiç mantıklı değildi, bu yüzden
      şimdi, henüz App Store'da canlıya çıkmadan değiştiriyoruz). Geçiş
      adımları:
  - [ ] Apple Developer → Certificates, IDs & Profiles → Identifiers'da
        **yeni bir App ID** kaydet: `com.halkora.app`. Eski
        `com.anonymous.halkora` kaydını silmene gerek yok, dursun.
  - [ ] App Store Connect'te **yeni bir app kaydı** oluştur, bu yeni Bundle
        ID'yi seç (App Store Connect'teki bir app kaydı hangi bundle ID ile
        oluşturulduysa ona kilitleniyor — eski kaydı yeni ID'ye çeviremeyiz).
  - [ ] `npx eas-cli build --platform ios --profile production` ile yeni bir
        build al (prebuild yeni `bundleIdentifier`'ı otomatik alır, elle bir
        şey yapmana gerek yok) → yeni App Store Connect kaydına submit et.
  - [ ] TestFlight test kullanıcılarını yeni app kaydına tekrar davet et —
        eski `com.anonymous.halkora` build'i/app kaydı artık kullanılmayacak,
        silmek zorunda değilsin, sessizce terk edebilirsin.
- [ ] Yeni App ID'de (`com.halkora.app`) **Push Notifications** capability +
      **APNs Auth Key (.p8)** oluştur → `npx eas-cli credentials` ile EAS'a
      yükle (Ek I §5).
- [ ] Yeni App ID'de **Sign In with Apple** capability (primary) + Supabase
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
