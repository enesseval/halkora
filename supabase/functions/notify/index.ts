// Supabase Edge Function — pushes a notification to the OTHER participants of
// a challenge whenever a check-in, chat message, or nudge is inserted
// (invites too — see below).
//
// Chat messages push INSTANTLY again (saha testi bulgusu — the periodic
// digest this used to batch into, supabase/functions/message-digest, read as
// messages just not arriving). Each recipient's own
// profiles.notify_message_preview controls whether the push body shows the
// real message text or a generic "sent a message" — see docs/db-nudge-and-message-notify.sql.
// If message-digest's pg_cron job is still scheduled, unschedule it
// (`select cron.unschedule('message-digest');`) — instant + hourly-batched
// pushes for the same messages would double-notify people.
//
// A nudge carries its own chosen message (`nudges.message`, one of a
// handful of picker options — src/components/Sheets.tsx's NudgeMessageSheet)
// instead of always the same generic line; nudgeBody below is only the
// fallback for a null/old-format message.
//
// Deploy + wiring (DB Webhooks + the shared secret below): see
// docs/PHASE2-SUPABASE.md "Ek I". Locale-aware copy: see "Ek N".
//
// Invoked by Database Webhooks (one per table), each posting the standard
// Supabase webhook payload:
//   { type: 'INSERT', table: 'check_ins' | 'messages' | 'nudges' | 'invites', record: {...} }
//
// Deployed with --no-verify-jwt (the caller is Supabase's own webhook
// dispatcher, not a signed-in user) — WEBHOOK_SECRET is what stands in for
// auth here. Without it, anyone who finds this function's URL could POST a
// fake payload and push arbitrary notifications to real users.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET');

// Push bodies shouldn't blow up over a long pasted message.
const MESSAGE_PREVIEW_MAX = 120;
function truncate(text: string): string {
  return text.length > MESSAGE_PREVIEW_MAX ? `${text.slice(0, MESSAGE_PREVIEW_MAX - 1)}…` : text;
}

// Kept in sync by hand with src/i18n/tr.ts + en.ts — this function runs in
// Deno, isolated from the RN app's bundle, so it can't import those directly.
// Only the copy actually composed server-side needs an entry here: a chat
// message's body is the user's own text (never translated), and titles that
// are just names/challenge titles need no dictionary lookup either.
//
// Three-tier layout (saha testi bulgusu, referencing a WhatsApp screenshot:
// "fotoğraf eklenirse fotoğraf yoksa isim altında challange adı onunda
// altında bildirim içeriği olsa") — title=sender name, subtitle=challenge
// name, body=content. `subtitle` is iOS-only (Expo silently drops it on
// Android); no real photo/avatar — that needs a profile-photo feature this
// app doesn't have yet PLUS a native Notification Service Extension, well
// beyond an Edge Function change.
const COPY = {
  tr: {
    nudgeBody: 'Sana el salladı — sıra sende.',
    messageBodyHidden: 'Yeni bir mesaj gönderdi',
    inviteBody: 'Seni halkasına davet etti 💌',
    rematchBody: (challengeTitle: string) => `"${challengeTitle}" için rövanş başlattı. Var mısın? 🔁`,
    someone: 'Biri',
    challengeFallback: 'Halkan',
  },
  en: {
    nudgeBody: "Someone nudged you — you're up.",
    messageBodyHidden: 'Sent a new message',
    inviteBody: 'Invited you to their ring 💌',
    rematchBody: (challengeTitle: string) => `Started a rematch of "${challengeTitle}". You in? 🔁`,
    someone: 'Someone',
    challengeFallback: 'Your ring',
  },
} as const;

type Locale = keyof typeof COPY;

function copyFor(locale: string | null | undefined): (typeof COPY)['tr'] {
  return COPY[(locale as Locale) ?? 'tr'] ?? COPY.tr;
}

type WebhookPayload = {
  table: 'check_ins' | 'messages' | 'nudges' | 'invites';
  record: Record<string, unknown>;
};

function ok(body: Record<string, unknown> = { sent: 0 }): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    status: 200,
  });
}

function unauthorized(): Response {
  return new Response(JSON.stringify({ error: 'unauthorized' }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    status: 401,
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  // Fail closed: no secret configured means no calls are trusted, not "allow
  // everything". Set WEBHOOK_SECRET (supabase secrets set) and the matching
  // DB Webhook header before this function is useful.
  if (!WEBHOOK_SECRET || req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
    return unauthorized();
  }

  try {
    const payload = (await req.json().catch(() => null)) as WebhookPayload | null;
    if (!payload?.table || !payload.record) return ok();

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { table, record } = payload;

    // messages.notify_others (docs/db-nudge-and-message-notify.sql) is the
    // one real gate here — a nudge's own system message sets it false since
    // the nudge already sent its own targeted push via the nudges table
    // (this would otherwise double-notify the recipient for one nudge), but
    // a challenge-details-change system message leaves it true (default) so
    // it's worth pushing to the group, same as a real chat message.
    if (table === 'messages' && record.notify_others === false) return ok();

    let challengeId: string | undefined;
    let actorUserId: string | undefined;
    // nudges and invites target exactly one recipient; check_ins and
    // messages notify every other participant in the challenge.
    let onlyRecipient: string | undefined;

    if (table === 'check_ins') {
      // Saha testi bulgusu: check-in bildirimi istenmiyor — grup zaten chate
      // bakarak/counterlarla kimin check-in yaptığını görüyor, ayrıca push
      // gürültüsü olmasın. notify-checkin DB Webhook'u silmek daha temizdir
      // (bkz. docs/db-nudge-and-message-notify.sql) ama webhook duruyor olsa
      // bile burada no-op — çift güvence.
      return ok();
    } else if (table === 'messages') {
      challengeId = record.challenge_id as string;
      actorUserId = record.user_id as string;
    } else if (table === 'nudges') {
      challengeId = record.challenge_id as string;
      actorUserId = record.from_user as string;
      onlyRecipient = record.to_user as string;
    } else if (table === 'invites') {
      challengeId = record.challenge_id as string;
      actorUserId = record.from_user as string;
      onlyRecipient = record.to_user as string;
    } else {
      return ok();
    }
    if (!challengeId || !actorUserId) return ok();

    const [{ data: challenge }, { data: actorProfile }] = await Promise.all([
      admin.from('challenges').select('title, invite_code').eq('id', challengeId).single(),
      admin.from('profiles').select('name').eq('id', actorUserId).single(),
    ]);
    const actorName = actorProfile?.name as string | undefined;
    const challengeTitle = challenge?.title as string | undefined;
    // Recipient of an 'invites' row isn't a participant yet — RLS would block
    // them from reading the challenge if the app routed them straight to
    // /challenge/{id} on tap, so that tap needs the invite CODE instead
    // (routes to the public join-preview screen, docs "Ek O" follow-up).
    const inviteCode = table === 'invites' ? (challenge?.invite_code as string | undefined) : undefined;

    let recipientIds: string[];
    if (onlyRecipient) {
      recipientIds = [onlyRecipient];
    } else {
      const { data: participants } = await admin
        .from('participants')
        .select('user_id')
        .eq('challenge_id', challengeId)
        .neq('user_id', actorUserId);
      recipientIds = (participants ?? []).map((p) => p.user_id as string);
    }
    if (recipientIds.length === 0) return ok();

    const [{ data: tokenRows }, profilesResult] = await Promise.all([
      admin.from('push_tokens').select('user_id, token').in('user_id', recipientIds),
      admin.from('profiles').select('id, locale, notify_message_preview').in('id', recipientIds),
    ]);
    // notify_message_preview might not exist yet if
    // docs/db-nudge-and-message-notify.sql hasn't been run — never let that
    // silently kill EVERY notification type (check-ins, nudges, invites too,
    // not just messages), which is what happened when this column was
    // selected unconditionally: the whole query threw, the outer catch below
    // swallowed it, and nothing sent. Fall back to locale-only and default
    // every preview to "shown" (the column's own DB default) until the
    // migration actually runs.
    let recipientProfiles = profilesResult.data;
    if (profilesResult.error) {
      console.error('profiles select w/ notify_message_preview failed, falling back', profilesResult.error);
      const fallback = await admin.from('profiles').select('id, locale').in('id', recipientIds);
      recipientProfiles = fallback.data;
    }
    const localeByUser = new Map(
      (recipientProfiles ?? []).map((p) => [p.id as string, p.locale as string | null]),
    );
    // Per-recipient "show the real message text in the push, or just say
    // someone sent one" — defaults to showing it (matches the column's own
    // DB default) so a profile row fetched before this feature existed still
    // behaves the same as it always did.
    const previewByUser = new Map(
      (recipientProfiles ?? []).map((p) => [p.id as string, (p as { notify_message_preview?: boolean }).notify_message_preview ?? true]),
    );

    const messages = (tokenRows ?? [])
      .filter((r) => r.token)
      .map((r) => {
        const c = copyFor(localeByUser.get(r.user_id as string));
        const title = actorName ?? c.someone;
        const subtitle = challengeTitle ?? c.challengeFallback;
        let body: string;
        if (table === 'messages') {
          if (record.kind === 'message') {
            const showPreview = previewByUser.get(r.user_id as string) ?? true;
            body = showPreview ? truncate((record.text as string) ?? '') : c.messageBodyHidden;
          } else {
            // A system announcement (e.g. a challenge-details change) is
            // already a complete, safe-to-show sentence — no content-hiding
            // (there's no private content here to hide).
            body = truncate((record.text as string) ?? '');
          }
        } else if (table === 'nudges') {
          body = (record.message as string | null) || c.nudgeBody;
        } else {
          // A rematch invite reads differently from a first-time one — the
          // recipient already knows the group (invites.kind, see
          // docs/db-stake-v2.sql).
          body =
            record.kind === 'rematch'
              ? c.rematchBody(challengeTitle ?? c.challengeFallback)
              : c.inviteBody;
        }
        return { to: r.token as string, title, subtitle, body, data: { challengeId, inviteCode } };
      });
    if (messages.length === 0) return ok();

    // Expo's push endpoint accepts at most 100 messages per request — group
    // size is deliberately uncapped, so send in chunks instead of one POST
    // that would be rejected (or partially dropped) past that limit.
    let sent = 0;
    for (let i = 0; i < messages.length; i += 100) {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(messages.slice(i, i + 100)),
      });
      // res.ok only reflects Expo's HTTP-level acceptance of the batch — a
      // per-message rejection (DeviceNotRegistered, InvalidCredentials, ...)
      // still comes back with HTTP 200 nested inside the body, so it'd never
      // otherwise show up anywhere in this function's logs.
      const resBody = await res.text();
      console.log('notify: expo push response', { status: res.status, body: resBody });
      if (res.ok) sent += Math.min(100, messages.length - i);
    }

    return ok({ sent });
  } catch (e) {
    // A webhook is fire-and-forget from Postgres's perspective — never let a
    // push failure surface as a DB-visible error. Log-and-200 instead.
    console.error('notify failed', e);
    return ok({ sent: 0, error: e instanceof Error ? e.message : String(e) });
  }
});
