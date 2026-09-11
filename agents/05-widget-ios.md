# iOS Widget ve Native Sözleşmeler

## Target

Widget target `targets/widget/HalkoraWidget.swift`, config
`targets/widget/expo-target.config.js` içindedir. iOS deployment target 17.0.
App Group değeri üç yerde birebir aynı olmalıdır:

`app.json` entitlement, `expo-target.config.js`, Swift `appGroup`:
`group.com.halkora.app.widget`.

## Snapshot

`src/lib/widget.ts`, aktif/upcoming/lobby challenge'ları App Group içindeki
`activeChallenges` anahtarına yazar. Completed challenge'lar normalde düşürülür.
Swift `HalkoraSnapshot` alanları JS ile aynı isim/tipte kalmalıdır.

Snapshot precomputed `currentDay` veya boolean'a güvenmez; `timezone`,
`startDate`, `deadlineTime`, `checkedInDayKey`, `segments` ve group count gün
anahtarlarını taşır. Böylece uygulama kapalıyken gün döner. JS `cycleStart`,
check-in Edge Function, SQL `challenge_cycle_start` ve Swift cycle hesabı aynı
formülü uygulamalıdır: gün `deadline -> deadline`, default `00:00`.

## Widget davranışları

- Small: 2x2, 16 güne kadar segment, üstünde continuous arc.
- Medium: 4x2, 31 güne kadar segment; pill check-in, kartın kalanı detay.
- Lock Screen: circular/rectangular/inline aksesuarlar.
- Missed ve upcoming görsel olarak waiting/empty'dir; kırmızı kullanılmaz.
- Gold yalnızca joker içindir.
- Widget timeline gün sınırlarında future entry üretir; sık reload'a güvenme.
- Birden fazla halka için App Group cursor ve navigation intent kullanılır.
- Edit Widget ile belirli challenge seçilebilir.

## Kapalı uygulamada check-in

Swift `CheckInIntent`, JS uygulamasını açmadan aynı `check-in` Edge Function'ına
authenticated HTTP çağrısı yapar. JS session token ve refresh token'ı App Group'a
`src/lib/widgetAuth.ts` ile yazar. Widget refresh token döndürürse uygulama
foreground resume'da `reconcileWidgetSession()` ile yenisini benimser; Supabase
refresh token rotation nedeniyle bu akış bozulmamalıdır.

## Teşhis

Settings DEV widget teşhisi native module yokluğu ile App Group entitlement
yokluğunu ayırır. Widget `widgetSeenAt` yazar; uygulama bunu hint için okur.
Simülatör push/token ve bazı native widget doğrulamaları için yeterli değildir;
gerçek iOS cihaz ve yeniden üretilmiş native binary gerekir.
