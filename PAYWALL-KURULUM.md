# Halkora Pro — alan alan kurulum

Bu doküman hiçbir şeyi "malum" saymaz. Her alan için **ne yazacağınız** yazılı.
Kopyalayıp yapıştırın.

Değerler uygulamadaki gerçek metinlerden alındı (`src/i18n/tr.ts` → `pro`), yani
App Store'da göreceğiniz ile uygulamada göreceğiniz birbirini tutacak.

**Sabitler**
- Bundle ID: `com.halkora.app`
- Supabase proje referansı: `hyzowqwjqoxuqvzwxmml`
- Pro'nun açtıkları: sınırsız aktif halka (ücretsizde 2 halka sınırı var) +
  gelişmiş istatistikler

---

# BÖLÜM A — App Store Connect

## A0. Bunlar olmadan hiçbir şey çalışmaz

App Store Connect → **Business (İş)**:

- [ ] **Paid Applications** sözleşmesi → durumu **Active** olmalı
- [ ] Banka hesabı girilmiş
- [ ] Vergi formları (Türkiye + ABD W-8BEN) tamamlanmış

Sözleşme Active değilken ürünler uygulamaya **hiç düşmez**; "ürün bulunamadı"
hatası alırsınız ve saatlerce kodda hata ararsınız. Onay birkaç gün sürebilir.
**İlk bunu kontrol edin.**

## A1. Abonelik grubu — yerelleştirme

Ekran görüntünüzde **Halkora Pro** grubu ve içinde 2 abonelik görünüyor. Gruba
tıklayın, en üstte grup yerelleştirmesi var.

Grup adı kullanıcıya, iptal ekranında ve "planı değiştir" ekranında görünür.

**Türkçe**
| Alan | Değer |
|---|---|
| Subscription Group Display Name | `Halkora Pro` |
| App Name (varsa) | `Halkora` |

**English (U.S.)**
| Alan | Değer |
|---|---|
| Subscription Group Display Name | `Halkora Pro` |
| App Name | `Halkora` |

> İki plan **aynı grupta** olmalı — öyle görünüyor, doğru. Aynı gruptaki
> planlar arasında kullanıcı geçiş yapabilir (aylıktan yıllığa), ayrı gruplarda
> olsalardı iki ayrı abonelik olurdu ve kullanıcı ikisine birden abone olabilirdi.

## A2. Aylık abonelik

Gruba tıklayın → aylık aboneliği açın. Alanlar:

### Referans adı ve ürün kimliği

| Alan | Değer |
|---|---|
| Reference Name | `Halkora Pro Aylik` |
| Product ID | `com.halkora.app.pro.monthly` |

**Product ID sonradan DEĞİŞTİRİLEMEZ.** Zaten oluşturduysanız ve farklıysa
sorun değil — sizdeki değeri not edin, RevenueCat'e ve koda onu gireceğiz.
Referans adı yalnızca sizin panelinizde görünür, kullanıcı görmez.

### Süre

| Alan | Değer |
|---|---|
| Subscription Duration | **1 Month** |

### Fiyat

**Subscription Prices** → **Add Subscription Price**

| Alan | Değer |
|---|---|
| Ülke (base) | **Türkiye** |
| Fiyat | **₺59,99** *(Apple'ın sunduğu en yakın fiyat noktası — listede ₺59,99 yoksa ona en yakınını seçin)* |

Apple otomatik olarak diğer 174 ülke için fiyat önerir. **"Use Automatic
Prices"** deyip geçin; ülke ülke elle girmeyin.

> Uygulamada şu an `₺59` yazılı (`src/i18n/tr.ts` → `pro.monthlyPrice`).
> RevenueCat bağlandığında bu sabit metin yerine mağazadan gelen gerçek fiyat
> gösterilecek — Apple bunu zaten şart koşuyor, çünkü fiyat ülkeye göre değişir.
> Yani buradaki seçiminiz uygulamayı otomatik güncelleyecek.

### Yerelleştirme — Türkçe

**Localizations** → **Türkçe** ekleyin:

| Alan | Değer | Sınır |
|---|---|---|
| Subscription Display Name | `Halkora Pro Aylık` | 30 karakter |
| Description | `Sınırsız halka ve gelişmiş istatistikler.` | **45 karakter** |

### Yerelleştirme — English (U.S.)

| Alan | Değer | Sınır |
|---|---|---|
| Subscription Display Name | `Halkora Pro Monthly` | 30 karakter |
| Description | `Unlimited rings and advanced stats.` | **45 karakter** |

> Açıklama sınırı **45 karakter** — çok kısa ve uyarı vermeden kesiyor.
> Yukarıdaki metinler sınırın altında, saydım.

### Deneme süresi / tanıtım fiyatı

**Şimdilik EKLEMEYİN.** Deneme süresi eklerseniz paywall'da "X gün ücretsiz,
sonra ₺59,99/ay" yazmak **zorunlu** olur; yazmazsanız reddedilirsiniz. İlk
sürümü basitleştirin, denemeyi sonra eklersiniz.

## A3. Yıllık abonelik

Aynı gruba geri dönün → yıllık aboneliği açın.

| Alan | Değer |
|---|---|
| Reference Name | `Halkora Pro Yillik` |
| Product ID | `com.halkora.app.pro.annual` |
| Subscription Duration | **1 Year** |
| Fiyat (Türkiye) | **₺399,99** |

### Yerelleştirme — Türkçe

| Alan | Değer |
|---|---|
| Subscription Display Name | `Halkora Pro Yıllık` |
| Description | `Sınırsız halka ve istatistik. 2 ay bedava.` |

### Yerelleştirme — English (U.S.)

| Alan | Değer |
|---|---|
| Subscription Display Name | `Halkora Pro Annual` |
| Description | `Unlimited rings and stats. Two months free.` |

> "2 ay bedava" iddiası tutarlı: ₺59,99 × 12 = ₺719,88; yıllık ₺399,99. Bu
> aslında ~%44 indirim, yani 2 aydan fazlasına denk geliyor — iddia mütevazı
> kalıyor, sorun değil. Uygulamadaki `saveBadge` ile de aynı.

## A4. İnceleme bilgisi ve ekran görüntüsü

Her abonelik için en altta **Review Information**:

| Alan | Değer |
|---|---|
| Screenshot | Paywall ekranının görüntüsü (uygulamayı çalıştırıp Ayarlar → Pro satırından açın, ekran görüntüsü alın) |
| Review Notes | Aşağıdaki metin |

**Review Notes (kopyalayın):**

```
Halkora Pro unlocks two things: unlimited active rings (the free plan allows
2 at a time) and advanced per-person statistics on a finished ring.

To reach the paywall: open the app, go to Settings, tap the Halkora Pro row.
It also appears when a free user tries to create a third ring.
```

Ekran görüntüsü **zorunlu** — boş bırakırsanız abonelik "Ready to Submit"
durumuna geçmez.

## A5. Durum kontrolü

Her iki aboneliğin de durumu **"Ready to Submit"** olmalı.

| Durum | Anlamı |
|---|---|
| Missing Metadata | Bir alan boş — genelde ekran görüntüsü ya da bir yerelleştirme |
| Ready to Submit | Doğru. Devam edin. |
| Waiting for Review | İlk binary ile birlikte incelemeye gitti |

**Önemli:** İlk abonelik, uygulamanın **ilk binary'siyle birlikte** incelemeye
gider. Yani abonelikler siz uygulamayı gönderene kadar "Ready to Submit"te
bekler — bu normaldir, sandbox testi için yeterlidir.

## A6. In-App Purchase anahtarı (RevenueCat için)

App Store Connect → **Users and Access** → **Integrations** sekmesi →
**In-App Purchase** →  **+** ile anahtar üretin.

| Alan | Değer |
|---|---|
| Key Name | `RevenueCat` |

`.p8` dosyasını indirin. **Bir kez indirilebilir**, kaybederseniz yenisini
üretmeniz gerekir. Yanında görünen **Key ID**'yi de not edin.

## A7. App Store Server Notifications

App Store Connect → uygulamanız → **App Information** → sayfanın altında
**App Store Server Notifications**.

Buraya RevenueCat'in verdiği URL'i gireceksiniz (B2'de alacaksınız).

| Alan | Değer |
|---|---|
| Production Server URL | RevenueCat'ten alınacak |
| Sandbox Server URL | Aynı URL |
| Version | **Version 2** |

Bu, iptal ve iade gibi olayların RevenueCat'e anında ulaşmasını sağlar.
Girmezseniz abonelik durumu geç güncellenir.

---

# BÖLÜM B — RevenueCat

## B1. Proje ve uygulama

1. app.revenuecat.com → kayıt olun → **Create new project**

   | Alan | Değer |
   |---|---|
   | Project name | `Halkora` |

2. Sol menü **Apps** → **+ New** → **App Store**

   | Alan | Değer |
   |---|---|
   | App name | `Halkora iOS` |
   | App Store bundle ID | `com.halkora.app` |

## B2. Apple bağlantısı

Aynı uygulama sayfasında aşağı inin:

| Alan | Ne girilecek |
|---|---|
| **In-App Purchase Key** | A6'da indirdiğiniz `.p8` dosyasını yükleyin |
| **Issuer ID** | App Store Connect → Users and Access → Integrations → sayfanın üstünde yazar |
| **Key ID** | A6'da not ettiğiniz değer |
| **App Store Connect App-Specific Shared Secret** | App Store Connect → uygulamanız → App Information → *App-Specific Shared Secret* → **Manage** → oluşturup kopyalayın |

Kaydettikten sonra RevenueCat size bir **App Store Server Notifications URL**
verir. Onu kopyalayıp **A7**'deki alanlara yapıştırın.

## B3. Ürünler

Sol menü **Product catalog → Products** → **+ New**

İki kez, her ürün için:

| Alan | Aylık | Yıllık |
|---|---|---|
| Store | App Store | App Store |
| Identifier | `com.halkora.app.pro.monthly` | `com.halkora.app.pro.annual` |

> Identifier'lar A2/A3'tekiyle **harfi harfine** aynı olmalı. Sizde farklıysa
> App Store Connect'tekini kullanın.

RevenueCat "Import products" de önerebilir — Apple bağlantısı çalışıyorsa
ürünleri kendi çeker, bu daha güvenli. Çekmiyorsa A0'daki sözleşme aktif
değildir.

## B4. Entitlement — "kullanıcı Pro mu?"

Sol menü **Product catalog → Entitlements** → **+ New**

| Alan | Değer |
|---|---|
| Identifier | `pro` |
| Description | `Halkora Pro` |

Oluştuktan sonra içine girin → **Attach products** → **iki ürünü de** ekleyin.

> Bu adım işin kalbi. Uygulama "hangi ürünü aldın" diye sormaz, sadece
> `pro` entitlement'ı aktif mi diye bakar. Ürünleri buraya bağlamazsanız satın
> alma başarılı olur ama kullanıcı Pro olmaz — ve sebebini bulmak saatler alır.

## B5. Offering — paywall'ın okuduğu liste

Sol menü **Product catalog → Offerings** → **+ New**

| Alan | Değer |
|---|---|
| Identifier | `default` |
| Description | `Halkora Pro planları` |

İçine girin → **+ New Package** iki kez:

| Package | Identifier | Bağlanacak ürün |
|---|---|---|
| Aylık | `$rc_monthly` | `com.halkora.app.pro.monthly` |
| Yıllık | `$rc_annual` | `com.halkora.app.pro.annual` |

`$rc_monthly` / `$rc_annual` RevenueCat'in **standart** paket adları; listeden
seçilir, elle yazılmaz. Uygulama bunlara göre arayacak.

Offering'in **Current** olarak işaretli olduğundan emin olun (yıldız ikonu).

## B6. Webhook — `is_pro`'yu güncelleyen bağlantı

Sol menü **Integrations** → **+ New** → **Webhooks**

| Alan | Değer |
|---|---|
| Webhook URL | `https://hyzowqwjqoxuqvzwxmml.supabase.co/functions/v1/revenuecat-webhook` |
| Authorization header | Aşağıya bakın |
| Event types | **Tümü** (varsayılan) |

**Authorization header** için rastgele uzun bir gizli metin üretin (örneğin
şifre yöneticinizle 40 karakter). Aynı değeri hem buraya hem Supabase'e
gireceğiz — Edge Function'ın "bu istek gerçekten RevenueCat'ten mi geliyor"
sorusunu cevaplaması için.

> `revenuecat-webhook` fonksiyonu henüz yazılmadı — **bu benim işim**, B1–B5
> bittiğinde yazacağım. URL'i şimdiden girebilirsiniz, fonksiyon deploy
> edilene kadar RevenueCat hata alır ve tekrar dener; veri kaybolmaz.

## B7. Public API anahtarı

Sol menü **API keys** → **App-specific keys** altında iOS uygulamanızın
**public** anahtarı (`appl_` ile başlar).

Bu anahtarı bana verin — uygulama koduna girecek. **Secret key'i vermeyin**,
ona ihtiyacım yok.

---

# BÖLÜM C — Bittiğinde bana gönderin

Aşağıdakileri yazın, kalan kodu ben yazayım:

1. **RevenueCat public API key** (`appl_...`)
2. **Ürün kimlikleri** — A2/A3'te ne kullandıysanız (önerdiklerimden farklıysa)
3. **Entitlement identifier** — `pro` kullandıysanız "pro" yazmanız yeterli
4. **Offering identifier** — `default` ise onu yazın
5. **Webhook Authorization değeri** — B6'da ürettiğiniz gizli metin

Bunlarla şunları yazacağım:
- `react-native-purchases` kurulumu ve yapılandırma (`appUserID` = Supabase
  kullanıcı kimliği; webhook'un hangi hesabı Pro yapacağını bilmesinin tek yolu)
- `app/paywall.tsx`'te sabit fiyatların yerine mağazadan gelen gerçek fiyatlar
- Satın alma ve **Satın alımları geri yükle** akışı (bu buton yoksa red sebebi)
- `revenuecat-webhook` Edge Function → `profiles.is_pro`
- Kullanım Şartları / Gizlilik linklerinin paywall'a eklenmesi (Apple şart koşuyor)

---

# EK — Sandbox testi (kod yazıldıktan sonra)

## Test hesabı oluşturma

App Store Connect → **Users and Access** → **Sandbox** → **Test Accounts** → **+**

| Alan | Değer |
|---|---|
| E-posta | Gerçek olmayan ama benzersiz bir adres, örn. `halkora.test1@example.com` |
| Şifre | Not alın |
| Ülke/Bölge | **Türkiye** *(fiyatların ₺ görünmesi için)* |

**Gerçek Apple kimliğinizi kullanmayın.**

## Cihazda kullanma

iPhone → **Ayarlar** → **Geliştirici** → **Sandbox Apple Account** → test
hesabıyla giriş.

> Ayarlar → App Store'daki **asıl** hesabınıza dokunmayın. Sandbox hesabı ayrı
> bir yerde durur. ("Geliştirici" menüsü, cihaz Xcode'a en az bir kez
> bağlandıysa görünür.)

## Süreler sıkışıktır

| Gerçek süre | Sandbox'ta |
|---|---|
| 1 ay | 5 dakika |
| 1 yıl | 1 saat |

Abonelik 6 kez yenilenip otomatik durur. Yani yenilenmeyi ve süre dolmasını
yarım saatte test edebilirsiniz.

## Test listesi

- [ ] Aylık satın alma → Supabase'de `profiles.is_pro` **true** oldu mu
- [ ] Yıllık satın alma
- [ ] Satın almayı yarıda iptal → uygulama çökmüyor, sessizce kapanıyor
- [ ] 3. halkayı kurmayı dene → Pro iken paywall **çıkmamalı**
- [ ] Uygulamayı sil, yeniden kur → **Geri yükle** ile Pro dönüyor mu
- [ ] 5 dakika bekle → yenilendi, `is_pro` hâlâ true
- [ ] Sandbox aboneliğini iptal et → süre dolunca `is_pro` **false** oldu mu
- [ ] Uçak modunda satın almaya çalış → anlamlı hata, çökme yok

## Takılırsanız

| Belirti | Sebep |
|---|---|
| "Ürün bulunamadı" / boş liste | A0 sözleşmesi aktif değil, ya da ürün "Missing Metadata" |
| Simülatörde ürün yok | Sandbox gerçek cihaz ister |
| Satın alma oldu, `is_pro` değişmedi | Webhook kurulu değil, ya da `appUserID` Supabase kimliği değil |
| RevenueCat'te ürün "not found" | Product ID App Store Connect'tekiyle harfi harfine aynı değil |
| Sürekli şifre soruyor | Sandbox'ta normaldir |
