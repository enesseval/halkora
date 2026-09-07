# Halkora Agent Context

Bu klasör, Halkora üzerinde çalışan başka bir AI'ın projeyi yeniden keşfetmeden
işe başlayabilmesi için konu bazlı referanslardır. Her dosya bağımsız okunabilir;
gereksiz dosyaları okumak yerine görevle ilgili olanı seç.

## Okuma sırası

1. Her görevde önce kökteki `AGENTS.md` dosyasını oku. Bu dosya bağlayıcı çalışma
   kurallarını ve geçmişte yaşanmış kritik hataları içerir.
2. Genel yön bulmak için `01-project-map.md` oku.
3. Göreve göre ilgili dosyayı oku:
   - Ekran, navigation, hook veya UI: `02-runtime-and-ui.md`
   - Veri, Supabase, RLS, RPC veya Edge Function: `03-data-and-backend.md`
   - Auth, dil, hata veya push: `04-auth-i18n-notifications.md`
   - Widget veya iOS native: `05-widget-ios.md`
   - Build, env, release veya App Store: `06-build-release.md`
   - Test, saha bulgusu veya bilinen risk: `07-testing-and-pitfalls.md`
4. SQL ayrıntısı gerekiyorsa `docs/` içindeki ilgili SQL dosyasını ve
   `docs/PHASE2-SUPABASE.md` bölümünü ayrıca doğrula. `docs/` gitignore'dadır;
   bu klasördeki dosyalar kalıcı kaynak değil, mevcut çalışma kopyasıdır.

## Kaynak önceliği

Çelişki halinde şu sırayı kullan:

1. Çalışan kod (`app/`, `src/`, `supabase/functions/`, `targets/widget/`)
2. Kök `AGENTS.md`
3. Kök `TESTING.md`, `APPSTORE.md`
4. `docs/` notları ve roadmap'ler

Bir notun güncel olup olmadığını kodla kontrol et. Bu klasör keşif sırasında
doğrulanan mimariyi özetler; kodun yerine geçmez.

## Güvenlik sınırı

`.env`, `keys`, `*.p8`, token, service-role key, kullanıcı verisi veya canlı
Supabase çıktısı bu klasöre yazılmaz. Public client key'in bile gerçek değeri
yerine yalnızca değişken adı belgelenir.
