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
      **Kısmen yapıldı** — kök sorun (store, Supabase configured'ken bile sahte
      seed veriyle başlıyordu) düzeltildi + Home/Detay/Davet/Bitiş ekranlarına
      gerçek loading/error state'leri eklendi (mock veri artık hiçbir yerde
      "gerçekmiş gibi" sessizce gösterilmiyor — bkz. aşağıdaki inceleme
      bulgusu "Invite ekranı" hariç, o da bu turda düzeltildi). Tam
      `mockStore`/`mock.ts` inceltmesi hâlâ ayrı, dikkatli bir geçiş olarak
      bekliyor — cihazda test edemeden merkezi state katmanını büyük çaplı
      refactor etmek riske değmez.
- [x] 🧑‍💻 Ayarlar'daki sahte satırları gerçeğe bağla veya kaldır
      (Bildirimler artık gerçek izin durumunu gösteriyor, Hesap gerçek
      anonim/Apple durumunu gösteriyor, Dil kaldırıldı — gerçek i18n yoktu;
      "Demo" bölümü artık yalnızca mock modda (`!configured`) görünüyor).

---

## 🔍 Kod incelemesi bulguları (Faz 3A sonrası bağımsız tarama)

Push/Universal Links/Apple Sign-In/veri-yükleme çalışmasından sonra yapılan
ayrı bir güvenlik + tutarlılık + performans taraması. Öncelik sırası:
🔴 kritik (hemen) → 🟠 güvenlik (yakın vade) → 🟡 tutarlılık → 🟢 performans
→ 💡 özellik önerisi.

### 🔴 Kritik — hemen düzeltilmeli

- [x] 🧑‍💻 **`web/j/index.html` XSS açığı:** davet kodu URL'den alınıp
      `innerHTML` ile basılıyordu, sanitize edilmemişti — kötü niyetli bir
      link paylaşan biri tıklayanın tarayıcısında script çalıştırabilirdi.
      Düzeltildi: `textContent` + kod formatı doğrulaması (`[A-Za-z0-9-]{3,32}`).
- [x] 🧑‍💻 **`notify` / `evening-reminder` Edge Function'ları kimliksizdi:**
      `--no-verify-jwt` ile deploy edildikleri için URL'i bilen herkes sahte
      payload'la kullanıcılara sınırsız push gönderebilirdi. Paylaşılan bir
      `WEBHOOK_SECRET` header'ıyla korumaya alındı — bkz.
      `docs/PHASE2-SUPABASE.md` "Ek I" (deploy etmen ve dashboard'a header'ı
      eklemen gerekiyor, 🔑).
- [x] 🧑‍💻 **`profiles.push_token` diğer katılımcılara açıktı:**
      "co-participant profiles" RLS politikası (Ek E) satırın TÜM kolonlarını
      okutuyordu. Token artık ayrı, yalnızca sahibinin okuyup yazabildiği
      `push_tokens` tablosunda (`docs/PHASE2-SUPABASE.md` "Ek I" — eski
      `profiles.push_token` kolonunu SQL Editor'de silmen gerekiyor).
- [x] 🧑‍💻 **Invite ekranında gerçek modda bile sahte katılımcılar
      gösteriliyordu:** `INVITE_JOINERS` mock listesi `isSupabaseConfigured`
      kontrolü olmadan her zaman animasyonla oynatılıyordu. Gerçek modda artık
      `challenge.participants` gösteriliyor, mock demo yalnızca `!configured`'da.
- [x] 🧑‍💻 **Zaten onboarding'i bitirmiş kullanıcı davet kodunu
      kaybedebiliyordu:** `_layout.tsx`'in "signed in + has name" dalı, welcome
      ekranından yeniden kimlik doğrulayan (ör. cihazı sıfırlayıp Apple ile
      tekrar giren) bir kullanıcıyı saklanan davet koduna bakmadan direkt
      Home'a atıyordu. Düzeltildi.

### 🟠 Güvenlik — orta vadeli

- [x] 🧑‍💻 **Nudge spam'i:** `insertNudge`'da hız sınırı yoktu; push tetiklediği
      için biri aynı kişiye dakikada onlarca "El salla 👋" bildirimi
      gönderebilirdi. Sunucu tarafında "aynı kişiye günde 1 nudge" kısıtı
      eklendi (unique index — `docs/PHASE2-SUPABASE.md` "Ek K", SQL Editor'de
      çalıştırman gerekiyor).
- [ ] 🔑 **Davet kodu brute-force riski:** `get_challenge_preview` herkese
      açık bir RPC. Kod uzunluğu 6 hex karakterden 10'a çıkarıldı (Ek K —
      SQL Editor'de çalıştırman gerekiyor), ayrıca Supabase Dashboard'da API
      rate limit ayarlarının açık olduğunu doğrulaman gerekiyor.
- [x] 🧑‍💻 **Çıkışta push token temizlenmiyordu:** `signOut()` artık çıkıştan
      önce `push_tokens` satırını siliyor — kullanıcı çıkış yaptığında cihaz o
      hesabın bildirimlerini almayı bırakıyor (push_token tablosu taşınırken
      bonus olarak düzeltildi).
- [x] 🧑‍💻 **Hesap silme akışı yoktu:** App Store, hesap oluşturma varsa
      uygulama-içi hesap silmeyi zorunlu kılıyor. `supabase/functions/delete-account`
      + Ayarlar'da "Hesabı sil" satırı eklendi — kendi verini siliyor, başkalarının
      hâlâ katıldığı kurduğun challenge'lar grup için kalmaya devam ediyor
      (`docs/PHASE2-SUPABASE.md` "Ek L" — deploy etmen gerekiyor, 🔑).

### 🟡 Tutarlılık

- [x] 🧑‍💻 **Gün sınırı iki farklı yerde iki farklı şekilde hesaplanıyordu:**
      `insertChallenge` artık cihazın gerçek IANA timezone'unu `timezone`
      kolonuna yazıyor (DB default'una güvenmek yerine), istemci
      (`daysSinceStart`) artık challenge'ın kendi `timezone`'unu okuyor
      (cihaz yerel gece yarısı yerine), `restart_challenge` RPC'si de
      `current_date` (DB session/UTC) yerine aynı timezone'u kullanıyor —
      client + check-in Edge Function + join-window RPC'leri artık aynı günü
      görüyor (`docs/PHASE2-SUPABASE.md` "Ek G" güncellemesi — SQL Editor'de
      tekrar çalıştırman gerekiyor, 🔑).
- [x] 🧑‍💻 Mock `createChallenge` artık step 3'te seçilen joker sayısını
      kullanıyor (`input.joker ?? 1`) — gerçek yolla tutarlı.
- [x] 🧑‍💻 Ayarlar'da sürüm artık `expo-constants`'tan (`Constants.expoConfig?.version`)
      okunuyor, elle yazılmış string kalmadı.
- [x] 🧑‍💻 Ayarlar'daki profil kartı + "İsim" satırı — aksiyonu olmayan
      satırlar artık chevron göstermiyor (isim düzenleme akışı henüz yok).

### 🟢 Performans

- [x] 🧑‍💻 **`fetchMyChallenges` her 5 saniyede TÜM check-in geçmişini
      çekiyordu** — poll aralığı 12sn'ye çıkarıldı, `AppState` artık
      react-query'nin `focusManager`'ına bağlı olduğu için uygulama
      arka plandayken poll'lar duruyor (önceden yalnızca web sekme
      görünürlüğü bunu yapıyordu). Özet hesaplamayı bir SQL view/RPC'ye
      taşımak hâlâ uzun vadeli bir iyileştirme olarak duruyor.
- [x] 🧑‍💻 Sohbet poll'u 4sn'den 8sn'ye çıkarıldı + aynı `AppState` durdurma
      mantığından faydalanıyor. Realtime'ın (Ek D) gerçekten tetiklendiği
      doğrulanınca 30sn'ye kadar daha da genişletilebilir.
- [x] 🧑‍💻 Özel gün sayısı artık 100 ile sınırlı (önceden 999'a kadar
      girilebiliyordu) — `ProgressRing`'in her gün için ayrı SVG path
      çizme maliyeti artık sınırsız büyümüyor.

### 💡 Özellik önerileri

- [ ] 🧑‍💻 **Bildirim tercihleri:** check-in/akşam hatırlatması/nudge için
      ayrı aç-kapa (nudge hız sınırıyla birlikte düşünülebilir).
- [ ] 🧑‍💻 **Çevrimdışı check-in kuyruğu:** check-in günlük bir ritüel;
      internetsiz anda basılan check-in kaybolmamalı.
- [ ] 🧑‍💻 **Davet önizlemesinde "zaten üyesin" durumu:** kendi challenge'ının
      linkine tıklayan kullanıcı şu an tekrar "Katıl" ekranı görüyor.
- [ ] 🧑‍💻 **Bildirim gruplama:** 8 kişilik grupta herkes check-in yapınca 7
      ayrı push geliyor — Expo push `collapseId` ile "3 kişi tamamladı"
      şeklinde birleştirmek bildirim yorgunluğunu azaltır.

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

## 🆔 Faz 3C — @kullanıcıadı + kurucu ayarları (kullanıcı isteği, 14 Tem 2026)

İki üründen çıkma istek: (a) her kullanıcının `@enesseval` tarzı benzersiz bir
adı olsun ve bununla davet edilebilsin, (b) challenge kurucusu Detay
ekranından akışı etkilemeyen alanları düzenleyebilsin. Uygulama sırası da bu —
handle sistemi davet özelliğinin ön koşulu.

### 1. @kullanıcıadı (handle) altyapısı — ✅ kod tamam, SQL senin işin

- [x] 🧑‍💻 Şema: `profiles.username` (unique, `^[a-z0-9_]{3,20}$` check) +
      `reserved_usernames` tablosu + rezerve-isim trigger'ı (defense-in-depth
      — "own profile" RLS politikası RPC'yi atlayan doğrudan yazımı da
      kapsasın diye). Tek dosyada: `docs/db-username.sql` — 🔑 SQL Editor'de
      çalıştırman gerekiyor, `YAPILACAKLAR.md` §1,5'e eklendi.
- [x] 🧑‍💻 Herkese otomatik handle: `src/lib/username.ts` (Türkçe karakter +
      aksan temizleme, kısa isimler için dolgu) + `useAuth().ensureUsername`
      onboarding'de isim kaydedilince best-effort çalışır (ağ hatası
      onboarding'i asla bloklamaz). Onboarding'de isim adımının altında canlı
      `@handle` önizlemesi var.
- [x] 🧑‍💻 Ayarlar'da "Kullanıcı adı" satırı: `UsernameSheet` ile
      düzenlenebilir; format/rezerve/çakışma hataları `USERNAME_INVALID` /
      `USERNAME_RESERVED` / `USERNAME_TAKEN` kodlarıyla lokalize gösteriliyor.
      Eski handle serbest kalır — davetler koda bağlı olduğu için hiçbir şey
      kırılmaz.
- [x] 🧑‍💻 Görünürlük: co-participant RLS politikası `profiles` satırını zaten
      okutuyor → halka arkadaşların handle'ı otomatik görülür. Halka DIŞI
      arama için `find_user_by_username(text)` RPC'si — yalnızca TAM eşleşme
      (prefix araması bilerek yok), `(id, name, initials, username)` döner.
      Madde 2 (davet) bunu henüz çağırmıyor — o ekranın işi.
- [x] 🧑‍💻 i18n: tüm yeni string'ler tr+en (AGENTS.md kuralı).

### 2. Handle ile davet — ✅ kod tamam, SQL + webhook senin işin

- [x] 🧑‍💻 `invites` tablosu: `(challenge_id, from_user, to_user, created_at,
      unique(challenge_id, to_user))` + RLS (gönderen yazar — üyelik şartıyla,
      alıcı okur). Nudge'la aynı desen. Tek dosyada: `docs/db-invites.sql`
      — 🔑 SQL Editor'de çalıştırman gerekiyor.
- [x] 🧑‍💻 `notify` Edge Function'a 4. tablo: `invites` INSERT → alıcıya
      dilinde push ("Enes seni '30 Gün Kitap Okuma' halkasına davet etti") +
      `data.inviteCode` ile `/join/{kod}`'a deep link (challenge id'ye değil —
      alıcı henüz üye değil, RLS onu Detay ekranından zaten engelliyor). 🔑
      Yeni DB webhook + `notify`'ı yeniden deploy etmen gerekiyor
      (`docs/PHASE2-SUPABASE.md` "Ek O2").
- [x] 🧑‍💻 Davet ekranına "@kullanıcıadıyla davet et" alanı: yaz → bul
      (`find_user_by_username` RPC) → gönder; "bulunamadı", "kendini davet
      edemezsin", "zaten üye", "zaten davet edilmiş" durumları ayrı ayrı
      gösteriliyor. Bu davet gerçek katılım değil — yalnızca bir bildirim
      tetikler, alıcı katılımı `join_challenge_by_code` ile kendisi
      tamamlar, yani "sadece ilk gün" penceresini asla bypass etmez.
- [ ] 💡 MVP sonrası: uygulama içi "davetlerim" kutusu (push kaçarsa davet
      kaybolmasın diye Home'da bir satır) — v1'de push + link yeterli.

### 3. Kurucu ayarları (Detay ekranında ⚙️) — ✅ kod tamam, SQL senin işin

- [x] 🧑‍💻 Detay ekranında yalnızca kurucuya görünen ⚙️ ayarlar girişi (top bar,
      sağ üstte — kurucu değilsen aynı yerde boş bir spacer var, layout
      kaymaz) → sheet: **başlık, günlük eylem, bahis metni** düzenlenebilir.
      Gün sayısı, joker, başlangıç tarihi, katılım penceresi bilinçli olarak
      DÜZENLENEMEZ — bunlar geçmiş check-in'lerin anlamını/adaleti değiştirir
      (grup 10 gün koştuktan sonra 30 günü 15'e çekmek gibi).
- [x] 🧑‍💻 Dar RPC: `update_challenge_details(p_challenge_id, p_title,
      p_daily_action, p_stake_text)` — owner-only (`NOT_THE_OWNER` kodu),
      SECURITY DEFINER. Genel bir UPDATE RLS politikası yerine (Ek G'deki
      gerekçeyle aynı: geniş policy title/owner dahil her alanı açardı). Tek
      dosyada: `docs/db-owner-settings.sql` — 🔑 SQL Editor'de çalıştırman
      gerekiyor, deploy yok.
- [ ] 🧑‍💻 Başlık değişince sohbete system message ("Kurucu halkanın adını
      '...' yaptı") — bu turda YAPILMADI. Sunucu tarafında locale-aware
      system-mesaj kompozisyonu için bugün hiçbir altyapı yok (mesajlar hep
      istemci metniyle yazılıyor, `notify`'ın push-copy COPY dict'ine benzer
      bir mekanizma sohbet mesajları için henüz mevcut değil) — yeni bir
      mekanizma icat etmek yerine ayrı, dikkatli bir iş olarak bırakıldı.
- [ ] 💡 Pro bağlantısı (beta sonrası, Faz 4 ile): aynı ayarlar alanına
      "İstatistikler" bölümü — grup tamamlama eğrisi, en istikrarlı üye, gün
      gün katılım — `is_pro` kapısının arkasında. Ücretsizde bugünkü basit
      özet kalır.

### 4. Bitiş ekranı istatistikleri — ✅ zaten gerçek veriden (kontrol edildi)

~~Ek G'deki bilinen eksik~~ — 14 Tem 2026'da kod incelendi: `mapRow`
(`src/data/challenges.ts`) `finishStats` (kişi/check-in/tamamlama %) ve
her katılımcının `completedDays`'ini status `'completed'` olan HER
challenge için gerçek `check_ins`'ten zaten hesaplıyor; mock arşiv
(`archive1`) ayrı bir demo görünümü, kod yolu paylaşmıyor. Doküman notu
bayatmış, düzeltildi (Ek G). Gerçekten eksik olan tek şey — `stakeResult`
("kim kaybetti" metni) — bilinçli olarak hesaplanmıyor: kim kaybettiğine
grup karar verir, `complete.tsx` bu durumda zaten `stake.text`'e düşüyor.
Bir sonraki fast-days testinde bu ekranın gerçek veriyle doğru geldiğini
görmen gerekir; görmezsen bana söyle, o zaman gerçek bir bug'dır.

- [x] 🧑‍💻 **Yanıltıcı buton metni düzeltildi:** "Aynı grupla yeni challenge
      başlat" aslında hiçbir grubu taşımıyor, boş create'e gidiyor (Rematch,
      Faz 3B'de henüz yok) — metin artık "Yeni bir halka kur" / "Start a new
      ring" diyor, olmayan bir özelliği vaat etmiyor.

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
