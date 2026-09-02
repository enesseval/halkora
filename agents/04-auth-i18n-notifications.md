# Auth, i18n ve Bildirimler

## Auth

`src/hooks/useAuth.ts` Zustand auth state'ini yönetir. Session AsyncStorage ile
kalıcıdır; başlangıçta `getUser()` ile silinmiş/ölü session doğrulanır. AppState
foreground'da auto refresh başlar, background'da durur. Hesap değişiminde Query
ve mock cache temizlenir.

Giriş seçenekleri anonim ve iOS Apple'dır. Android/web veya Apple capability
uygun değilse Apple action anonim fallback yapar. Anonim hesap Apple identity ile
aynı user id korunarak linklenebilir. Sign out öncesi push token silinir.

Pro satın alma cihazda authoritative değildir. RevenueCat Supabase user id ile
configure edilir; webhook `profiles.is_pro` yazar; uygulama profili okur. Paywall
SDK dosyada mevcut olsa da canlı ürün/offering/configuration ve release durumu
ayrıca doğrulanmalıdır.

## i18n

- `src/i18n/tr.ts`: canonical dictionary
- `src/i18n/en.ts`: `Dictionary = typeof tr` ile şekil eşleşmesi
- `src/i18n/index.ts`: `useT()` React için, `getDict()`/`getLocale()` düz kod için

Yeni görünür string aynı değişiklikte iki sözlüğe eklenir. Component/hook
`useT()`, store/data/plain function `getDict()` kullanır. Edge Function ve Swift
widget kendi küçük TR/EN sözlüğünü taşır; dinamik tarih etiketi mümkünse app'ten
lokalize edilip snapshot'a yazılır.

## Hata modeli

`friendlyErrorMessage()` network hatasını bağlantı mesajına, RLS hatasını genel
hata mesajına indirger. RPC/Edge kodu `isErrorCode()` ile branch edilir; önce
lokalize edip sonra code karşılaştırma. `FunctionsHttpError` gövdesi için
`edgeFunctionError()` kullan.

## Push

Onboarding sonrası gerçek cihaz Expo push token'ı `push_tokens` tablosuna
kullanıcı bazlı yazılır. Token dedupe anahtarı user id + token'dır; aynı cihazda
hesap değişince yeni hesap da kaydedilir. `profiles.locale` sunucu push copy'si
için senkron tutulur. Mesaj içeriği tercihi `notify_message_preview` ile
recipient bazında uygulanır.

Notification payload'ında `challengeId` veya davet için `inviteCode` bulunur;
root layout cold start ve background response'u doğru route'a taşır. Detay
ekranı açıkken aynı challenge bildirimi için foreground banner bastırma davranışı
ayrıca test edilmelidir.
