// Supabase Edge Function — permanent account deletion (App Store Review
// Guideline 5.1.1(v): account creation requires an in-app deletion path).
//
// Deploy: see docs/PHASE2-SUPABASE.md "Ek L". Deployed WITH jwt verification
// (no --no-verify-jwt) — the caller must be the account being deleted.
//
// Design: deletes/removes the calling user's OWN rows everywhere (messages,
// reactions, nudges, stake votes, push token, participant rows — which
// cascades their check-ins) without touching anyone else's data. Challenges
// they OWN are not destroyed just because the owner left — owner_id is
// nulled so the group keeps its history — UNLESS that challenge no longer
// has any participants at all, in which case it's cleaned up too.

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

    // Bound to the CALLER's own JWT — only used to resolve who is calling,
    // exactly like check-in/index.ts.
    const authed = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await authed.auth.getUser();
    if (userErr || !userData.user) return fail('INVALID_SESSION', 401);
    const userId = userData.user.id;

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Order matters: remove every row that references auth.users directly
    // BEFORE calling admin.deleteUser() below, so nothing is left blocking
    // (or silently orphaned by) that delete. check_ins cascades automatically
    // from the participants delete; message_reactions/stakes/etc. cascade
    // automatically if/when a now-empty owned challenge is removed further
    // down.
    await admin.from('message_reactions').delete().eq('user_id', userId);
    await admin.from('messages').delete().eq('user_id', userId);
    await admin.from('nudges').delete().or(`from_user.eq.${userId},to_user.eq.${userId}`);
    // invites.from_user/to_user reference auth.users WITHOUT cascade — leaving
    // any invite row behind makes deleteUser() below fail with an FK violation,
    // i.e. anyone who ever sent/received an invite couldn't delete their account.
    await admin.from('invites').delete().or(`from_user.eq.${userId},to_user.eq.${userId}`);
    await admin.from('stake_votes').delete().eq('user_id', userId);
    await admin.from('push_tokens').delete().eq('user_id', userId);
    await admin.from('participants').delete().eq('user_id', userId);

    // Challenges this user created: keep them for the rest of the group
    // (owner_id -> null) unless nobody's left in them at all.
    const { data: owned } = await admin.from('challenges').select('id').eq('owner_id', userId);
    if (owned && owned.length > 0) {
      await admin.from('challenges').update({ owner_id: null }).eq('owner_id', userId);
      for (const challenge of owned) {
        const { count } = await admin
          .from('participants')
          .select('id', { count: 'exact', head: true })
          .eq('challenge_id', challenge.id as string);
        if (!count) {
          await admin.from('challenges').delete().eq('id', challenge.id as string);
        }
      }
    }

    // profiles cascades automatically (references auth.users on delete cascade).
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) return fail(delErr.message, 500);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e), 500);
  }
});
