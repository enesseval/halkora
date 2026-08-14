# Halkora — App Store review hazırlığı

Bu liste genel bir kontrol listesi değil; **bu depodaki kodun mevcut durumuna
bakılarak** çıkarıldı. Her maddede neyin doğrulandığı ve neyin sizin
onaylamanız gereken bir şey olduğu ayrı yazılı.

Durum işaretleri:
`[OK]` kodda doğrulandı · `[ENGEL]` bu hâliyle reddedilir · `[EKSİK]` yapılmalı
· `[SOR]` karar sizin, ben varsayım yapmadım.

---

## 1. Red sebebi olacak, gönderim öncesi kapatılması şart

### 1.1 [ENGEL] Paywall satın alma yapmıyor — Guideline 2.1

`app/paywall.tsx` fiyatları ve plan seçimini gerçek arayüzle gösteriyor, ama
satın alma butonu `Alert.alert(t.pro.notReadyTitle, ...)` çağırıyor. Kodda
StoreKit, RevenueCat ya da `react-native-iap` yok — `package.json`'da hiçbiri
bulunmuyor.

Fiyat gösterip satın aldırmayan bir ekran, App Completeness altında neredeyse
kesin redle döner. Üç seçenek var, hangisi olduğunu **siz seçmelisiniz**:

- **A — Paywall'u ilk sürümde tamamen gizle.** Ücretsiz limitler kalır, limite
  gelindiğinde paywall yerine bilgilendirici bir mesaj çıkar. En hızlı yol.
- **B — Gerçek IAP entegre et.** RevenueCat veya doğrudan StoreKit 2, App Store
  Connect'te abonelik ürünleri, "Satın alımları geri yükle" butonu (bu ayrıca
  zorunlu), abonelik şartları metni. Birkaç günlük iş.
- **C — Sürümü erteleyip B'yi yap.**

`[SOR]` Hangisi?

### 1.2 [ENGEL] Kullanıcı içeriği var, moderasyon yok — Guideline 1.2

Uygulamada grup sohbeti ve dürtme mesajları var; yani kullanıcıdan kullanıcıya
serbest metin akıyor. `src/i18n/tr.ts` içinde "şikayet", "bildir", "engelle"
karşılığı hiçbir string yok — yani bu mekanizmalar hiç yok.

Apple, kullanıcı üretimi içerik barındıran uygulamalarda **dördünü birden**
ister:

1. Uygunsuz içeriği filtreleme yöntemi
2. **İçeriği bildirme** (her mesaj için erişilebilir bir "Bildir")
3. **Kullanıcıyı engelleme**
4. Bildirilen içeriğe **24 saat içinde** müdahale taahhüdü ve iletişim kanalı

Ayrıca uygulama içinde bir EULA/kullanım şartları ve "sıfır tolerans" ifadesi
beklenir (Apple'ın standart EULA'sı kabul edilir).

Bu, listedeki en büyük iş kalemi. Sohbet ilk sürümde kapatılırsa madde tamamen
düşer.

`[SOR]` Bildirme + engelleme mi eklensin, yoksa ilk sürümde sohbet kapatılsın mı?

### 1.3 [EKSİK] Gizlilik politikası ve destek sayfası yok

`web/` altında yalnızca davet yönlendirme sayfası (`web/j/index.html`) ve
`_redirects` var. App Store Connect **iki ayrı URL zorunlu** ister:

- Gizlilik politikası URL'i (App Store sayfasında da görünür)
- Destek URL'i (çalışan bir iletişim yolu içermeli)

Ayrıca hesap silme uygulamada var (bkz. 2.2) ama Apple, silme yönergesinin
destek sayfasında da yazılı olmasını bekliyor.

### 1.4 [EKSİK] Privacy Manifest (PrivacyInfo.xcprivacy)

Depoda hiçbir `PrivacyInfo.xcprivacy` yok ve `app.json` içinde
`ios.privacyManifests` tanımlı değil. Widget, App Group üzerinden `UserDefaults`
kullanıyor — `UserDefaults` Apple'ın "required reason API" listesinde ve
gerekçe beyanı istiyor (`CA92.1`: yalnızca uygulamanın kendisi ve app
group'undaki extension'ları için).

Expo prebuild bazı modüllerin manifestini kendi üretir, ama uygulama seviyesinde
beyan gerekiyorsa `app.json`'a eklenmeli. **Bunu ben varsayımla yazmadım** —
prebuild sonrası `ios/` klasöründe üretilen manifesti kontrol edip eksikse
eklemek gerek.

`[SOR]` Prebuild alıp `ios/Halkora/PrivacyInfo.xcprivacy` dosyasını bana
gönderirseniz eksikleri çıkarır, `app.json`'a eklenecek bloğu yazarım.

---

## 2. Doğrulanmış, tamam olanlar

### 2.1 [OK] Sign in with Apple

`src/hooks/useAuth.ts` içinde `signInWithApple` gerçek: `expo-apple-authentication`
ile alınan kimlik jetonu Supabase'e `signInWithIdToken({ provider: 'apple' })`
ile veriliyor. Anonim hesabın Apple hesabına bağlanması da var.

Başka üçüncü taraf giriş sağlayıcısı yok, yani Apple girişi zaten tek başına
yeterli — 4.8 maddesi bir sorun çıkarmaz.

### 2.2 [OK] Hesap silme — Guideline 5.1.1(v)

Ayarlar'da hesap silme var ve arkasında gerçek bir uç nokta çalışıyor
(`supabase/functions/delete-account`). Apple bunu 2022'den beri zorunlu tutuyor
ve hesap oluşturan her uygulamada arıyor.

Gönderimde inceleme notlarına silme adımını yazın: *Ayarlar → Hesabı sil*.

### 2.3 [OK] Şifreleme beyanı

`app.json` içinde `ITSAppUsesNonExemptEncryption` tanımlı — her build'de
sorulan soru bu; tanımlı olduğu için TestFlight/gönderim akışı takılmaz.

### 2.4 [OK] Gereksiz izin istenmiyor

Kamera, fotoğraf kütüphanesi ve izleme (ATT) izinleri hiç kullanılmıyor —
`app.json`'da bu anahtarların hiçbiri yok. İstenmeyen izin sorulmaması iyi;
kullanılmayan bir izin metni bırakmak da kendi başına red sebebidir, o durum da
yok.

Kullanılan tek hassas izin bildirimler. `expo-notifications` eklentisi kurulu ve
onboarding'de kullanıcıya ne için istendiği anlatılıyor.

### 2.5 [OK] Universal Links

`ios.associatedDomains: ['applinks:halkora.app']` tanımlı ve `web/j/index.html`
yönlendirme sayfası var. **Doğrulanması gereken:** `halkora.app` alan adında
`/.well-known/apple-app-site-association` dosyasının **yayında** olması ve
`com.halkora.app` bundle id'sini içermesi. Bunu depodan göremem.

### 2.6 [OK] İki dil

Uygulama tamamen Türkçe + İngilizce. `CFBundleLocalizations` app.json'da
tanımlı. App Store Connect'te de her iki dil için metin girilebilir.

---

## 3. App Store Connect'te hazırlanacaklar

Kodla ilgisi yok, ama gönderimden önce hazır olmalı:

- **Ekran görüntüleri:** 6.9" (iPhone 17 Pro Max) ve 6.5" zorunlu. Widget'ları
  gösteren görseller güçlü bir fark yaratır.
- **Uygulama açıklaması, anahtar kelimeler, tanıtım metni** — tr + en.
- **Yaş sınırı anketi.** Sohbet kalırsa "Kullanıcı Üretimi İçerik" sorusuna
  dürüst cevap verilmeli; bu yaş sınırını yükseltir.
- **App Privacy ("Nutrition Label"):** Toplanan veriler dürüstçe işaretlenmeli.
  Bu projede en az: e-posta/hesap kimliği, kullanıcı adı, kullanıcı içeriği
  (sohbet mesajları), tanımlayıcılar (push token). Hepsi "uygulama işlevi" ile
  ilişkili, reklam veya izleme yok.
- **İnceleme notları:** Uygulama davet koduyla çalıştığı için **inceleyicinin
  tek başına deneyemeyeceği akışlar var**. Notlara mutlaka:
  - Hazır bir test hesabı (ya da anonim girişin yeterli olduğu açıklaması)
  - **Çalışan bir davet kodu** ve içinde en az bir başka kullanıcı bulunan bir
    halka — yoksa grup mekaniğinin tamamı görünmez kalır
  - Hesap silme yolu
  - Widget'ın nasıl ekleneceği
- **Build numarası:** `app.json`'da `ios.buildNumber` tanımlı **değil**. Her
  yüklemede artırılması gerekiyor; şu an her build aynı numarayla gider ve
  ikinci yükleme reddedilir. Sürüm `1.0.0`.

---

## 4. Gönderim öncesi teknik kontrol

- [ ] `npm run typecheck` temiz
- [ ] `npm run lint` — mevcut 25 hata için karar verilmeli (hepsi çalışan kodda,
      bkz. AGENTS.md)
- [ ] Debug/geliştirici satırları (Ayarlar'daki `widgetDebug`, uid/is_pro
      satırı) prod build'de görünmüyor
- [ ] Test verisi temizlendi, uygulama boş durumdan açılıyor
- [ ] Push bildirimleri gerçek cihazda çalışıyor (APNs anahtarı Supabase
      tarafında tanımlı)
- [ ] Widget'lar temiz kurulumda görünüyor ve check-in yapıyor
- [ ] Uçak modunda uygulama çökmüyor, anlamlı hata gösteriyor
- [ ] Hesap silindikten sonra uygulama tutarlı bir duruma dönüyor

---

## 5. Sıraya koyma önerisi

Bunlar bir arada yapılabilecek işler değil; sırası önemli.

1. **1.1 paywall kararı** — hangi seçenek olduğu diğer her şeyi etkiliyor
2. **1.2 moderasyon kararı** — sohbet kalacaksa en uzun kalem bu
3. 1.3 gizlilik + destek sayfaları (basit statik sayfalar yeterli)
4. 1.4 privacy manifest doğrulaması
5. `ios.buildNumber` ekleme
6. App Store Connect metinleri, görseller, inceleme notları
7. Bölüm 4 teknik kontrol, sonra gönderim

`[SOR]` 1 ve 2'deki kararları verin, kalanını sırayla uygularım.
