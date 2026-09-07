# Build, Env ve Release

## Expo/native

`app.json` uygulama adı/slug/scheme, iOS bundle id `com.halkora.app`, Android
package `com.halkora.app`, associated domain `applinks:halkora.app`, App Group,
font/notification/splash/build-properties/apple-target plugin'lerini tanımlar.
Generated `/ios` ve `/android` gitignore'dadır. Native değişiklik sonrası lokal
`expo prebuild` ve ardından Xcode Archive süreci kullanılır; EAS Build önerilmez.

Kök AGENTS sürüm dokümanı olarak Expo v57 URL'sini ister; package.json şu anda
Expo `~54.0.0` gösteriyor. Yeni native/API kodunda gerçek package sürümü ile
uyumlu resmi dokümana bak ve bu farkı varsayımla düzeltme.

## Environment

Client build'de gereken değişken adları:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` veya legacy anon key
- `EXPO_PUBLIC_REVENUECAT_IOS_KEY`

`.env` gitignore'dadır. Eksik Supabase env artık import-time crash yerine
placeholder client + yapılandırma hata ekranı üretir; gerçek TestFlight build'in
mock/yanlış backend ile gitmediği cihazdaki DEV uid veya ağ gözlemiyle doğrulanır.
Service role, webhook secret, Apple private key ve APNs key client env'e konmaz.

## EAS config bilgisi

`eas.json` development/preview/production profilleri içerir, production
`autoIncrement` açıktır. Bu repo geçmişinde EAS notları bulunabilir; yerel build
tercihi için release talimatı üretirken `expo prebuild` + Xcode Archive esas
alınmalıdır.

## Apple/Store

Apple Sign In capability, APNs capability/key, associated domain dosyası,
`PrivacyInfo.xcprivacy`, App Store Connect privacy/support URL'leri ve gerçek
RevenueCat/App Store ürünleri release öncesi bağımsız olarak doğrulanmalıdır.
`app.json` build number mevcut olabilir; her upload'ta benzersiz olduğundan emin
ol. Gizli `.p8` dosyalarının adını/değerini dokümana yazma.

## Deploy sırası

SQL migration/RPC değişikliği, ilgili Edge Function deploy'u ve native build
birbirinden bağımlı olabilir. Özellikle bahis v2 için mevcut saha kuralı:
`SQL -> notify deploy -> build`. Deploy komutunu çalıştırmadan önce hedef project
ve environment'ı kontrol et; canlı veride destructive SQL için kapsam/onay al.
