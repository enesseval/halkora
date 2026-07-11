// Supabase Edge Function — "Halkan bekliyor" evening reminder.
//
// Meant to run HOURLY via pg_cron + pg_net (see docs/PHASE2-SUPABASE.md
// "Ek I"). Each run: for every active challenge currently between 20:00 and
// 20:59 in ITS OWN timezone, nudge every participant who hasn't checked in
// today and hasn't already been reminded today (profiles.last_reminder_date).
//
// One push per person per day even if they're behind on several challenges —
// the body lists how many are still waiting rather than spamming one per
// challenge.
//
// Deployed with --no-verify-jwt (the caller is pg_cron/pg_net, not a
// signed-in user) — WEBHOOK_SECRET stands in for auth. Without it, anyone
// who finds this function's URL could trigger it on demand and spam every
// pending participant.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET');

function localHour(timeZone: string): number {
  return Number(
    new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hour12: false }).format(new Date()),
  );
}

function localDateStr(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

Deno.serve(async (req) => {
  // Fail closed: no secret configured means no calls are trusted.
  if (!WEBHOOK_SECRET || req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: challenges } = await admin
      .from('challenges')
      .select('id, start_date, timezone, total_days')
      .eq('status', 'active');

    const eveningChallenges = (challenges ?? []).filter((c) => localHour(c.timezone as string) === 20);
    if (eveningChallenges.length === 0) {
      return new Response(JSON.stringify({ reminded: 0 }), { status: 200 });
    }

    // participantId -> { userId, pendingChallengeIds[] }
    const pendingByUser = new Map<string, Set<string>>();

    for (const challenge of eveningChallenges) {
      const timeZone = challenge.timezone as string;
      const todayStr = localDateStr(timeZone);
      const startDate = new Date(`${challenge.start_date as string}T00:00:00Z`);
      const today = new Date(`${todayStr}T00:00:00Z`);
      const currentDay = Math.round((today.getTime() - startDate.getTime()) / 86_400_000) + 1;
      if (currentDay < 1 || currentDay > (challenge.total_days as number)) continue;

      const { data: participants } = await admin
        .from('participants')
        .select('id, user_id')
        .eq('challenge_id', challenge.id as string);
      if (!participants || participants.length === 0) continue;

      const { data: doneToday } = await admin
        .from('check_ins')
        .select('participant_id')
        .eq('challenge_id', challenge.id as string)
        .eq('day_number', currentDay);
      const doneIds = new Set((doneToday ?? []).map((c) => c.participant_id as string));

      for (const p of participants) {
        if (doneIds.has(p.id as string)) continue;
        const set = pendingByUser.get(p.user_id as string) ?? new Set<string>();
        set.add(challenge.id as string);
        pendingByUser.set(p.user_id as string, set);
      }
    }

    if (pendingByUser.size === 0) {
      return new Response(JSON.stringify({ reminded: 0 }), { status: 200 });
    }

    const userIds = Array.from(pendingByUser.keys());
    const [{ data: profiles }, { data: tokenRows }] = await Promise.all([
      admin.from('profiles').select('id, last_reminder_date').in('id', userIds),
      admin.from('push_tokens').select('user_id, token').in('user_id', userIds),
    ]);
    const tokenByUser = new Map((tokenRows ?? []).map((r) => [r.user_id as string, r.token as string]));

    // A user can be in challenges across different timezones; dedupe against
    // *this device's* UTC date so a person is never reminded twice in one
    // real calendar day even if two of their challenges hit 20:00 in
    // different timezones within the same run window.
    const nowUtcDate = new Date().toISOString().slice(0, 10);

    const messages: { to: string; title: string; body: string; data: Record<string, unknown> }[] = [];
    const remindedIds: string[] = [];

    for (const profile of profiles ?? []) {
      if (profile.last_reminder_date === nowUtcDate) continue;
      const token = tokenByUser.get(profile.id as string);
      if (!token) continue;
      const pending = pendingByUser.get(profile.id as string);
      if (!pending || pending.size === 0) continue;
      const [firstChallengeId] = pending;
      messages.push({
        to: token,
        title: 'Halkan bekliyor',
        body:
          pending.size === 1
            ? 'Bugün için check-in yapmadın — halka seni bekliyor.'
            : `${pending.size} halka bugün seni bekliyor.`,
        data: { challengeId: firstChallengeId },
      });
      remindedIds.push(profile.id as string);
    }

    if (messages.length === 0) {
      return new Response(JSON.stringify({ reminded: 0 }), { status: 200 });
    }

    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });

    await admin.from('profiles').update({ last_reminder_date: nowUtcDate }).in('id', remindedIds);

    return new Response(JSON.stringify({ reminded: remindedIds.length }), { status: 200 });
  } catch (e) {
    console.error('evening-reminder failed', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 200,
    });
  }
});
