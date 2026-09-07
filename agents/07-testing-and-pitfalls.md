# Test, Saha Bulguları ve Riskler

## Zorunlu doğrulama

Kod değişikliklerinden sonra kök AGENTS'teki iki komut çalıştırılır:

```text
npx tsc --noEmit -p tsconfig.json
npx eslint . --ext .ts,.tsx
```

Manuel uçtan uca kontrol için kökteki `TESTING.md` ana checklist'tir. Gerçek
push, Universal Link, widget, Apple login ve iki kullanıcı davranışı gerçek cihaz
ve çoğu zaman iki hesap ister.

## Tekrar edilmemesi gereken hatalar

- Erken `return` altına hook ekleme: React hook sayısı render'lar arasında
  değişir ve uygulama açılırken değil sheet açılırken çökebilir.
- Sheet'i SafeArea/padding çerçevesine absolute yerleştirme: keyboard yüksekliği
  ekran koordinatında, parent padding kutusu farklıdır. Modal kullan.
- `KeyboardAvoidingView`, rastgele ScrollView veya `maxHeight` ile sheet sorunu
  tahmin ederek çözme; zamanlama ve koordinat sistemini ölç.
- iOS QuickType pano önerisini uygulama kontrolü sanma. Pano için mevcut çalışan
  yaklaşım `useClipboardCode.ts` odaklanınca `Clipboard.getStringAsync()`.
- `textContentType`/`autoCorrect={false}` ile pano/QuickType davranışını bozma.
- Şemada olmayan kolon varsayma; özellikle `joined_at` ile `created_at` farkını
  kontrol et.
- `dailyAction` başına koşulsuz “Bugün:” koyma; yalnızca active halkada eklenir.
- FAST_DAYS kullanma veya geri getirme. Çok günlük test için
  `challenges.start_date` geriye alınır; ürün kapısını atlayan test modu yok.
- Widget/Edge/SQL/JS gün hesabını birbirinden bağımsız değiştirme.
- Stale refetch ile challenge veya chat listesini küçültme; optimistic state'i
  başarısız mutation'da rollback et.
- Account switch/delete sonrası Query/Zustand cache ve push token temizliğini
  atlama.

## Test öncesi backend kontrolü

- Build'in gerçek Supabase env ile geldiğini kontrol et.
- Gerekli SQL migration'ların canlı projede çalıştığını doğrula.
- `check-in`, `delete-account`, `notify`, `evening-reminder` function'larının
  güncel deploy edildiğini ve JWT/secret modunun doğru olduğunu kontrol et.
- Realtime publication ve DB webhook/cron bağlantılarını doğrula.
- Push için APNs capability/key ve gerçek cihaz kullan.

## Belgelenen mevcut riskler

`APPSTORE.md` ve `TESTING.md` içindeki açık maddeler release kapısı olarak
değerlendirilir. Özellikle paywall ürünlerinin canlılığı, UGC moderasyonu,
privacy/support sayfaları, privacy manifest, Universal Link domain yayını,
gerçek push ve widget temiz kurulum testi koddan tek başına kanıtlanamaz.
