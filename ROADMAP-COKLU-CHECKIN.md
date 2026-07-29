# Çoklu check-in + widget sistemi — yol haritası

Kaynak: "Halkora — Çoklu Check-in + Widget Sistemi Uygulama Talimatı".

Bu dosya o talimatın **koda uyarlanmış** hâli. Talimat uygulamanın mevcut
durumunu bilmeden yazılmış; aşağıda önce çakışmalar ve alınan kararlar,
sonra iş sırası var.

Alınan iki yapısal karar (onaylandı):

- **Halka = challenge.** Talimattaki `challenges[]` ve `rings[]` aynı listenin
  görev ve sosyal yüzü. `ringId` = halkanın kendi id'si. Yeni hiyerarşi yok,
  create/davet/sohbet/bahis akışları olduğu gibi kalıyor.
- **Mevcut widget ailesi korunuyor**, talimattaki davranışlar içine yediriliyor.
  Hiçbir çalışan widget silinmiyor.

---

## 0. Talimatın düzeltilmesi gereken noktaları

Sırayla, en yüksek riskli olandan.

### 0.1 🔴 `daily_checkins` diye bir tablo yok — ve mevcut şema günde tek satıra kilitli

Talimat `daily_checkins(current_count, last_action_at, date_key)` varsayıyor.
Gerçek şema:

```
check_ins(participant_id, challenge_id, day_number, type∈{done,joker}, created_at)
UNIQUE (participant_id, day_number)
```

Yani **günde tek satır** — çoklu check-in'in önündeki asıl engel bu unique
kısıtı. İki seçenek vardı:

- **(Seçilen) Olay modeli:** unique kısıtı kaldırılır, her check-in bir satır
  olarak kalır, `current_count = o güne ait satır sayısı`. Check-in **saatleri**
  korunur — "Sen 5. tamamlayansın" ve sohbetteki saat damgası bunlara bağlı.
  Tek doğruluk kaynağı vardır.
- **(Reddedilen) Sayaç kolonu:** ayrı bir `daily_checkins` sayaç tablosu, satır
  sayısı ile sayacın ayrışabildiği iki doğruluk kaynağı demek. Ayrıca mevcut
  bütün sorgular yeniden yazılırdı.

**Bunun bedeli:** bugün `check_ins` satır sayan her yer "gün sayısı" demek
istiyor. Çoklu check-in'de satır ≠ gün. Denetlenecek yerler:

| Yer | Bugün | Olması gereken |
|---|---|---|
| `src/data/challenges.ts` `completedDays` | `filter(...).length` | `distinct day_number` |
| `src/data/challenges.ts` `finishStats.checkins` | satır sayısı | karar: gün mü, ham check-in mi |
| `src/data/stakeOutcome.ts` `done` | satır sayısı | `distinct day_number` |
| `docs/db-stake-v2.sql` `settle_stake` → `done` | `count(*)` | `count(distinct day_number)` |
| `advancedStats.leaderboard.myDays` | zaten `Set<day_number>` | ✅ değişmez |
| `advancedStats.perfectDayNumbers` | `coveredByDay` seti | ✅ değişmez (Set) |
| `check-in` Edge Function joker sayımı | `type='joker'` satır sayısı | ✅ değişmez (joker günde 1) |
| `segmentsOf()` / `days[]` | gün başına tek durum | ✅ değişmez (binary) |

Unique kısıtının yerini **sunucu tarafı tavan** alır: Edge Function `target_count`
üstünde yazmayı reddeder. Kısıt kaldırılınca istemciden sınırsız satır
basılabilir hâle gelir; bu boşluk açıkta bırakılamaz.

### 0.2 🔴 `date_key` kullanıcı saat dilimine göre olamaz

Talimat: "gün sınırı kullanıcı timezone'una göre". Uygulamada gün sınırı
**halkanın kendi timezone'u** (`challenges.timezone`) ve bu bilinçli bir karar —
`src/data/challenges.ts`, `check-in` Edge Function ve widget'ın Swift tarafı
hepsi bu değeri aynı şekilde hesaplıyor.

Kullanıcı bazlı gün sınırına geçilirse: farklı saat dilimindeki iki katılımcı
için "bugün" farklı olur, "4/8 tamamladı" anlamsızlaşır, bahis gün sayımı
kişiden kişiye kayar, "kusursuz gün" hesabı çöker. Grup adaleti bunun üstüne
kurulu.

**Karar:** `date_key` = halkanın timezone'undaki `YYYY-MM-DD`. Zaten
`dayKeyFor()` (JS) ve `todayKey(at:)` (Swift) bunu üretiyor. Kullanıcı profiline
timezone kolonu **eklenmiyor**.

Talimatın "seyahatte çift sayım olmaz" kabul kriteri bu kararla zaten sağlanıyor
— gün sınırı cihaz saatinden bağımsız.

### 0.3 🔴 EAS Build kullanılmıyor

Talimat "build EAS ile alınır" diyor. Bu projede build **yerel**: `expo prebuild`
+ Xcode Archive. Yol haritasının hiçbir adımı EAS'a bağlanmayacak.

### 0.4 🟡 "Widget yok" — var

Talimatın açılış cümlesi yanlış. Şu an yazılı ve kısmen cihazda doğrulanmış olan:

- Home: `HalkoraSmallWidget`, `HalkoraMediumWidget`, `HalkoraLargeWidget`,
  `HalkoraListWidget` ("Bugün"), `HalkoraStreakWidget` ("Seri")
- Lock: `HalkoraLockWidget` (circular/rectangular/inline),
  `HalkoraLockTodayWidget`, `HalkoraLockStreakWidget`
- App Group üzerinden snapshot, `CheckInIntent` ile **doğrudan ağdan** check-in,
  gün dönümünü kendi hesaplayan zaman çizelgesi, halkalar arası rotasyon

Talimattaki widget'lar bunların **yerine** değil, **içine** giriyor:

| Talimattaki | Karşılığı |
|---|---|
| Lock Circular "Günlük Ring" | `HalkoraLockTodayWidget` (zaten kapanan halka göstergesi) |
| Lock Rectangular "Smart Mode" | `HalkoraLockTodayWidget` rectangular dalı → öncelik algoritmasıyla değiştirilecek |
| Home Small "Ring Durumu" | `HalkoraSmallWidget` + üye satırı eklenecek (roster zaten senkronize) |
| Home Medium "Dashboard" | `HalkoraListWidget` ("Bugün") — en yakın karşılık, üst satır + alt şerit eklenecek |

### 0.5 🟡 App Group adı ve köprü zaten var

- Talimat: `group.com.halkora.shared` → **gerçek:** `group.com.halkora.app.widget`
  (`app.json` ios.entitlements + `targets/widget/expo-target.config.js`).
  Değiştirmek provisioning'i kırar, bir kazancı yok. **Mevcut ad kalıyor.**
- Talimat "expo-shared-preferences benzeri köprü veya küçük bir Expo modülü
  yazılır" diyor. Yazılmasına gerek yok: `@bacons/apple-targets`'ın
  `ExtensionStorage`'ı zaten bu işi yapıyor (`set` + `reloadWidget`), `src/lib/widget.ts`
  onu kullanıyor. **Yeni native modül yazılmayacak.**
- Supabase token'ları zaten App Group'a yazılıyor (`src/lib/widgetAuth.ts`),
  Keychain access group'a değil. Çalışıyor, refresh token rotasyonu da ele
  alınmış (`reconcileWidgetSession`). **Değiştirilmeyecek.**

### 0.6 🟡 `completion_mode` bir "challenge tipi"nden gelemez — tip diye bir alan yok

Talimat modun "challenge şablonundan otomatik gelmesini" istiyor. `TEMPLATES`
(`src/data/mock.ts:286`) sadece create ekranındaki 5 hazır metin; halkaya
kaydedilmiyor, veritabanında karşılığı yok. Kullanıcı zaten çoğu zaman kendi
başlığını yazıyor.

**Karar:** `completion_mode` create ekranında **türetilir, sorulmaz**:
- Şablon seçildiyse şablonun modu (şablon tanımına `mode` + `sfSymbol` eklenir).
- Serbest metin yazıldıysa varsayılan `app_only` (en muhafazakâr: widget'ta
  buton yok, derin bağlantı var).
- `targetCount > 1` seçilmişse `quick_check`'e yükseltilir — günde 8 kez
  yapılacak bir şeyin her seferinde uygulamayı açtırması özelliğin amacını
  bozar.

Ayrıca `sfSymbol` kolonu gerekiyor (kilit ekranında emoji soluk kalıyor, bu
tespit doğru). Şablonu olmayan halkalar için nötr bir varsayılan: `circle.dashed`.

### 0.7 🟡 `.after(30 dakika)` çalışmıyor — bu daha önce test edildi

Talimat "Timeline policy: `.after(30 dakika)`" diyor. Bu projede zaten denendi
ve **başarısız oldu**: iOS yenileme bütçesi sessizce kısıyor, widget donuyor
(saha testi: "widgetlar uygulama arka planda açık dahi olsa güncellenmiyor").
Çalışan desen, tek zaman çizelgesinde **önceden hesaplanmış çok sayıda ileri
tarihli girdi** göndermek — WidgetKit aralarında bütçe harcamadan geçiyor.
Mevcut kod bunu yapıyor ve korunacak.

Silent push tarafı talimattaki gibi kalabilir (best-effort).

### 0.8 🟡 İki tanım eksik

- **`streak`** (snapshot'taki `7`): bugüne kadar hiç tanımlanmadı. Halka içi seri
  mi, bütün halkalar üzerinden "hiçbir şeyi kaçırmadığın gün" mü? Widget'taki
  `Seri` şu an **halka içi** sayıyor. Snapshot'taki global `streak` için karar
  gerekiyor. **Öneri:** "aktif halkalarının **hepsini** kapattığın üst üste gün
  sayısı" — dashboard'daki `4/6` ile aynı dili konuşur.
- **Joker × targetCount:** joker bir **günü** kapatıyor, tek check-in'i değil.
  Yani 8 hedefli bir günde joker kullanılırsa gün tamamlanmış sayılır, sayaç
  `8/8`'e çekilmez ama `completed` olur. Halka görünümünde altın segment.
  Talimat bu etkileşime hiç değinmiyor.

### 0.9 🟢 iOS 16

Talimattaki iOS 16 geri dönüşü (B6.5) **uygulanmayacak** — proje deployment
target'ı 17.0. Buton API'si her zaman var.

---

## 1. İş sırası

Her adımın sonunda `npx tsc --noEmit` + web bundle + commit.

### Adım 1 — Şema ve sunucu (Bölüm A çekirdeği)

- [ ] `challenges`: `target_count int not null default 1 check (between 1 and 99)`,
      `completion_mode text not null default 'app_only'`, `sf_symbol text`,
      `require_in_app_checkin boolean not null default false`
- [ ] `check_ins`: `UNIQUE(participant_id, day_number)` **kaldırılır**;
      `(participant_id, day_number)` index'i kalır
- [ ] `increment_checkin` **yazılmıyor** — mantık zaten `check-in` Edge
      Function'ında ve orada kalmalı: gün hesabı, joker izni, FAST_DAYS, üyelik
      kontrolü hepsi orada. Yeni bir RPC ikinci bir doğruluk kaynağı olurdu.
      Bunun yerine Edge Function `amount` (+1 / −1) kabul edecek ve
      `{ current_count, target_count, completed }` döndürecek şekilde genişletilir.
      Widget App Intent'i de aynı Edge Function'ı çağırıyor (zaten öyle yapıyor).
- [ ] Tavan kontrolü: `current_count >= target_count` iken +1 reddedilir
      (`TARGET_REACHED`)
- [ ] `settle_stake` içindeki `done` sayımı `count(distinct day_number)`'a çevrilir
- [ ] Migration geriye dönük temiz: mevcut halkalar `target_count = 1`,
      davranış birebir aynı

### Adım 2 — İstemci veri katmanı

- [ ] `Challenge` tipine `targetCount`, `completionMode`, `sfSymbol`,
      `requireInAppCheckin`; `todayCount` (bugünkü satır sayısı)
- [ ] §0.1 tablosundaki her sayım yeri denetlenir ve `distinct day_number`'a
      çevrilir — **bu adım atlanırsa bahis ve bitiş istatistikleri sessizce yanlış olur**
- [ ] `insertCheckIn` → `amount` parametresi
- [ ] Mock store aynı davranışı taklit eder (demo gerçek moddan ayrışmasın)

### Adım 3 — Uygulama içi UI

- [ ] Create: "Günde kaç kez?" stepper (1–99, default 1). 1'de bırakılınca
      hiçbir ek arayüz görünmez
- [ ] Detay: `targetCount > 1` ise merkezdeki check-in butonu sayaç moduna
      geçer (`5/8` + `+`), hedefe ulaşınca kilitlenir
- [ ] Son artıştan sonra 60 sn "geri al" → `amount: -1`
- [ ] Katılımcı satırlarında sonuç **binary** kalır; yanında küçük `5/8`
- [ ] Owner ayarlarına `require_in_app_checkin` toggle'ı
- [ ] i18n: her yeni metin `tr.ts` **ve** `en.ts`

### Adım 4 — Derin bağlantılar

- [ ] `halkora://dashboard`, `halkora://ring/{id}`, `halkora://challenge/{id}`
      expo-router'a bağlanır (`ring` ve `challenge` aynı ekrana gider — halka = challenge)
- [ ] Cold start testi

### Adım 5 — Snapshot sözleşmesi v2

- [ ] `src/lib/widget.ts` talimattaki alanları da yazar: `version`, `dateKey`,
      `streak`, `daily{total,completed}`, challenge başına
      `target/current/completed/mode/sfSymbol`, `smartQueue`
- [ ] `smartQueue` §B5'teki önceliklendirmeyle **TypeScript'te** hesaplanır,
      akşam eşiği config sabiti
- [ ] Swift `HalkoraSnapshot` yeni alanları opsiyonel okur (eski snapshot
      çözülmeye devam etsin)

### Adım 6 — Widget davranışları

- [ ] `HalkoraListWidget` ("Bugün") → Dashboard: üst satır `Halkora · ◔ 4/6 · 🔥7`,
      orta `smartQueue`'dan en fazla 3 tamamlanmamış, alt şerit birincil halka
- [ ] `HalkoraLockTodayWidget` rectangular → Smart Mode önceliklendirmesi
- [ ] `HalkoraSmallWidget` → üye satırı (roster zaten senkronize)
- [ ] Sayaçlı halkalarda `+` butonu; `app_only` / `require_in_app_checkin` /
      `automatic` olanlarda buton yok, derin bağlantı var
- [ ] Gece yarısı: `dateKey` bugünle uyuşmuyorsa boş "yeni gün" durumu

### Adım 7 — Çevrimdışı kuyruk

- [ ] App Intent başarısız olursa App Group'ta `pending_ops`
- [ ] Uygulama açılışında kuyruk senkronize edilir (increment olduğu için
      sıra bağımsız)

### Adım 8 — Silent push

- [ ] `notify` Edge Function'a `content-available: 1` dalı
- [ ] Uygulama arka planda uyanınca snapshot tazelenir + `reloadWidget()`
- [ ] Best-effort; gelmezse zaman çizelgesi zaten kendini taşıyor

### Adım 9 — Test

- [ ] `TESTING.md`'ye yeni bölüm: çoklu check-in, sayaç, geri alma, tavan,
      gece yarısı, çevrimdışı kuyruk, widget buton görünürlüğü
- [ ] Talimattaki kabul kriterleri oraya madde madde geçirilir

---

## 2. Riskler

- **§0.1'deki sayım denetimi en riskli iş.** Kaçırılan tek bir `count(*)` bahsi
  sessizce yanlış hesaplar — kimse ödemez ya da herkes öder, ve bu ancak halka
  bittiğinde ortaya çıkar.
- **Unique kısıtı kaldırılınca** istemci sınırsız satır basabilir hâle gelir.
  Sunucu tavanı aynı sürümde girmeli.
- **Kolektif bahis** hâlâ en az kanıtlanmış parça; çoklu check-in toplam
  check-in sayısını şişireceği için `settle_stake`'in kolektif dalı da
  `distinct day_number`'a çevrilmeli, yoksa hedef kendiliğinden tutar.
