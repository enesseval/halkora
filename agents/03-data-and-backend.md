# Veri ve Supabase

## Tablolar ve domain

Ana tablolar: `profiles`, `challenges`, `participants`, `check_ins`, `messages`,
`message_reactions`, `stakes`, `stake_options`, `stake_votes`, `nudges`,
`invites`, `push_tokens`, `reserved_usernames`.

`participants.joined_at`, kişinin sorumluluğunun başladığı günü belirler.
Katılmadan önceki günler missed veya bahis kaybı sayılmaz. Check-in tipi `done`
veya `joker`; kişi/gün unique'tir. `stakes` v2 bireysel eşik veya kolektif yüzde
hedefi taşıyabilir; eski v2 öncesi kayıtlarda `kind`/eşik null kalabilir.

## Güvenlik

- RLS gerçek güvenlik katmanıdır; istemci guard'ları yalnızca UX'tir.
- Challenge okuma üyelik/owner ile sınırlı, davet önizlemesi dar bir security
  definer RPC ile yapılır.
- Kullanıcının push token'ı `profiles` içinde tutulmaz; co-participant profile
  okuması token sızdırmamalıdır.
- `set_username` RPC'si format, reserved ve unique kontrollerini yapar.
- `find_user_by_username` exact match'tir; prefix enumeration yapılmaz.
- `check-in` Edge Function günü, joker hakkını ve geçmiş günün gerçekten
  eksik olduğunu server-side doğrular. `day_number` client'a güvenilmez.
- `delete-account` yalnızca çağıranın hesabını admin API ile siler; başka
  üyelerin challenge'ı gerektiğinde owner null olacak şekilde korunur.

## RPC sözleşmeleri

Kodda kullanılan kritik RPC'ler: `get_challenge_preview`,
`join_challenge_by_code`, `restart_challenge`, `end_challenge_early`,
`settle_stake`, `delete_challenge`, `close_challenge`, `leave_challenge`,
`start_challenge`, `update_challenge_details`, `set_username`,
`find_user_by_username`, `my_invites`.

RPC hata mesajları prose değil sabit `UPPER_SNAKE_CASE` kod olmalı. İstemci
`src/lib/errors.ts` üzerinden aktif dile çevirir. Bir SQL değişikliği yapmadan
önce gerçek şemayı ve mevcut migration/SQL dosyalarını kontrol et; kolon adı
varsayma.

## Edge Functions

- `check-in`: authenticated çağrı; server-side check-in/joker.
- `notify`: DB webhook'larından check-in/message/nudge/invite olayları için push.
- `evening-reminder`: saatlik cron/pg_net, challenge timezone'una göre hatırlatma.
- `message-digest`: cron tabanlı mesaj özeti.
- `delete-account`: authenticated hesap silme.
- `revenuecat-webhook`: RevenueCat olaylarından `profiles.is_pro` güncelleme.
- `report-alert`: moderasyon bildirimi için mevcut function; ilgili akışın
  gerçekten UI'da açık olup olmadığını ayrıca doğrula.

Webhook/cron ile çağrılan functions `WEBHOOK_SECRET` ve `x-webhook-secret` ile
korunur; service role key yalnızca server secret olarak kalır. Push copy'si
Deno `src/i18n` import edemediği için function içinde TR/EN `COPY` vardır.

## Realtime ve polling

Realtime; challenge listesinde check-in/participant/challenge, detayda ayrıca
message/reaction değişikliklerini invalidate eder. Supabase publication'a ilgili
tablolar eklenmemişse websocket sessizce işe yaramaz; polling yalnızca backstop'tur.
Home yaklaşık 60 saniye, detail chat yaklaşık 20 saniye reconciliation yapar.
