# Runtime, Routes ve UI

## Auth-aware routing

`app/_layout.tsx` içindeki guard şu akışı uygular:

- Supabase env yoksa yapılandırma hata ekranı gösterilir.
- Oturum yoksa `/(auth)/welcome`.
- Oturum var ama profil adı yoksa `/(auth)/onboarding`.
- Oturum var ve onboarding tamam ise `/(main)` home.
- `/join/{code}` ve `/j/{code}` deep link'i auth/onboarding yönlendirmesinde
  kaybolmaması için `src/lib/pendingInvite.ts` ile saklanır.
- Push response içindeki `inviteCode` join ekranına, `challengeId` detay ekranına
  götürür.

## Route listesi

- `(auth)/welcome.tsx`: anonim veya Apple ile giriş
- `(auth)/onboarding.tsx`: isim, hedef/akış ve izin adımları
- `(auth)/start.tsx`: oluştur/katıl seçimi
- `(main)/index.tsx`: bugün yapılacaklar, yapılanlar, yaklaşanlar, geçmiş
- `(main)/create.tsx`: challenge oluşturma
- `(main)/settings.tsx`: profil, dil, bildirim tercihi, hesap, DEV araçları
- `challenge/[id]/index.tsx`: halka detay, check-in, participant, chat, owner işlemleri
- `challenge/[id]/invite.tsx`: link/kod ve username daveti
- `challenge/[id]/complete.tsx`: sonuç, bahis, gelişmiş istatistik, rövanş
- `challenge/[id]/share.tsx`: paylaşım kartı
- `join/[code].tsx`, `j/[code].tsx`: public davet önizlemesi ve katılım
- `paywall.tsx`: Pro ekranı

## Veri erişim sözleşmesi

Ekranlar yalnızca `src/hooks/index.ts` içinden hook/action kullanır. Buradaki
`useChallengesQuery`, `useChallenge`, `useCheckIn`, `useChallengeMessages`,
`useRealtimeChallenge`, `useChallengeActions`, `useCreateChallenge` ve `useJoin`
ana sözleşmedir. Yeni ekranı doğrudan Supabase sorgularıyla bağlama.

Challenge listesi refetch ile küçültülmez; stale/out-of-order cevaplar daha önce
veriyi siliyordu. Chat mesajları ayrı query'dir; challenge fetch'i chat'i boş
listeyle ezmemelidir. Optimistic mesaj/check-in/joker başarısız olursa rollback
ve kullanıcıya lokalize hata gerekir.

## UI kuralları

- Renkler `src/theme/tokens.ts` içinden gelir. Koyu zemin, tek ana vurgu
  `ember`, joker için `joker`; ürün prensibi olarak kırmızı yoktur.
- Uygulama fontları `GeneralSans-*` ve `Satoshi-*`; widget kendi font bundle'ına
  sahiptir.
- Kullanıcıya görünen her metin i18n'den gelmelidir.
- Bir bileşende erken `return` varsa bütün hook'lar return'den önce olmalıdır.
- Sheet'ler tam ekran `Modal` koordinat sistemini ve klavye yüksekliğini kullanır;
  `Screen` padding'i içinde absolute sheet yapma.
- Klavye/animasyonlu sheet'te otomatik focus giriş animasyonu bittikten sonra
  verilmelidir. `ScrollView`, `KeyboardAvoidingView` veya rastgele `maxHeight`
  eklemek geçmişte davranışı bozdu.
