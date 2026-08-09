# Halkora — çalışma kuralları ve saha notları

Bu dosya iki şey içerir: uyulması zorunlu kurallar, ve geçmişte **gerçekten
yaşanmış** hataların kayıtları. İkincisi tarih dersi değil — aynı hataların
tekrar edilmesini engellemek için var. Yeni bir işe başlamadan önce "Tekrar
eden hatalar" bölümünü oku.

---

## 0. Varsayımla iş yapma — bu her şeyin üstünde

Kullanıcının açık talimatı: **hiçbir konuda kendi başına varsayım yapma. Karar
verilmesi gereken her durumda sor, sormadan işlem yapmayı reddet.**

Pratikte bu şu demek:

- Bir davranışın sebebini **bilmiyorsan**, tahmin edip düzeltme yazma. Önce
  kanıt topla: kodu oku, git geçmişine bak, veriye bak. Kanıt yoksa sor.
- Korelasyon kanıt değildir. "Şunu ekledim, sonra bozuldu" cümlesi bir hipotez
  başlatır, bir düzeltmeyi haklı çıkarmaz. Mekanizmayı gösteremiyorsan
  dokunma.
- Talebin kapsamını kendi kendine genişletme. Kullanıcı "uygulama içinde buton
  olmasın" dediyse bu "izin de sorulmasın" demek değildir. Kısıtı sen
  eklediysen, o kısıt gereksinim değil senin varsayımındır — ve seni çıkmaza
  sokar.
- Çalışan bir şeyi "tutarlılık" ya da "iyileştirme" gerekçesiyle değiştirme.
  Değiştirmek gerekiyorsa önce sor.
- Kullanıcının verdiği dökümanı körlemesine uygulama; projeye uymayan yerini
  **söyle**, sonra sor ya da gerekçesini yazarak uygulama.

## 1. Yapmadan önce sorulacak şeyler

- Yeni bağımlılık, yeni config dosyası, yeni klasör yapısı
- Mevcut tasarımı değiştiren her şey ("aksini belirtmedikçe mevcut tasarımı
  koru" — kullanıcının standing kuralı)
- Veri silme / şema değişikliği (kapsamı önce göster)
- Bir özelliği kaldırmak, kapsamı daraltmak
- Birden fazla makul çözüm varsa: hangisi olacağını sor, kendin seçme

## 2. Asla

- **EAS Build önerme.** Kullanıcı lokal build alıyor: `expo prebuild` + Xcode
  Archive.
- `docs/` altına kalıcı bilgi yazma — kullanıcının tarafında `.gitignore`'da,
  push edilse bile ona ulaşmaz. Doküman/SQL teslimi `SendUserFile` ile yapılır.
- Tek dilde string bırakma (bkz. bölüm 4).

---

## 3. Tekrar eden hatalar — gerçek vakalar

### 3.1 Erken `return`'ün altına hook koymak (uygulamayı çökertti, İKİ KEZ)

**Belirti:** Ana ekranda `+` butonuna basınca uygulama tamamen kapanıyor.

**Sebep:** `QuickStartSheet` kalıcı olarak mount edilir ve
`if (!visible) return null;` ile kendini gizler. Bu satırın **altına** konan
her hook, sheet kapalıyken çalışmaz, açılınca çalışır. React önceki render'dan
farklı sayıda hook görür ve hata fırlatır → çökme.

**Kritik ders:** Bu hata iki ayrı commit'te aynı yerden çıktı. Birincisinde
(`usePasteAccessory`) sebebi yanlış teşhis edip native paste kontrolünü suçladım
ve çalışan bir özelliği sildim; ardından bir sonraki commit'te
(`useClipboardCode`) **aynı hatayı aynı yere** tekrar yazdım. Yani yanlış teşhis
sadece zaman kaybettirmedi, hatayı taşıdı.

**Kural:** Bir bileşende erken `return` varsa, tüm hook'lar onun üstünde durur.
Erken `return`'ün altına hiçbir şey eklenmez. `tsc` bunu görmez — ESLint'in
`react-hooks/rules-of-hooks` kuralı görür (bkz. bölüm 5).

### 3.2 Klavye / bottom sheet konumlandırma (dört denemede çözüldü)

**Belirti:** Sheet açılınca input klavyenin altında kalıyor; elle odaklanınca
doğru yere geliyor.

İki ayrı sebep üst üste bindi:

1. **Çerçeve hatası.** Sheet'ler `Screen` içinde render ediliyor; `Screen` bir
   `SafeAreaView` ve `paddingHorizontal: 20` + üst/alt inset taşıyor. Yoga'da
   `position: absolute` çocuklar ebeveynin **padding kutusuna** göre yerleşir.
   Yani `top/left/right/bottom: 0` ekran değil, ekrandan ~20pt dar ve ~34pt kısa
   bir kutu demekti. Klavye yüksekliği ise ekran koordinatında ölçülüyor — iki
   ayrı koordinat sistemi. Çözüm: sheet'i `Modal` içine almak; Modal kendi tam
   ekran penceresinde barınır, `paddingBottom = keyboardHeight` birebir doğru
   olur.
2. **Animasyon yarışı.** Odak hemen verilince klavye `SlideInDown` hâlâ
   çalışırken açılıyor; reanimated giriş animasyonunu **başladığı anda ölçtüğü**
   konuma sürdüğü için kart klavyeden önceki yerine oturup orada kalıyor. Çözüm:
   odağı animasyon bitene kadar geciktirmek (`ENTER_MS`, `SheetOverlay`).

**Yanlış teşhisler (tekrarlama):**
- `KeyboardAvoidingView`: bu sheet'ler için yapısal olarak yanlış. KAV klavye
  yüksekliğini yalnızca **mount olduktan sonra gelen** bir event'ten öğrenir,
  başlangıç değeri sıfırdır. Sheet açıldığında mount olduğu için, klavye zaten
  açıkken açılan ikinci sheet hiç event almaz ve sıfır padding uygular. "İlki
  çalışıyor, sonrakiler çalışmıyor" tarifi tam olarak budur.
- Content'i `ScrollView`'a sarmak: `UsernameSheet`'i bozan şey buydu.
  `NameSheet`'e sarmamıştım ve o çalışıyordu — kullanıcının "isim oldu, kullanıcı
  adı olmadı" raporu birebir bu farkı işaret ediyordu, ben ölçüm hatası sandım.
- `maxHeight: '85%'` gibi kapaklar: tahminle eklendi, hiçbir şeyi çözmedi.

**Ders:** "Elle yapınca çalışıyor, otomatik yapınca çalışmıyor" bir zamanlama
ipucudur, hesap hatası ipucu değil.

### 3.3 Panodan yapıştırma (üç çıkmaz sokak)

Sırayla öğrenilenler:

- iOS'un QuickType çubuğundaki pano önerisi **uygulamanın açabileceği bir şey
  değil**. Hiçbir `TextInput` prop'u onu çağırmaz.
- `textContentType` vermek **zararlıdır**: spesifik bir tip iOS'a o çubuğu kendi
  autofill'iyle doldurtur (`oneTimeCode` → yalnızca Mesajlar'dan gelen kodlar,
  `URL` → yalnızca kayıtlı adresler). Yani istediğin şeyle yarışır.
- `autoCorrect={false}` → `autocorrectionType = .no` → QuickType çubuğu hiç
  çizilmez.
- Apple'ın `UIPasteControl`'ü (`expo-clipboard`'un `ClipboardPasteButton`'ı)
  izin sormadan yapıştırır, ama `InputAccessoryView` içine konduğunda çöktü.
- **Çalışan çözüm:** alan odaklandığında `Clipboard.getStringAsync()`. iOS kendi
  izin sayfasını gösterir, kullanıcı onaylayınca kod doğrudan alana girer
  (`src/hooks/useClipboardCode.ts`). İzin uyarısı bir sorun değildir — kullanıcı
  bunu açıkça onayladı.

**Ders:** Kullanıcı "buton istemiyorum" dedi; ben bunu "izin de istemeyelim"
diye genişletip iki çıkmaz sokağa girdim. Kısıtı kendin uydurma.

### 3.4 Var olmayan sütun varsaymak

`participants.created_at` diye bir sütun olduğunu varsayıp ana ekranı kırdım.
Sütun zaten `joined_at` adıyla vardı. Neredeyse yinelenen bir sütun ekliyordum.
**Şema hakkında hiçbir şey varsayma — `list_tables` ile bak.**

### 3.5 "Bugün:" öneki

`dailyAction` koşulsuz `"Bugün: "` ile öneklenmişti; henüz başlamamış halkada
"bugün" yoktur. Önek yalnızca `status === 'active'` iken eklenir.

### 3.6 FAST_DAYS başlangıç tarihi kapısını atlıyordu

Test modundaki dal, günü `created_at`'ten dakika bazlı türetiyordu; bu yüzden
`currentDay` halka var olur olmaz ≥1 oluyor ve `CHALLENGE_NOT_STARTED` hiç
tetiklenmiyordu. Canlı veriden doğrulandı. Ayrıca RLS'teki `insert own check-in`
politikası her katılımcının istediği `day_number`'ı yazmasına izin veriyordu —
yani Edge Function'daki tüm kontroller tavsiye niteliğindeydi.

---

## 4. i18n zorunludur

Uygulama tamamen yerelleştirilmiş (Türkçe + İngilizce): `src/i18n/tr.ts`
(kaynak), `en.ts` (`Dictionary = typeof tr` ile derleme zamanı eşlik),
`index.ts` (`useT()` bileşen/hook için, `getDict()`/`getLocale()` düz
fonksiyon, store ve hook olmayan kod için).

Yeni bir kullanıcıya görünen metin eklerken:

- String'i **aynı değişiklikte** hem `tr.ts` hem `en.ts` içine ekle. Bileşen,
  hook veya store dosyasında düz metin bırakma.
- Sunucu tarafı: RPC ve Edge Function'lar istemciye hata döndürürken düzyazı
  değil, sabit `UPPER_SNAKE_CASE` kod fırlatır; istemci bunu
  `src/lib/errors.ts` içindeki `t.errors.codes` ile çevirir.
- Push metni üreten Edge Function'lar (Deno'da çalıştıkları için `src/i18n/*`
  import edemezler) kendi küçük `COPY` sözlüklerini elde tutar; alıcının dili
  `profiles.locale`'dan okunur.
- Swift widget de kendi `COPY` sözlüğünü elde tutar.

## 5. Değişiklikten önce çalıştırılacaklar

```
npx tsc --noEmit -p tsconfig.json
npx eslint . --ext .ts,.tsx
```

`tsc` tek başına yeterli değildir — hook kuralı ihlalleri, kullanılmayan
değişkenler ve React'e özgü hataların hiçbirini görmez. Bölüm 3.1'deki çökme
tam olarak bu boşluktan iki kez geçti.

## 6. Expo sürümü

Expo değişti. Kod yazmadan önce sürüme özel dokümana bak:
https://docs.expo.dev/versions/v57.0.0/
