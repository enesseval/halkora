// Supabase Edge Function — pushes a notification to the OTHER participants of
// a challenge whenever a check-in, chat message, or nudge is inserted.
//
// Deploy + wiring (DB Webhooks + the shared secret below): see
// docs/PHASE2-SUPABASE.md "Ek I".
//
// Invoked by three Database Webhooks (one per table), each posting the
// standard Supabase webhook payload:
//   { type: 'INSERT', table: 'check_ins' | 'messages' | 'nudges', record: {...} }
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

type WebhookPayload = {
  table: 'check_ins' | 'messages' | 'nudges';
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
    let title = 'Halkora';
    let body = '';
    // nudges target exactly one recipient; the other two notify every other
    // participant in the challenge.
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
      body = String(record.text ?? '').slice(0, 120);
    } else if (table === 'nudges') {
      challengeId = record.challenge_id as string;
      actorUserId = record.from_user as string;
      onlyRecipient = record.to_user as string;
      title = 'El salla 👋';
      body = 'Sana el salladı — sıra sende.';
    } else {
      return ok();
    }
    if (!challengeId || !actorUserId) return ok();

    const [{ data: challenge }, { data: actorProfile }] = await Promise.all([
      admin.from('challenges').select('title').eq('id', challengeId).single(),
      admin.from('profiles').select('name').eq('id', actorUserId).single(),
    ]);
    const actorName = (actorProfile?.name as string | undefined) ?? 'Biri';
    const challengeTitle = (challenge?.title as string | undefined) ?? 'Halkan';

    if (table === 'check_ins') {
      body = `${actorName} check-in yaptı ✓`;
      title = challengeTitle;
    } else if (table === 'messages') {
      title = `${actorName} · ${challengeTitle}`;
    }

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

    const { data: tokenRows } = await admin
      .from('push_tokens')
      .select('token')
      .in('user_id', recipientIds);
    const tokens = (tokenRows ?? []).map((r) => r.token as string).filter(Boolean);
    if (tokens.length === 0) return ok();

    const messages = tokens.map((to) => ({
      to,
      title,
      body,
      data: { challengeId },
    }));

    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      return ok({ sent: 0, expoStatus: res.status });
    }

    return ok({ sent: tokens.length });
  } catch (e) {
    // A webhook is fire-and-forget from Postgres's perspective — never let a
    // push failure surface as a DB-visible error. Log-and-200 instead.
    console.error('notify failed', e);
    return ok({ sent: 0, error: e instanceof Error ? e.message : String(e) });
  }
});
