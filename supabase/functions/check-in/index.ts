// Supabase Edge Function — real check-in write, with the day_number computed
// and validated SERVER-SIDE (never trusted from the client).
//
// Deploy: see docs/PHASE2-SUPABASE.md "Ek F".
//
// Body: { challenge_id: string, type?: 'done' | 'joker' }
// Returns: { day_number: number } on success, { error: string } on failure —
// `error` is a stable UPPER_SNAKE_CASE code (see src/i18n/*.ts `errors.codes`)
// that the client localizes, not prose — never change these strings without
// updating the client's code table too.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function fail(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    status,
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return fail('SESSION_MISSING', 401);

    const body = await req.json().catch(() => ({}));
    const challengeId: string | undefined = body?.challenge_id;
    const checkInType: 'done' | 'joker' = body?.type === 'joker' ? 'joker' : 'done';
    if (!challengeId) return fail('CHALLENGE_ID_REQUIRED');

    // Bound to the CALLER's own JWT — only used to resolve who is calling.
    const authed = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await authed.auth.getUser();
    if (userErr || !userData.user) return fail('INVALID_SESSION', 401);
    const userId = userData.user.id;

    // Service-role client for the trusted work below — every check here
    // stands in for what plain RLS can't express (server-computed day math,
    // joker allowance, "already missed" rule).
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: challenge, error: chErr } = await admin
      .from('challenges')
      .select('id, start_date, timezone, total_days, status, joker_allowance, created_at')
      .eq('id', challengeId)
      .single();
    if (chErr || !challenge) return fail('CHALLENGE_NOT_FOUND', 404);
    // Lobby (docs/db-lobby.sql): start_date is null until the owner starts
    // it. Without this guard, `new Date('nullT00:00:00Z')` below is an
    // Invalid Date and every arithmetic comparison on it is false — the
    // currentDay < 1 / > total_days checks would silently pass instead of
    // rejecting, and the insert further down would write a NaN day_number.
    if (!challenge.start_date) return fail('CHALLENGE_NOT_STARTED');

    const { data: participant, error: pErr } = await admin
      .from('participants')
      .select('id')
      .eq('challenge_id', challengeId)
      .eq('user_id', userId)
      .single();
    if (pErr || !participant) return fail('NOT_A_PARTICIPANT', 403);

    // "Today" in the CHALLENGE's own timezone — not the caller's device
    // clock — so every participant shares the same day boundary.
    //
    // FAST_DAYS (test-only): 1 day == 1 minute, anchored to created_at —
    // must mirror the client's src/lib/fastDays.ts exactly, and both sides
    // must be toggled together (supabase secrets set FAST_DAYS=1 + redeploy
    // here, EXPO_PUBLIC_FAST_DAYS=1 on the client). Never in production.
    let currentDay: number;
    if (Deno.env.get('FAST_DAYS') === '1') {
      currentDay =
        Math.floor((Date.now() - new Date(challenge.created_at as string).getTime()) / 60_000) + 1;
    } else {
      const todayStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: challenge.timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date()); // "YYYY-MM-DD"
      const startDate = new Date(`${challenge.start_date}T00:00:00Z`);
      const today = new Date(`${todayStr}T00:00:00Z`);
      currentDay = Math.round((today.getTime() - startDate.getTime()) / 86_400_000) + 1;
    }

    if (currentDay < 1) return fail('CHALLENGE_NOT_STARTED');
    if (currentDay > challenge.total_days) return fail('CHALLENGE_ENDED');

    let dayNumber = currentDay;

    if (checkInType === 'joker') {
      dayNumber = currentDay - 1;
      if (dayNumber < 1) return fail('NOTHING_TO_MAKE_UP');

      const { data: existingForDay } = await admin
        .from('check_ins')
        .select('id')
        .eq('participant_id', participant.id)
        .eq('day_number', dayNumber)
        .maybeSingle();
      if (existingForDay) return fail('DAY_ALREADY_MARKED');

      const { count: jokerUsed } = await admin
        .from('check_ins')
        .select('id', { count: 'exact', head: true })
        .eq('participant_id', participant.id)
        .eq('type', 'joker');
      if ((jokerUsed ?? 0) >= challenge.joker_allowance) {
        return fail('NO_JOKERS_LEFT');
      }
    }

    const { error: insErr } = await admin.from('check_ins').insert({
      participant_id: participant.id,
      challenge_id: challengeId,
      day_number: dayNumber,
      type: checkInType,
    });
    if (insErr) {
      if (insErr.code === '23505') return fail('ALREADY_CHECKED_IN');
      return fail(insErr.message);
    }

    return new Response(JSON.stringify({ day_number: dayNumber }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e), 500);
  }
});
