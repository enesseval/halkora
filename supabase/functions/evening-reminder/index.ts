// Supabase Edge Function — the "halkan bekliyor" reminder.
//
// Meant to run HOURLY via pg_cron + pg_net (see docs/PHASE2-SUPABASE.md
// "Ek I"). Each run pushes to people who still owe today's check-in and whose
// own reminder hour is the hour we are in right now.
//
// The hour used to belong to the RING: everyone in it was nudged at the same
// time, an hour before its deadline. That is the right time for someone who
// checks in at the last minute and the wrong time for everyone else — the
// person who always does it over breakfast got told at eight in the evening,
// hours after it stopped being useful, every single day.
//
// So the hour belongs to the PERSON now. Their last 14 days of check-ins in
// that ring say when they normally do it; the reminder lands an hour after
// that, once they are late by their own standard, and it is worded gently.
// Someone with no habit yet — or whose habit is already past the ring's own
// cut-off — keeps the old deadline-minus-one-hour slot, worded as the last
// call it actually is.
//
// Still one push per person per day (profiles.last_reminder_date), however
// many rings are waiting: the body says how many.
//
// Deployed with --no-verify-jwt (the caller is pg_cron/pg_net, not a
// signed-in user) — WEBHOOK_SECRET stands in for auth. Without it, anyone
// who finds this function's URL could trigger it on demand and spam every
// pending participant.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET');

/** How far back to look for someone's usual check-in time. */
const HABIT_DAYS = 14;
/**
 * How many check-ins it takes before we claim to know someone's habit. Two
 * mornings in a row is a coincidence; the reminder should not move itself
 * across the day on that basis.
 */
const HABIT_MIN_SAMPLES = 3;
/** How long after their usual hour someone counts as late. */
const HABIT_GRACE_HOURS = 1;

// Kept in sync by hand with src/i18n/tr.ts + en.ts — see notify/index.ts's
// comment for why this Edge Function can't just import those directly.
const COPY = {
  tr: {
    title: 'Halkan bekliyor',
    single: 'Bugün için check-in yapmadın — halka seni bekliyor.',
    multi: (n: number) => `${n} halka bugün seni bekliyor.`,
    // Erken, alışkanlık saatine göre: acele ettirmeden hatırlatır.
    habitTitle: 'Bugünü işaretlemedin',
    habitSingle: 'Genelde bu saatlerde yapıyorsun — halkan hazır.',
    habitMulti: (n: number) => `${n} halkada bugünü henüz işaretlemedin.`,
  },
  en: {
    title: 'Your ring is waiting',
    single: "You haven't checked in today — your ring is waiting on you.",
    multi: (n: number) => `${n} rings are waiting on you today.`,
    habitTitle: "Today isn't marked yet",
    habitSingle: 'This is usually when you do it — your ring is ready.',
    habitMulti: (n: number) => `${n} rings are still unmarked today.`,
  },
} as const;

type Locale = keyof typeof COPY;

function copyFor(locale: string | null | undefined): (typeof COPY)['tr'] {
  return COPY[(locale as Locale) ?? 'tr'] ?? COPY.tr;
}

/**
 * The ring's own last-call hour — the hour before its deadline. Midnight is
 * the exception and keeps 20:00: it is the default every ring has, and moving
 * it to 23:00 would silently start pushing people at night.
 */
function deadlineHour(deadline: string | null): number {
  const hhmm = (deadline ?? '00:00').slice(0, 5);
  if (hhmm === '00:00') return 20;
  const hour = Number(hhmm.slice(0, 2));
  return (hour + 23) % 24;
}

/** The opening date of the cycle we're in, as "YYYY-MM-DD". Mirrors
 * public.challenge_cycle_start() and src/lib/cycle.ts — one formula, four
 * copies, change them together. */
function cycleStartFor(timeZone: string, deadline: string): string {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
  if (time >= deadline) return date;
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * The hour of the clock in `timeZone`, 0-23.
 *
 * The `% 24` is not cosmetic: `hour12: false` reports midnight as "24" in
 * several ICU versions, and a ring whose deadline made its last-call hour 0
 * could therefore never match the current hour — its reminder simply never
 * fired.
 */
function hourIn(timeZone: string, when: Date = new Date()): number {
  return (
    Number(
      new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hour12: false }).format(when),
    ) % 24
  );
}

/** The middle value — not the mean, which one 3am check-in drags across the
 * whole day. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
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

    // NOT .eq('status','active'): a "starts tomorrow" challenge is created as
    // 'upcoming' and nothing ever flips the DB column to 'active' (the client
    // derives live status from dates) — filtering on 'active' would silently
    // exclude those groups forever. The day-window check below already skips
    // challenges that haven't started or have run past total_days; only an
    // explicit early-end ('completed', set by end_challenge_early) must be
    // excluded here.
    const { data: challenges } = await admin
      .from('challenges')
      .select('id, start_date, timezone, total_days, deadline_time')
      .neq('status', 'completed');

    // Every ring is considered on every run now, not only the ones at their
    // own last-call hour: the hour that matters is the person's, and two
    // people in the same ring can have different ones.
    const live = (challenges ?? []).filter((c) => {
      // Lobby (docs/db-lobby.sql): start_date is null until the owner starts
      // it. Without this the Invalid Date below makes currentDay NaN, and NaN
      // comparisons are always false — the "hasn't started yet" skip would
      // never fire and the group would be reminded about a ring nobody has
      // started.
      if (!c.start_date) return false;
      const timeZone = c.timezone as string;
      const deadline = ((c.deadline_time as string | null) ?? '00:00').slice(0, 5);
      const startDate = new Date(`${c.start_date as string}T00:00:00Z`);
      const cycle = new Date(`${cycleStartFor(timeZone, deadline)}T00:00:00Z`);
      const day = Math.round((cycle.getTime() - startDate.getTime()) / 86_400_000) + 1;
      if (day < 1 || day > (c.total_days as number)) return false;
      (c as Record<string, unknown>).currentDay = day;
      return true;
    });
    if (live.length === 0) {
      return new Response(JSON.stringify({ reminded: 0 }), { status: 200 });
    }

    /** Everyone who still owes today's check-in, per ring. */
    const pending: {
      userId: string;
      participantId: string;
      challengeId: string;
      timeZone: string;
      lastCallHour: number;
    }[] = [];

    for (const challenge of live) {
      const currentDay = (challenge as Record<string, unknown>).currentDay as number;
      const timeZone = challenge.timezone as string;
      const lastCallHour = deadlineHour(challenge.deadline_time as string | null);

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
        pending.push({
          userId: p.user_id as string,
          participantId: p.id as string,
          challengeId: challenge.id as string,
          timeZone,
          lastCallHour,
        });
      }
    }

    if (pending.length === 0) {
      return new Response(JSON.stringify({ reminded: 0 }), { status: 200 });
    }

    // What time do these people normally check in? One query for all of them,
    // read per participant — check_ins hangs off participant_id, so this is
    // already scoped to "this person, in this ring".
    const since = new Date(Date.now() - HABIT_DAYS * 86_400_000).toISOString();
    const { data: history } = await admin
      .from('check_ins')
      .select('participant_id, created_at')
      .in('participant_id', pending.map((p) => p.participantId))
      .gte('created_at', since);

    // Read in the RING's timezone, not the server's: "when do you usually do
    // this" is a question about the person's own day.
    const tzByParticipant = new Map(pending.map((p) => [p.participantId, p.timeZone]));
    const hoursByParticipant = new Map<string, number[]>();
    for (const row of history ?? []) {
      const pid = row.participant_id as string;
      const tz = tzByParticipant.get(pid);
      if (!tz) continue;
      const list = hoursByParticipant.get(pid) ?? [];
      list.push(hourIn(tz, new Date(row.created_at as string)));
      hoursByParticipant.set(pid, list);
    }

    // Whose hour is now? A ring counts if THIS person's reminder hour for it
    // is the hour its timezone is currently in.
    const dueNow = new Map<string, { count: number; challengeId: string; habit: boolean }>();
    for (const p of pending) {
      const hours = hoursByParticipant.get(p.participantId) ?? [];
      // Their usual hour, plus grace — but never past the ring's own last
      // call, which is the latest a reminder can still be acted on.
      const habitHour =
        hours.length >= HABIT_MIN_SAMPLES ? median(hours) + HABIT_GRACE_HOURS : null;
      const useHabit = habitHour !== null && habitHour < p.lastCallHour;
      const myHour = useHabit ? (habitHour as number) : p.lastCallHour;
      if (hourIn(p.timeZone) !== myHour) continue;

      const seen = dueNow.get(p.userId);
      if (seen) {
        seen.count += 1;
        // Urgency is the louder of the two: one ring at its last call makes
        // the whole push the last-call one.
        seen.habit = seen.habit && useHabit;
      } else {
        dueNow.set(p.userId, { count: 1, challengeId: p.challengeId, habit: useHabit });
      }
    }

    if (dueNow.size === 0) {
      return new Response(JSON.stringify({ reminded: 0 }), { status: 200 });
    }

    const userIds = Array.from(dueNow.keys());
    const [{ data: profiles }, { data: tokenRows }] = await Promise.all([
      admin.from('profiles').select('id, last_reminder_date, locale').in('id', userIds),
      admin.from('push_tokens').select('user_id, token').in('user_id', userIds),
    ]);
    const tokenByUser = new Map((tokenRows ?? []).map((r) => [r.user_id as string, r.token as string]));

    // A user can be in challenges across different timezones; dedupe against
    // *this device's* UTC date so a person is never reminded twice in one
    // real calendar day even if two of their challenges come due in different
    // timezones within the same run window.
    const nowUtcDate = new Date().toISOString().slice(0, 10);

    const messages: { to: string; title: string; body: string; data: Record<string, unknown> }[] = [];
    const remindedIds: string[] = [];

    for (const profile of profiles ?? []) {
      if (profile.last_reminder_date === nowUtcDate) continue;
      const token = tokenByUser.get(profile.id as string);
      if (!token) continue;
      const due = dueNow.get(profile.id as string);
      if (!due) continue;
      const c = copyFor(profile.locale as string | null);
      messages.push({
        to: token,
        title: due.habit ? c.habitTitle : c.title,
        body: due.habit
          ? due.count === 1
            ? c.habitSingle
            : c.habitMulti(due.count)
          : due.count === 1
            ? c.single
            : c.multi(due.count),
        data: { challengeId: due.challengeId },
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
