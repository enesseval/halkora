// Supabase Edge Function — pushes a notification to the OTHER participants of
// a challenge whenever a check-in, chat message, or nudge is inserted.
//
// Deploy + wiring (DB Webhooks + the shared secret below): see
// docs/PHASE2-SUPABASE.md "Ek I". Locale-aware copy: see "Ek N".
//
// Invoked by four Database Webhooks (one per table), each posting the
// standard Supabase webhook payload:
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

// Kept in sync by hand with src/i18n/tr.ts + en.ts — this function runs in
// Deno, isolated from the RN app's bundle, so it can't import those directly.
// Only the copy actually composed server-side needs an entry here: a chat
// message's body is the user's own text (never translated), and titles that
// are just names/challenge titles need no dictionary lookup either.
const COPY = {
  tr: {
    checkedIn: (name: string) => `${name} check-in yaptı ✓`,
    nudgeTitle: 'El salla 👋',
    nudgeBody: 'Sana el salladı — sıra sende.',
    inviteTitle: 'Halka daveti 💌',
    inviteBody: (name: string, challengeTitle: string) => `${name} seni "${challengeTitle}" halkasına davet etti.`,
    someone: 'Biri',
    challengeFallback: 'Halkan',
  },
  en: {
    checkedIn: (name: string) => `${name} checked in ✓`,
    nudgeTitle: 'Nudge 👋',
    nudgeBody: "Someone nudged you — you're up.",
    inviteTitle: 'Ring invite 💌',
    inviteBody: (name: string, challengeTitle: string) => `${name} invited you to "${challengeTitle}".`,
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

    let challengeId: string | undefined;
    let actorUserId: string | undefined;
    // Chat messages carry their own free-text body (never translated); the
    // other two kinds get locale-aware copy composed per recipient below.
    let messageBody: string | undefined;
    // nudges and invites target exactly one recipient; the other two notify
    // every other participant in the challenge.
    let onlyRecipient: string | undefined;

    if (table === 'check_ins') {
      challengeId = record.challenge_id as string;
      const { data: participant } = await admin
        .from('participants')
        .select('user_id')
        .eq('id', record.participant_id as string)
        .single();
      actorUserId = participant?.user_id as string | undefined;
    } else if (table === 'messages') {
      if (record.kind !== 'message') return ok(); // skip system messages
      challengeId = record.challenge_id as string;
      actorUserId = record.user_id as string;
      messageBody = String(record.text ?? '').slice(0, 120);
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

    const [{ data: tokenRows }, { data: recipientProfiles }] = await Promise.all([
      admin.from('push_tokens').select('user_id, token').in('user_id', recipientIds),
      admin.from('profiles').select('id, locale').in('id', recipientIds),
    ]);
    const localeByUser = new Map(
      (recipientProfiles ?? []).map((p) => [p.id as string, p.locale as string | null]),
    );

    const messages = (tokenRows ?? [])
      .filter((r) => r.token)
      .map((r) => {
        const c = copyFor(localeByUser.get(r.user_id as string));
        let title: string;
        let body: string;
        if (table === 'check_ins') {
          title = challengeTitle ?? c.challengeFallback;
          body = c.checkedIn(actorName ?? c.someone);
        } else if (table === 'nudges') {
          title = c.nudgeTitle;
          body = c.nudgeBody;
        } else if (table === 'invites') {
          title = c.inviteTitle;
          body = c.inviteBody(actorName ?? c.someone, challengeTitle ?? c.challengeFallback);
        } else {
          title = `${actorName ?? c.someone} · ${challengeTitle ?? c.challengeFallback}`;
          body = messageBody ?? '';
        }
        return { to: r.token as string, title, body, data: { challengeId, inviteCode } };
      });
    if (messages.length === 0) return ok();

    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      return ok({ sent: 0, expoStatus: res.status });
    }

    return ok({ sent: messages.length });
  } catch (e) {
    // A webhook is fire-and-forget from Postgres's perspective — never let a
    // push failure surface as a DB-visible error. Log-and-200 instead.
    console.error('notify failed', e);
    return ok({ sent: 0, error: e instanceof Error ? e.message : String(e) });
  }
});
