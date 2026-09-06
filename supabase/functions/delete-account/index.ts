// Supabase Edge Function — permanent account deletion (App Store Review
// Guideline 5.1.1(v): account creation requires an in-app deletion path).
//
// Deploy: see docs/PHASE2-SUPABASE.md "Ek L". Deployed WITH jwt verification
// (no --no-verify-jwt) — the caller must be the account being deleted.
//
// Design: deletes/removes the calling user's OWN rows everywhere (messages,
// reactions, nudges, stake votes, push token, participant rows — which
// cascades their check-ins) without touching anyone else's data.
//
// Challenges they OWN are handed to somebody. They used to have owner_id set
// to NULL, which kept the history but left the ring with no founder at all:
// nobody could edit it, invite to it, end it or close it, and the chat never
// said what had happened (saha testi bulgusu — "kurduğu halka duruyor ama
// sahipliği başkasına geçmiyor, mesajlarda ayrıldı diye gözükmeli").
//
// The new owner is chosen by pick_new_owner: the earliest-joined member who
// still has room under the free plan, so a handover can't quietly push
// someone past the limit they'd hit creating the same ring themselves. If
// nobody has room the ring is CLOSED rather than deleted — the remaining
// members keep their history — and only a ring with no participants left at
// all is removed.

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

    const body = await req.json().catch(() => ({}));
    const tr = body?.locale !== 'en';

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Read the name BEFORE anything is deleted — profiles cascades with the
    // user, and the handover note has to be able to say who left.
    const { data: me } = await admin
      .from('profiles')
      .select('name')
      .eq('id', userId)
      .maybeSingle();
    const myName = (me?.name as string) ?? (tr ? 'Bir üye' : 'A member');

    // Hand over every ring this user owns, before their own rows go. Each
    // note is written as the NEW owner: a message authored by the departing
    // user would cascade away with them a few lines further down.
    const { data: ownedNow } = await admin
      .from('challenges')
      .select('id')
      .eq('owner_id', userId);

    for (const ch of ownedNow ?? []) {
      const challengeId = ch.id as string;
      const { data: nextOwner } = await admin.rpc('pick_new_owner', {
        p_challenge_id: challengeId,
        p_leaving: userId,
      });

      const { data: lastMsg } = await admin
        .from('messages')
        .select('day_number')
        .eq('challenge_id', challengeId)
        .order('day_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      const day = (lastMsg?.day_number as number) ?? 0;

      if (nextOwner) {
        const { data: owner } = await admin
          .from('profiles')
          .select('name')
          .eq('id', nextOwner as string)
          .maybeSingle();
        const ownerName = (owner?.name as string) ?? (tr ? 'bir üye' : 'a member');
        await admin.from('challenges').update({ owner_id: nextOwner }).eq('id', challengeId);
        // Out of the ring BEFORE the note is written, not with the bulk delete
        // further down. `notify` pushes a system message to every participant
        // except its author, and its author here is the NEW owner — so while
        // this row still existed, the person who had just deleted their own
        // account got a push telling them who the ring's owner is now (saha
        // testi bulgusu — "ben zaten silmişim bana neden bildirim geliyor").
        // pick_new_owner above already ignores this user, so removing the row
        // here changes nothing else.
        await admin
          .from('participants')
          .delete()
          .eq('challenge_id', challengeId)
          .eq('user_id', userId);
        await admin.from('messages').insert({
          challenge_id: challengeId,
          user_id: nextOwner,
          day_number: day,
          kind: 'system',
          text: tr
            ? `${myName} ayrıldı. Halkanın yöneticisi artık ${ownerName}.`
            : `${myName} left. ${ownerName} is the ring's owner now.`,
          notify_others: true,
        });
      } else {
        // Nobody left, or nobody with room. Closing keeps everyone's history;
        // an empty ring is removed further down.
        await admin
          .from('challenges')
          .update({ owner_id: null, status: 'closed', closed_at: new Date().toISOString() })
          .eq('id', challengeId);
      }
    }

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

    // Anything handed over above that turned out to have nobody left in it is
    // removed outright — an empty ring is not history worth keeping.
    for (const ch of ownedNow ?? []) {
      const { count } = await admin
        .from('participants')
        .select('id', { count: 'exact', head: true })
        .eq('challenge_id', ch.id as string);
      if (!count) {
        await admin.from('challenges').delete().eq('id', ch.id as string);
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
