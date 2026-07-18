// Supabase Edge Function — batched chat-message digest ("3 yeni mesaj"),
// replacing an instant push per message (too noisy for an active group chat).
//
// Meant to run on a fixed interval via pg_cron + pg_net (docs/PHASE2-SUPABASE.md
// "Ek P") — production: hourly. Testing: every 1 minute, so you don't wait an
// hour to see it work. Same cron job name either way (cron.schedule upserts by
// name), just re-run with a different schedule string to switch.
//
// Each run: for every user with a push token, count new messages (not their
// own) across every challenge they're in, written since their own
// `profiles.last_message_notified_at`. One push per person summarizing the
// total, not one per message — then that timestamp moves to "now" for
// everyone checked (even if they had zero new messages), so the window
// naturally slides forward and the query never has to look back further
// than one interval.
//
// Deployed with --no-verify-jwt (the caller is pg_cron/pg_net, not a
// signed-in user) — WEBHOOK_SECRET stands in for auth, same as
// evening-reminder.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET');

// Kept in sync by hand with src/i18n/tr.ts + en.ts — see notify/index.ts's
// comment for why this Edge Function can't just import those directly.
const COPY = {
  tr: {
    title: (n: number) => (n === 1 ? '1 yeni mesaj' : `${n} yeni mesaj`),
    bodyOne: (challengeTitle: string) => `"${challengeTitle}" halkasında`,
    bodyMany: (n: number) => `${n} halkanda`,
  },
  en: {
    title: (n: number) => (n === 1 ? '1 new message' : `${n} new messages`),
    bodyOne: (challengeTitle: string) => `In "${challengeTitle}"`,
    bodyMany: (n: number) => `Across ${n} rings`,
  },
} as const;

type Locale = keyof typeof COPY;

function copyFor(locale: string | null | undefined): (typeof COPY)['tr'] {
  return COPY[(locale as Locale) ?? 'tr'] ?? COPY.tr;
}

Deno.serve(async (req) => {
  if (!WEBHOOK_SECRET || req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const [{ data: profiles }, { data: participants }] = await Promise.all([
      admin.from('profiles').select('id, locale, last_message_notified_at'),
      admin.from('participants').select('challenge_id, user_id'),
    ]);
    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ notified: 0 }), { status: 200 });
    }

    // challenge_id -> Set(user_id) — who's in each challenge, to attribute
    // new messages to every OTHER participant.
    const membersByChallenge = new Map<string, Set<string>>();
    // user_id -> Set(challenge_id) — the reverse, to scope each recipient's count.
    const challengesByUser = new Map<string, Set<string>>();
    for (const p of participants ?? []) {
      const cid = p.challenge_id as string;
      const uid = p.user_id as string;
      if (!membersByChallenge.has(cid)) membersByChallenge.set(cid, new Set());
      membersByChallenge.get(cid)!.add(uid);
      if (!challengesByUser.has(uid)) challengesByUser.set(uid, new Set());
      challengesByUser.get(uid)!.add(cid);
    }

    // Bound the messages query to the OLDEST last_message_notified_at across
    // all users — anything before that can't be "new" for anyone.
    const earliestCutoff = (profiles as { last_message_notified_at: string }[])
      .map((p) => p.last_message_notified_at)
      .filter(Boolean)
      .sort()[0];
    if (!earliestCutoff) {
      return new Response(JSON.stringify({ notified: 0 }), { status: 200 });
    }

    const { data: newMessages } = await admin
      .from('messages')
      .select('challenge_id, user_id, created_at')
      .eq('kind', 'message')
      .gt('created_at', earliestCutoff);

    if (!newMessages || newMessages.length === 0) {
      // Nobody has anything new — still slide everyone's window forward so
      // the next run's cutoff stays tight instead of drifting backwards.
      await admin
        .from('profiles')
        .update({ last_message_notified_at: new Date().toISOString() })
        .in('id', profiles.map((p) => p.id as string));
      return new Response(JSON.stringify({ notified: 0 }), { status: 200 });
    }

    const { data: tokenRows } = await admin.from('push_tokens').select('user_id, token');
    const tokenByUser = new Map((tokenRows ?? []).map((r) => [r.user_id as string, r.token as string]));

    const now = new Date().toISOString();
    const messages: { to: string; title: string; body: string; data: Record<string, unknown> }[] = [];

    for (const profile of profiles) {
      const uid = profile.id as string;
      const token = tokenByUser.get(uid);
      if (!token) continue;
      const myChallenges = challengesByUser.get(uid);
      if (!myChallenges || myChallenges.size === 0) continue;
      const cutoff = (profile.last_message_notified_at as string) ?? earliestCutoff;

      // challenge_id -> count of new messages from OTHER people in a
      // challenge this user is actually a member of.
      const perChallenge = new Map<string, number>();
      let lastChallengeId: string | undefined;
      for (const m of newMessages) {
        const cid = m.challenge_id as string;
        if (!myChallenges.has(cid)) continue;
        if (m.user_id === uid) continue; // never notify someone about their own message
        if ((m.created_at as string) <= cutoff) continue; // this user's own window may be tighter than earliestCutoff
        perChallenge.set(cid, (perChallenge.get(cid) ?? 0) + 1);
        lastChallengeId = cid;
      }
      const total = Array.from(perChallenge.values()).reduce((a, b) => a + b, 0);
      if (total === 0) continue;

      const c = copyFor(profile.locale as string | null);
      let body: string;
      if (perChallenge.size === 1) {
        const [onlyChallengeId] = perChallenge.keys();
        const { data: challenge } = await admin
          .from('challenges')
          .select('title')
          .eq('id', onlyChallengeId)
          .single();
        body = c.bodyOne((challenge?.title as string | undefined) ?? '');
      } else {
        body = c.bodyMany(perChallenge.size);
      }

      messages.push({
        to: token,
        title: c.title(total),
        body,
        data: { challengeId: perChallenge.size === 1 ? lastChallengeId : undefined },
      });
    }

    // Expo's push endpoint accepts at most 100 messages per request — this
    // loop covers EVERY user with a token, so chunk instead of one POST that
    // would be rejected (or partially dropped) past 100 users.
    for (let i = 0; i < messages.length; i += 100) {
      await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(messages.slice(i, i + 100)),
      });
    }

    // Slide EVERY checked user's window forward to now, not just the ones
    // who got a push — otherwise a quiet user's cutoff never moves and the
    // messages query keeps growing.
    await admin
      .from('profiles')
      .update({ last_message_notified_at: now })
      .in('id', profiles.map((p) => p.id as string));

    return new Response(JSON.stringify({ notified: messages.length }), { status: 200 });
  } catch (e) {
    console.error('message-digest failed', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 200,
    });
  }
});
