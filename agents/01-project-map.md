# Proje Haritası

## Ürün

Halkora, insanların günlük bir hedefi grup halinde sürdürdüğü “halka”
uygulamasıdır. Kullanıcı bir challenge oluşturur veya davet koduyla katılır;
her gün check-in yapar. Grup sohbeti, emoji tepkileri, dürtme, joker, bahis,
rövanş, push bildirimleri ve iOS widget vardır.

## Teknoloji

- Expo SDK `~54.0.0`, React Native `0.81.5`, React `19.1.0`
- Expo Router ile dosya tabanlı navigation
- TypeScript, NativeWind, Reanimated, Gesture Handler
- TanStack Query + Zustand
- Supabase Auth, Postgres/RLS, Realtime ve Edge Functions
- RevenueCat SDK mevcut; Pro yetkisi sunucu profilindeki `is_pro` ile okunur
- iOS WidgetKit/AppIntents hedefi: `targets/widget/HalkoraWidget.swift`

## Klasörler

- `app/`: route ekranları. `(auth)`, `(main)`, `challenge/[id]`, `join/[code]`,
  `j/[code]`, `paywall`.
- `src/components/`: tekrar kullanılan görsel bileşenler ve sheet'ler.
- `src/hooks/`: React erişim katmanı. Ekranlar doğrudan `src/data` veya
  `src/stores` import etmez.
- `src/data/`: Supabase sorguları, mutation'lar ve domain tipleri.
- `src/stores/mockStore.ts`: optimistic/local cache ve Supabase yapılandırılmamış
  durumda fallback. Kaldırılmış değildir.
- `src/lib/`: tarih/gün hesabı, Supabase client, hata, push, widget, satın alma,
  invite ve username yardımcıları.
- `src/i18n/`: Türkçe kaynak sözlük, İngilizce eş sözlük ve erişim API'si.
- `src/theme/`: renk, tipografi, spacing ve radius token'ları.
- `supabase/functions/`: Deno Edge Functions.
- `targets/widget/`: Swift widget target ve hedef yapılandırması.
- `assets/`: uygulama ve font varlıkları.
- `agents/`: bu çalışma bağlamı. `docs/` ile karıştırma.

## Ana veri akışı

`app/_layout.tsx` font/splash, Query provider, safe area, auth guard, locale,
push token, notification deep link ve app foreground yönetimini kurar.
Ekranlar `src/hooks/index.ts` üzerinden Zustand cache'i okur. Hook'lar gerçek
modda TanStack Query ile Supabase'ten veri çeker, optimistic işlemleri cache'e
uygular, sonra invalidate/refetch ile sunucu gerçeğine döner. Challenge listesi
değişince `src/lib/widget.ts` App Group snapshot'ı yazar.

## Önemli durumlar

Challenge status tipi: `active`, `completed`, `upcoming`, `lobby`. `upcoming`
ve `lobby` için check-in yoktur. `lobby` başlatılmamış ve `start_date` null'dur.
Tarihli halkalarda `upcoming`/`active` çoğunlukla `start_date` ve gün hesabından
türetilir; DB'deki `completed` authoritative kabul edilir.
