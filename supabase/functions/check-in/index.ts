// Supabase Edge Function — real check-in write, with the day_number computed
// and validated SERVER-SIDE (never trusted from the client).
//
// Deploy: see docs/PHASE2-SUPABASE.md "Ek F".
//
// Body: { challenge_id: string, type?: 'done' | 'joker' }
// Returns: { day_number: number } on success, { error: string } on failure.

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
    if (!authHeader) return fail('Oturum bulunamadı.', 401);

    const body = await req.json().catch(() => ({}));
    const challengeId: string | undefined = body?.challenge_id;
    const checkInType: 'done' | 'joker' = body?.type === 'joker' ? 'joker' : 'done';
    if (!challengeId) return fail('challenge_id gerekli.');

    // Bound to the CALLER's own JWT — only used to resolve who is calling.
    const authed = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await authed.auth.getUser();
    if (userErr || !userData.user) return fail('Geçersiz oturum.', 401);
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
      .select('id, start_date, timezone, total_days, status, joker_allowance')
      .eq('id', challengeId)
      .single();
    if (chErr || !challenge) return fail('Challenge bulunamadı.', 404);

    const { data: participant, error: pErr } = await admin
      .from('participants')
      .select('id')
      .eq('challenge_id', challengeId)
      .eq('user_id', userId)
      .single();
    if (pErr || !participant) return fail('Bu challenge\'a katılımcı değilsin.', 403);

    // "Today" in the CHALLENGE's own timezone — not the caller's device
    // clock — so every participant shares the same day boundary.
    const todayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: challenge.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date()); // "YYYY-MM-DD"
    const startDate = new Date(`${challenge.start_date}T00:00:00Z`);
    const today = new Date(`${todayStr}T00:00:00Z`);
    const daysSinceStart = Math.round((today.getTime() - startDate.getTime()) / 86_400_000);
    const currentDay = daysSinceStart + 1;

    if (currentDay < 1) return fail('Bu challenge henüz başlamadı.');
    if (currentDay > challenge.total_days) return fail('Bu challenge sona erdi.');

    let dayNumber = currentDay;

    if (checkInType === 'joker') {
      dayNumber = currentDay - 1;
      if (dayNumber < 1) return fail('Telafi edilecek bir gün yok.');

      const { data: existingForDay } = await admin
        .from('check_ins')
        .select('id')
        .eq('participant_id', participant.id)
        .eq('day_number', dayNumber)
        .maybeSingle();
      if (existingForDay) return fail('O gün zaten işaretli.');

      const { count: jokerUsed } = await admin
        .from('check_ins')
        .select('id', { count: 'exact', head: true })
        .eq('participant_id', participant.id)
        .eq('type', 'joker');
      if ((jokerUsed ?? 0) >= challenge.joker_allowance) {
        return fail('Joker hakkın kalmadı.');
      }
    }

    const { error: insErr } = await admin.from('check_ins').insert({
      participant_id: participant.id,
      challenge_id: challengeId,
      day_number: dayNumber,
      type: checkInType,
    });
    if (insErr) {
      if (insErr.code === '23505') return fail('Bugün için zaten check-in var.');
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
