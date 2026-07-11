# Halkora — Yol Haritası (Faz 3+)

> Faz 1 (ekranlar) ve Faz 2 (Supabase backend) bitti — bkz. `PHASE2-SUPABASE.md`.
> Bu doküman ürün analizinden çıkan önerilerin uygulanabilir hâli: retention,
> derinlik, para kazanma ve yayın.
>
> **Önemli bağlam değişikliği:** Artık Expo Go değil, `expo prebuild` + Xcode
> Archive ile build alınıyor. Yani eskiden "dev build ister" diye ertelediğimiz
> her şey (push, Apple Sign-In, widget) **artık önümüzde engel yok**.
>
> İşaretler: 🧑‍💻 = kodu ben yazarım · 🔑 = senin hesap/dashboard işin
> · 💰 = ücretli hesap/servis gerektirir

---

## 📍 Faz 0 — BUGÜN yapılacaklar (kod değil, kapış işi)

Bunlar kod işi değil ama geciktikçe risk büyüyor:

- [ ] 🔑 **Domain'leri kaydet: `halkora.com` + `halkora.app`** — RDAP kontrolünde
      ikisi de boştu ama bu her an değişebilir. (~$10-12/yıl, Cloudflare Registrar
      veya Porkbun öneririm.) `halkora.app` Universal Links için de lazım olacak.
      ⚠️ Kodda davet linki artık `halkora.app/j/{kod}` yazıyor — domain alınmazsa
      bu link ölü metin olarak kalır.
- [ ] 🔑 Sosyal handle'ları kapat (@halkora — Instagram/X/TikTok, ücretsiz).
- [ ] 🔑 Hızlı marka taraması: Türk Patent (turkpatent.gov.tr) + USPTO'da
      "halkora" araması — çakışma var mı 10 dakikada görülür.
- [x] İkon + isim rebrand'i (app.json `name/slug/scheme`, tüm ikon seti,
      welcome başlığı, davet linki) — tamamlandı.

---

## 🔥 Faz 3A — Lansman Engelleyiciler (retention temeli)

Sırayla — her biri bir öncekinin değerini katlıyor:

### 1. Push Bildirimleri (en yüksek etkili tek iş)

Grup uygulamasında sosyal döngü bildirimsiz çalışmaz. Üç bildirim tipi:

- [x] 🧑‍💻 `expo-notifications` kurulumu + izin akışı (onboarding sonrası,
      "grubun seni dürtebilsin" dilinde — iznin *neden* istendiği anlatılarak).
- [x] 🧑‍💻 Push token'ı `profiles` tablosuna yazma (`push_token` kolonu + migration
      SQL: `docs/PHASE2-SUPABASE.md` "Ek I" — SQL Editor'de çalıştırman gerekiyor).
- [x] 🧑‍💻 Supabase Edge Function `notify`: check_ins/messages/nudges insert'lerinde
      DB webhook → ilgili katılımcılara Expo Push API üzerinden gönderim.
  - "Zeynep tamamladı ✓" (check-in olunca gruba)
  - "El salla 👋 aldın" (nudge alıcıya — artık gerçekten bildirim gidiyor)
  - Akşam hatırlatması: "Halkan bekliyor" (`evening-reminder` fonksiyonu +
    pg_cron/pg_net saatli tarama, check-in yapmamışlara) — "Ek I"
- [ ] 🔑 Apple Developer'da Push capability + APNs key → Expo push credential
      (prebuild kullandığın için Xcode'da Push Notifications capability'sini
      Signing & Capabilities'ten eklemen gerekiyor) — deploy + dashboard adımları
      `docs/PHASE2-SUPABASE.md` "Ek I"'de.
- [x] 🧑‍💻 Bildirime dokununca doğru ekrana gitme (`halkora://challenge/{id}`).

### 2. Universal Links + Deep Link testi

Davet döngüsü şu an kopuk — link tıklanabilir değil:

- [ ] 🧑‍💻 `halkora://join/{kod}` custom scheme'in gerçek cihazda test edilmesi
      (kod tarafı hazır — web smoke test'te davet linki üretimi + create→invite
      akışı doğrulandı, ama gerçek cihaz/Universal Link testi yapılamadı, bunu
      sen yapmalısın).
- [ ] 🔑 `halkora.app` domain'ine `apple-app-site-association` dosyası koymak
      (statik hosting yeter — Cloudflare Pages ücretsiz; domain'in Faz 0'da
      henüz alınmadı, önce o gerekiyor).
- [x] 🧑‍💻 `app.json`'a `associatedDomains: ["applinks:halkora.app"]` eklendi +
      Android `intentFilters` (`/j/*`). 🔑 kalan: domain alındıktan + AASA
      hostlandıktan sonra bir prebuild+build alıp Xcode'da Associated Domains
      capability'sinin göründüğünü doğrula.
- [x] 🧑‍💻 Oturumsuz kullanıcı davet linkine tıklarsa: kodu sakla → auth/onboarding
      → sonra `join/{kod}`a düşür (`src/lib/pendingInvite.ts` +
      `app/_layout.tsx`'teki `useProtectedRoute()`).
- [x] 🧑‍💻 `halkora.app/j/{kod}` web fallback sayfası: `web/j/index.html` +
      `web/_redirects` (Cloudflare Pages'e deploy etmek 🔑 — domain lazım).

### 3. Apple Sign-In + anonim hesap bağlama

Anonim hesap kırılgan (uygulama silinirse her şey gider):

- [ ] 🔑 Apple Developer: App ID'ye "Sign in with Apple" capability + Service ID
      + Key → Supabase Auth → Apple provider ayarları + "Allow manual linking"
      (adım adım: `docs/PHASE2-SUPABASE.md` "Ek J").
- [x] 🧑‍💻 `expo-apple-authentication` + E1'de gerçek Apple butonu
      (`signInWithIdToken`) — capability kurulana kadar Android/simülatörde
      sessizce anonim girişe düşüyor, çökme yok.
- [x] 🧑‍💻 **Anonim → Apple yükseltme:** mevcut anonim kullanıcının verisini
      kaybettirmeden bağlama (`linkIdentity`). Ayarlar'a "Hesap" satırı eklendi
      (anonimken dokununca bağlanıyor).
- [x] 🧑‍💻 Google girişi butonunun kaderi: kaldırıldı (gerçekte anonim giriş
      yapıp Google gibi görünüyordu — yanıltıcıydı).

### 4. Küçük ama kritik rötuşlar

- [x] 🧑‍💻 **Boş Home durumu:** hiç challenge yokken Home'da yönlendirici boş
      durum ekranı (halka illüstrasyonu + "İlk halkanı kur" CTA → QuickStartSheet).
- [ ] 🧑‍💻 `mockStore`/`mock.ts` temizliği: Supabase artık her akışı karşılıyor;
      mock katmanını incelt (optimistic cache olarak kalan kısmı ayrıştır).
      **Bilerek ertelendi** — her ekranın okuduğu merkezi state katmanı, cihazda
      test edemeden (bu oturumda yalnızca web smoke test mümkün) riske girmeye
      değmez; ayrı, dikkatli bir geçiş olarak ele alınmalı.
- [x] 🧑‍💻 Ayarlar'daki sahte satırları gerçeğe bağla veya kaldır
      (Bildirimler artık gerçek izin durumunu gösteriyor, Hesap gerçek
      anonim/Apple durumunu gösteriyor, Dil kaldırıldı — gerçek i18n yoktu;
      "Demo" bölümü artık yalnızca mock modda (`!configured`) görünüyor).

---

## 🌊 Faz 3B — Derinlik (retention'ı büyüten özellikler)

Öncelik sırasıyla:

- [ ] **Rematch akışı** 🧑‍💻 — E9'daki "Aynı grupla yeni challenge başlat" şu an
      boş create'e gidiyor; katılımcıları + ayarları taşısın, gruba "yeni tur"
      daveti otomatik gitsin. (En ucuz retention kazanımı.)
- [ ] **Bahis oylaması UI** 🧑‍💻 — `stakes.mode='vote'` + `stake_options` +
      `stake_votes` şemada hazır, sadece ekran yok: oluşturmada seçenek girme,
      katılımcıların oylaması, bitişte sonucun ilanı.
- [ ] **Fotoğraflı check-in (opsiyonel)** 🧑‍💻 + 🔑 — `expo-image-picker` +
      Supabase Storage bucket + RLS; fotoğraf sohbete kart olarak düşer.
      Grup canlılığını en çok artıracak özellik.
- [ ] **Kişisel arşiv/istatistik** 🧑‍💻 — profil ekranı: tamamlanan challenge'lar,
      toplam check-in, "bu yıl X check-in". Dil "birikim", asla "streak".
- [ ] **Şablon galerisi** 🧑‍💻 — mevcut TEMPLATES'i büyüt: kategorili, hazır
      süre+joker+bahis paketleriyle tek dokunuş kurulum.
- [ ] **iOS Widget** 🧑‍💻 (büyük iş) — günün halkası ana ekranda; check-in'e tek
      dokunuş. `expo-apple-targets` ile WidgetKit hedefi; prebuild kullandığın
      için mümkün ama native Swift gerektirir — Faz 3B'nin en pahalı kalemi,
      en sona.

---

## 💰 Faz 4 — Monetizasyon: "Halkora Pro"

**İlke: check-in / katılma / temel grup asla paywall arkasına girmez** —
viral döngü ücretsiz katmanda yaşar.

- [ ] 🔑 💰 RevenueCat hesabı + App Store Connect'te abonelik ürünleri
      (aylık ~₺49-79 / $2.99-4.99 + yıllık indirimli).
- [ ] 🧑‍💻 `react-native-purchases` entegrasyonu + `profiles.is_pro` senkronu.
- [ ] 🧑‍💻 Ücretsiz limitler: 2 aktif challenge · 8 kişilik grup · 1 joker.
      Limit kontrolü **sunucuda** (RPC/Edge Function — istemci hilelenebilir).
- [ ] 🧑‍💻 Pro açılımları: sınırsız challenge, büyük grup, ekstra joker tanımlama,
      fotoğraflı check-in, gelişmiş istatistik, widget temaları.
- [ ] 🧑‍💻 **"Kaptan öder":** grubu kuran Pro ise o challenge'da tüm grup Pro
      özellikleri kullanır — dönüşümün asıl motoru.
- [ ] 🧑‍💻 Paywall ekranı — utandırmayan dilde ("Halkanı büyüt"), limit anında
      bağlamsal gösterim (genel nag yok).
- [ ] ❌ Yapılmayacaklar: gerçek para bahsi/escrow (regülasyon riski),
      reklam (ürün ruhunu öldürür).

---

## 🚀 Faz 5 — Yayın Hazırlığı

- [ ] 🔑 Gizlilik politikası + kullanım koşulları (App Store zorunlu; anonim
      auth + push token topladığımız için basit ama şart) → halkora.app'te barındır.
- [ ] 🧑‍💻 App Store gizlilik etiketleri (Data Collection: user id, coarse
      istatistik — envanteri ben çıkarırım).
- [ ] 🔑 App Store metadata: isim "Halkora", alt başlık ("Birlikte söz, birlikte
      halka" tarzı), ekran görüntüleri (6.7" + 6.1"), açıklama.
- [ ] 🧑‍💻 Crash raporlama: Sentry (`@sentry/react-native`) — TestFlight'taki
      "sessiz çökme" durumunu bir daha yaşamamak için.
- [ ] 🔑 TestFlight harici beta: 10-20 gerçek grup (arkadaş grupları) ile
      2 haftalık gerçek challenge testi — push + davet döngüsünün sahada kanıtı.
- [ ] 🧑‍💻 Onboarding'e bildirim izni adımı (Faz 3A-1 ile birlikte).

---

## Önerilen giriş sırası

```
Faz 0 (bugün, 1 saat)
  └─ Domain + handle + marka taraması            ← sen
Faz 3A-1: Push (1. sprint)                        ← birlikte
Faz 3A-2: Universal Links (2. sprint)             ← birlikte
Faz 3A-3: Apple Sign-In (3. sprint)               ← birlikte
Faz 3A-4: Rötuşlar (aralara serpiştir)
Faz 3B: Rematch → Oylamalı bahis → Foto check-in  ← beta sırasında
Faz 5: Beta → geri bildirim → Faz 4 (Pro) → yayın
```

Mantık: Monetizasyon (Faz 4), beta kullanıcıları döngüyü gerçekten yaşadıktan
**sonra** gelir — neyin Pro'ya layık olduğunu beta söyler.
