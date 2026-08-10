# Halkora Pro — abonelik kurulumu ve test rehberi

Daha önce IAP kurmadıysanız doğru yerdesiniz. Bu rehber sıfırdan anlatır ve en
çok takılınan yerleri özellikle işaretler.

**Şu anki durum:** `app/paywall.tsx` fiyatları ve plan seçimini gerçek arayüzle
gösteriyor, ama satın alma butonu bir uyarı açıyor. `package.json`'da StoreKit,
RevenueCat ya da `react-native-iap` yok. Yani ödeme altyapısı hiç yok — sadece
vitrin var.

---

## 0. Önce anlamanız gereken üç şey

**1. Abonelik parası Apple'dan geçer, sizden geçmez.** Kullanıcı Apple'a öder,
Apple %15–30 keser, kalanı size aktarır. Kendi ödeme sayfanıza yönlendirmek
yasak (Guideline 3.1.1) ve anında red sebebi.

**2. "Kim Pro?" sorusunun cevabı sunucuda durmalı.** Uygulamada `isPro` diye bir
alan var (`profiles.is_pro`). Satın alma gerçekleştiğinde bunun **Apple'ın
onayıyla** güncellenmesi gerekir. Sadece uygulamanın "satın alındı" demesine
güvenirseniz, kurcalanmış bir cihaz bedava Pro olur.

**3. "Satın alımları geri yükle" butonu zorunludur.** Kullanıcı telefon
değiştirdiğinde aboneliğini geri getirebilmeli. Bu buton yoksa reddedilirsiniz.

---

## 1. RevenueCat mı, doğrudan StoreKit mi?

| | RevenueCat | Doğrudan StoreKit 2 |
|---|---|---|
| Kurulum | Yarım gün | Birkaç gün |
| Sunucu doğrulaması | Hazır geliyor | Kendiniz yazacaksınız |
| Abonelik durumu takibi | Panelden görünür | Kendiniz kuracaksınız |
| Ücret | 2,5k$/ay gelire kadar bedava | Yok |
| Android'e geçiş | Aynı kod | Baştan yazılır |

**Öneri: RevenueCat.** Sebep tek başına yeterli: abonelik iptali, iade, süre
dolması, aile paylaşımı, deneme süresi gibi onlarca durumu doğru ele almak
StoreKit ile haftalar sürer ve yanlış yapılırsa parayı ya da kullanıcıyı
kaybedersiniz. RevenueCat bunu çözülmüş halde verir ve `profiles.is_pro`'yu
webhook ile güncellemenizi sağlar.

Bu rehberin geri kalanı RevenueCat'e göre yazıldı.

---

## 2. App Store Connect'te ürünleri oluşturma

Bu adım **kodla başlamadan önce** yapılmalı; ürünler tanımlı olmadan test
edilecek hiçbir şey yok.

1. App Store Connect → uygulamanız → **Özellikler (Features)** → **Abonelikler**
2. **Abonelik grubu** oluşturun. Adı kullanıcıya görünür — "Halkora Pro" yeterli.
   *Aynı gruptaki abonelikler birbirine yükseltilebilir/düşürülebilir. Aylık ve
   yıllık planı AYNI gruba koyun.*
3. Grubun içine iki abonelik ekleyin:
   - Ürün kimliği: `com.halkora.app.pro.monthly` · Süre: 1 ay
   - Ürün kimliği: `com.halkora.app.pro.annual` · Süre: 1 yıl

   **Ürün kimliği sonradan değiştirilemez.** Bir kez yazın, doğru yazın.
4. Her biri için: fiyat, gösterim adı, açıklama girin. Türkçe ve İngilizce
   ekleyin (uygulama iki dilli).
5. **Abonelik grubuna bir "App Store yerelleştirmesi" ve bir tanıtım görseli**
   isteyecek. Görsel zorunlu değil ama alan boşsa "Gönderilmeye hazır" durumuna
   geçmez.
6. Ürünlerin durumu **"Gönderilmeye Hazır"** olmalı. "Meta veri eksik" ise
   uygulama içinde ürün hiç görünmez — en sık takılınan yer burasıdır.

### Sözleşmeler — bunu atlarsanız hiçbir şey çalışmaz

App Store Connect → **İş (Business)** → **Ücretli Uygulamalar sözleşmesi**
kabul edilmiş, banka ve vergi bilgileri girilmiş olmalı. Sözleşme aktif
değilken ürünler API'ye **hiç düşmez** ve "ürün bulunamadı" hatası alırsınız.
Bu adım genelde birkaç gün sürer, **en başta başlatın.**

---

## 3. RevenueCat kurulumu

1. revenuecat.com'da proje oluşturun, iOS uygulamasını ekleyin
   (bundle id: `com.halkora.app`).
2. **App Store Connect API anahtarı** üretip RevenueCat'e verin (Kullanıcılar ve
   Erişim → Integrations → App Store Connect API). Bu, RevenueCat'in abonelik
   durumunu Apple'dan doğrulaması için gerekli.
3. RevenueCat'te **Entitlement** oluşturun: `pro`. Bu, "kullanıcı Pro mu?"
   sorusunun tek cevabı olacak.
4. İki ürünü RevenueCat'e ekleyin ve ikisini de `pro` entitlement'ına bağlayın.
5. **Offering** oluşturun (`default`), iki paketi içine koyun. Uygulama fiyatları
   buradan okuyacak — böylece fiyat değişikliği uygulama güncellemesi
   gerektirmez.

---

## 4. Uygulama tarafı

```
npx expo install react-native-purchases
```

Ardından `expo prebuild` + Xcode Archive (her zamanki yolunuz).

Yazılacak kod kabaca şu:

- Uygulama açılışında `Purchases.configure({ apiKey, appUserID: <supabase user id> })`.
  **`appUserID` mutlaka Supabase kullanıcı kimliği olmalı** — webhook'un hangi
  hesabı Pro yapacağını bilmesinin tek yolu bu.
- Paywall açılırken `Purchases.getOfferings()` ile fiyatları çekin ve
  `app/paywall.tsx`'teki sabit fiyatların yerine koyun. Apple, mağazadan gelen
  gerçek fiyatın gösterilmesini bekler (kullanıcının ülkesine göre değişir).
- Satın alma: `Purchases.purchasePackage(pkg)`.
- Geri yükleme: `Purchases.restorePurchases()` — paywall'a **görünür bir buton**
  olarak eklenmeli.
- Kullanıcı iptal ederse hata fırlatır; bu bir hata değil, sessizce kapatın.

Bunları ben yazabilirim — ama **2. ve 3. adım tamamlanmadan yazılan kod test
edilemez**, o yüzden önce onları bitirin.

### `is_pro`'yu kim günceller?

RevenueCat → **Integrations → Webhooks** → Supabase Edge Function URL'iniz.
Webhook `INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `EXPIRATION` olaylarını
gönderir; Edge Function `app_user_id`'ye bakıp `profiles.is_pro`'yu günceller.

Bu, "kim Pro?" sorusunun cevabının sunucuda ve Apple onaylı kalmasını sağlar.
Uygulamanın kendi sözüne güvenilmez.

---

## 5. Test — hiç yapmadıysanız buradan okuyun

Üç ayrı test ortamı var ve **karıştırılması en sık yapılan hata.**

### 5.1 Xcode StoreKit dosyası (en hızlı, App Store Connect gerekmez)

Xcode → File → New → File → **StoreKit Configuration File**. Ürünleri elle
tanımlarsınız, simülatörde çalışır, para geçmez, abonelik süresi saniyelere
sıkıştırılır (1 ay = 5 dakika gibi).

**Ne için iyi:** satın alma akışının kodu doğru mu, buton doğru çalışıyor mu.
**Ne için kötü:** RevenueCat ve webhook devrede olmaz. Gerçek doğrulama yapılmaz.

### 5.2 Sandbox (asıl test burası)

1. App Store Connect → **Kullanıcılar ve Erişim → Sandbox → Test Hesapları**
   → yeni hesap oluşturun. **Gerçek Apple kimliğinizi kullanmayın.**
   E-posta gerçek olmak zorunda değil ama benzersiz olmalı.
2. iPhone → Ayarlar → **Geliştirici → Sandbox Apple Account** → bu hesapla giriş
   yapın. *(Ayarlar → App Store'daki asıl hesabınıza dokunmayın.)*
3. TestFlight ya da Xcode'dan yüklü uygulamada satın alma yapın. Para geçmez.
4. Sandbox'ta abonelik süreleri kısaltılmıştır:

   | Gerçek | Sandbox |
   |---|---|
   | 1 hafta | 3 dakika |
   | 1 ay | 5 dakika |
   | 1 yıl | 1 saat |

   Yani yenilenmeyi ve süre dolmasını 5 dakikada test edebilirsiniz. Abonelik
   sandbox'ta 6 kez yenilenip otomatik durur.

**Sandbox'ta mutlaka test edin:**
- [ ] Aylık satın alma → `profiles.is_pro` true oluyor mu (Supabase'den bakın)
- [ ] Yıllık satın alma
- [ ] Satın almayı yarıda iptal etme → uygulama çökmüyor, sessizce kapanıyor
- [ ] Uygulamayı silip yeniden kurma → **Geri yükle** ile Pro geri geliyor mu
- [ ] 5 dakika bekleyip yenilenme → `is_pro` true kalıyor mu
- [ ] Sandbox aboneliğini iptal etme → süre dolunca `is_pro` false oluyor mu
- [ ] Uçak modunda satın almaya çalışma → anlamlı hata

### 5.3 TestFlight

TestFlight'ta satın almalar **otomatik olarak sandbox'tır** — para geçmez, ayrı
test hesabı gerekmez. Gerçek cihazda, gerçek dağıtımda son kontrol için.

### En sık takılınan hatalar

| Belirti | Sebebi |
|---|---|
| "Ürün bulunamadı" / boş liste | Ücretli Uygulamalar sözleşmesi aktif değil, ya da ürün "Meta veri eksik" durumunda |
| Ürünler simülatörde yok | Sandbox simülatörde çalışmaz, gerçek cihaz gerekir (StoreKit dosyası hariç) |
| Satın alma oluyor ama `is_pro` değişmiyor | `appUserID` Supabase kullanıcı kimliği değil, ya da webhook kurulu değil |
| Sandbox hesabı sürekli şifre soruyor | Normaldir, sandbox'ta sık olur |
| Yeni ürün görünmüyor | App Store Connect'te ürün yayılması birkaç saat sürebilir |

---

## 6. Apple'ın paywall'da görmek istedikleri

Reddedilmemek için paywall ekranında **hepsi** bulunmalı:

- [ ] Abonelik adı ve **süresi** ("aylık", "yıllık")
- [ ] Mağazadan gelen **gerçek fiyat** (sabit yazılmış fiyat değil)
- [ ] Otomatik yenilenen abonelik olduğu açıkça yazılı
- [ ] **Satın alımları geri yükle** butonu
- [ ] **Kullanım Şartları** ve **Gizlilik Politikası** linkleri
- [ ] Deneme süresi varsa: süresi, sonrasında ne kadar ödeneceği

`src/lib/legal.ts` şartlar ve gizlilik adreslerini tutuyor; paywall bunları
oradan kullanmalı.

App Store Connect'te uygulama açıklamasına da abonelik bilgisi ve şartlar linki
eklenmesi gerekiyor.

---

## 7. Sıra

1. **Ücretli Uygulamalar sözleşmesi + banka/vergi** — günler sürebilir, bugün başlatın
2. Abonelik grubu ve iki ürün (2. bölüm)
3. RevenueCat projesi, entitlement, offering (3. bölüm)
4. Uygulama kodu + webhook (4. bölüm) — bunu ben yazarım
5. Sandbox testleri (5.2)
6. Paywall gerekliliklerinin kontrolü (6. bölüm)

**1, 2 ve 3 sizde.** Bittiğinde RevenueCat public API anahtarını ve ürün
kimliklerini bana verin, 4. adımı yazayım. Ondan önce yazılan kod test
edilemez, o yüzden bekliyorum.

Eğer bu süreç uzun gelirse alternatif hâlâ geçerli: **paywall'u ilk sürümde
tamamen gizleyip** ücretsiz limitleri koruyarak yayına çıkmak, aboneliği ikinci
sürüme bırakmak. Bu, App Store engelini bugün kaldırır.
