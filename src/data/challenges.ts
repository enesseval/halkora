import { supabase } from '@/lib/supabase';
import type { CreateChallengeInput } from '@/stores/mockStore';
import type { Challenge, Participant, SegmentState } from './types';
import { buildDays, formatShortDate } from '@/lib/day';
import { FAST_DAYS, fastDaysSince } from '@/lib/fastDays';
import { getDict } from '@/i18n';

export interface InsertedChallenge {
  id: string;
  invite_code: string;
}

/**
 * First real Supabase write: create a challenge owned by `userId`, add the
 * owner as a participant, and (optionally) its stake. Requires the tables +
 * RLS from docs/PHASE2-SUPABASE.md "Ek A".
 */
export async function insertChallenge(
  input: CreateChallengeInput,
  userId: string,
): Promise<InsertedChallenge> {
  // The creator's own device timezone becomes this challenge's single source
  // of truth for "what day is it" — written once here, then read back by the
  // client (mapRow), the `check-in` Edge Function, and the join-window RPCs
  // (docs/PHASE2-SUPABASE.md "Ek F"/"Ek M") so every participant, regardless
  // of their own device's timezone, agrees on the same day boundary.
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { data, error } = await supabase
    .from('challenges')
    .insert({
      owner_id: userId,
      title: input.title,
      daily_action: input.dailyAction,
      total_days: input.totalDays,
      start_date: input.startDateISO ?? todayInTimezone(timezone),
      timezone,
      status: input.startTomorrow ? 'upcoming' : 'active',
      joker_allowance: input.joker ?? 1,
      first_day_join_only: input.firstDayJoinOnly ?? false,
    })
    .select('id, invite_code')
    .single();
  if (error) throw error;

  const challenge = data as InsertedChallenge;

  const { error: pErr } = await supabase
    .from('participants')
    .insert({ challenge_id: challenge.id, user_id: userId });
  if (pErr) throw pErr;

  if (input.stake?.text) {
    const { error: sErr } = await supabase.from('stakes').insert({
      challenge_id: challenge.id,
      mode: input.stake.mode,
      text: input.stake.text,
    });
    if (sErr) throw sErr;
  }

  return challenge;
}

/* ------------------------------------------------------------------ */
/* READ side — hydrate the Home list from Supabase (Phase 2, step 5).  */
/* ------------------------------------------------------------------ */

interface ChallengeRow {
  id: string;
  title: string;
  daily_action: string;
  total_days: number;
  start_date: string;
  timezone: string;
  status: string;
  invite_code: string;
  joker_allowance: number;
  first_day_join_only: boolean;
  created_at: string;
}

interface ParticipantRow {
  id: string; // participants.id — what check_ins.participant_id references
  challenge_id: string;
  user_id: string;
}

interface CheckInRow {
  participant_id: string;
  challenge_id: string;
  day_number: number;
  type: 'done' | 'joker';
  created_at: string;
}

interface StakeRow {
  challenge_id: string;
  mode: 'direct' | 'vote';
  text: string | null;
}

interface NudgeRow {
  to_user: string;
  created_at: string;
}

/** "2026-07-11T14:23:00+00:00" -> "2026-07-11" — matches the DB's UTC-day
 * uniqueness window (docs/PHASE2-SUPABASE.md "Ek K") exactly. */
function utcDateOf(iso: string): string {
  return iso.slice(0, 10);
}

/** Today's date ("YYYY-MM-DD") as seen in `timezone` — used once at challenge
 * creation so `start_date` agrees with the `timezone` column being written
 * alongside it, instead of falling back to a UTC slice that can be off by a
 * day from the creator's actual local date. */
function todayInTimezone(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Whole days from `startISO` to today, both read in the CHALLENGE's own
 * timezone — not the viewing device's clock. Must match the `check-in` Edge
 * Function's day math (docs/PHASE2-SUPABASE.md "Ek F") exactly, or a
 * participant in a different timezone than the challenge can see "bugün
 * işaretlenebilir" on screen and get rejected server-side. 0 === starts today. */
function daysSinceStart(startISO: string, timezone: string, createdAtISO: string): number {
  // Test-only acceleration: 1 day == 1 minute, anchored to created_at
  // because start_date has no time-of-day (see src/lib/fastDays.ts).
  if (FAST_DAYS) return fastDaysSince(createdAtISO);
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date()); // "YYYY-MM-DD"
  const start = new Date(`${startISO}T00:00:00Z`);
  const today = new Date(`${todayStr}T00:00:00Z`);
  return Math.round((today.getTime() - start.getTime()) / 86_400_000);
}

function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function mapRow(
  row: ChallengeRow,
  parts: ParticipantRow[],
  profMap: Map<string, { name?: string; initials?: string }>,
  checkIns: CheckInRow[],
  myUserId: string,
  nudgedToday: Set<string>,
  stake?: StakeRow,
): Challenge {
  const diff = daysSinceStart(row.start_date, row.timezone, row.created_at);
  const rawDay = diff + 1; // day 1 == start day
  const dateBasedStatus: Challenge['status'] =
    rawDay <= 0 ? 'upcoming' : rawDay > row.total_days ? 'completed' : 'active';
  // A manual "Erken bitir" (endEarly) sets challenges.status='completed' in
  // the DB *before* the days have naturally run out — that's the entire
  // point of ending early. Date math alone would never see it as completed,
  // so the DB's own status is authoritative whenever it says 'completed'.
  const status: Challenge['status'] =
    row.status === 'completed' ? 'completed' : dateBasedStatus;
  const currentDay = status === 'upcoming' ? 0 : Math.min(rawDay, row.total_days);

  const t = getDict();
  // "Yarın başlıyor" only when it's actually tomorrow — a challenge starting
  // in 20 days showed that same label before this fix, which is just wrong.
  const daysUntilStart = -diff;
  const startsWhen =
    status === 'upcoming'
      ? daysUntilStart === 1
        ? t.common.startsTomorrow
        : t.common.startsOn(formatShortDate(new Date(`${row.start_date}T00:00:00`)))
      : t.common.ongoing;

  const myParticipant = parts.find((p) => p.user_id === myUserId);
  const myCheckIns = myParticipant
    ? checkIns.filter((c) => c.participant_id === myParticipant.id)
    : [];
  const myByDay = new Map(myCheckIns.map((c) => [c.day_number, c]));

  // days[] reflects MY personal progress on this challenge's ring.
  const explicit: SegmentState[] = [];
  if (status !== 'upcoming') {
    for (let i = 1; i < currentDay; i++) {
      const c = myByDay.get(i);
      explicit.push(c ? (c.type === 'joker' ? 'joker' : 'done') : 'missed');
    }
    const todayCheckIn = myByDay.get(currentDay);
    explicit.push(todayCheckIn ? (todayCheckIn.type === 'joker' ? 'joker' : 'done') : 'today');
  }

  const meCheckedInToday = myByDay.has(currentDay);
  const myTodayCheckIn = myByDay.get(currentDay);
  const hasMissedYesterday =
    status === 'active' && currentDay > 1 && !myByDay.has(currentDay - 1);
  const jokerUsed = myCheckIns.filter((c) => c.type === 'joker').length;

  // "Sen N. tamamlayansın" — rank among everyone's check-ins for today, by time.
  const todaysCheckIns = checkIns
    .filter((c) => c.day_number === currentDay)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const myOrder = myParticipant
    ? todaysCheckIns.findIndex((c) => c.participant_id === myParticipant.id) + 1
    : 0;

  const participants: Participant[] = parts.map((p) => {
    const prof = profMap.get(p.user_id);
    const name = prof?.name ?? t.common.person;
    const todayCi = checkIns.find((c) => c.participant_id === p.id && c.day_number === currentDay);
    // Every day this participant covered (done or joker) — the E9 leaderboard.
    const completedDays = checkIns.filter((c) => c.participant_id === p.id).length;
    return {
      id: p.user_id,
      name,
      initials: prof?.initials ?? name.slice(0, 2).toUpperCase(),
      isMe: p.user_id === myUserId,
      checkedInToday: !!todayCi,
      checkinTime: todayCi ? hhmm(todayCi.created_at) : undefined,
      completedDays,
      // Reflects the DB's real "one nudge per person per day" state (Ek K) —
      // not just an ephemeral optimistic flag — so it survives a refetch and
      // the UI can tell a genuine re-attempt apart from a fresh nudge.
      nudged: nudgedToday.has(p.user_id),
    };
  });

  // E9 finish stats — only meaningful once the challenge is actually over.
  const finishStats =
    status === 'completed' && parts.length > 0
      ? {
          people: parts.length,
          checkins: checkIns.length,
          completionPct: Math.round((checkIns.length / (parts.length * row.total_days)) * 100),
        }
      : undefined;

  return {
    id: row.id,
    title: row.title,
    dailyAction: `${t.common.today}: ${row.daily_action}`,
    totalDays: row.total_days,
    currentDay,
    days: buildDays(row.total_days, explicit),
    status,
    startsLabel: status === 'upcoming' ? startsWhen : undefined,
    meCheckedInToday,
    myCheckinTime: myTodayCheckIn ? hhmm(myTodayCheckIn.created_at) : undefined,
    myOrder: meCheckedInToday ? myOrder || undefined : undefined,
    jokerRemaining: Math.max(row.joker_allowance - jokerUsed, 0),
    hasMissedYesterday,
    inviteCode: row.invite_code,
    scheduleSummary: t.common.scheduleSummary(row.daily_action, row.total_days),
    startsWhen,
    firstDayJoinOnly: row.first_day_join_only,
    // Client-side mirror of the join_challenge_by_code RPC's check (Ek M) —
    // display only, the RPC is what actually enforces it server-side.
    joinClosed: row.first_day_join_only && currentDay > 1,
    stake: stake ? { mode: stake.mode, text: stake.text ?? '' } : undefined,
    participants,
    messages: [],
    finishStats,
    // No automatic "kim kaybetti" computation from real data (that's a group
    // decision, not something we can infer) — the stake's own text is shown
    // instead by the Detail/complete screens when this is absent.
    stakeResult: undefined,
  };
}

/** Challenges the current user participates in, mapped to the UI shape. */
export async function fetchMyChallenges(): Promise<Challenge[]> {
  // getSession() reads the already-verified session from local storage —
  // getUser() makes a real network round-trip every call, and this runs on
  // every 5s poll (Home + Detail). Any transient hiccup there used to make
  // "no user yet" look identical to "no challenges", wiping the list for a
  // cycle (flash of "Challenge bulunamadı" / stale-then-empty Home).
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return [];

  const { data: mine, error: e1 } = await supabase
    .from('participants')
    .select('challenge_id')
    .eq('user_id', user.id);
  if (e1) throw e1;
  const ids = (mine ?? []).map((r) => r.challenge_id as string);
  if (ids.length === 0) return [];

  const [
    { data: rows, error: e2 },
    { data: allParts, error: e3 },
    { data: checkIns, error: e4 },
    { data: stakes, error: e5 },
    { data: myNudges, error: e6 },
  ] = await Promise.all([
    supabase
      .from('challenges')
      .select(
        'id, title, daily_action, total_days, start_date, timezone, status, invite_code, joker_allowance, first_day_join_only, created_at',
      )
      .in('id', ids),
    supabase.from('participants').select('id, challenge_id, user_id').in('challenge_id', ids),
    supabase
      .from('check_ins')
      .select('participant_id, challenge_id, day_number, type, created_at')
      .in('challenge_id', ids),
    supabase.from('stakes').select('challenge_id, mode, text').in('challenge_id', ids),
    // "Have I already nudged this person today?" — the DB only allows one
    // nudge per (from_user, to_user) per UTC day regardless of challenge
    // (Ek K), so this is intentionally not scoped to `ids`.
    supabase.from('nudges').select('to_user, created_at').eq('from_user', user.id),
  ]);
  if (e2) throw e2;
  if (e3) throw e3;
  if (e4) throw e4;
  if (e5) throw e5;
  if (e6) throw e6;

  const todayUTC = new Date().toISOString().slice(0, 10);
  const nudgedToday = new Set(
    ((myNudges ?? []) as NudgeRow[])
      .filter((n) => utcDateOf(n.created_at) === todayUTC)
      .map((n) => n.to_user),
  );

  const parts = (allParts ?? []) as ParticipantRow[];
  const userIds = Array.from(new Set(parts.map((p) => p.user_id)));
  const { data: profs } = await supabase
    .from('profiles')
    .select('id, name, initials')
    .in('id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000']);
  const profMap = new Map(
    (profs ?? []).map((p) => [p.id as string, { name: p.name as string, initials: p.initials as string }]),
  );

  const partsByChallenge = new Map<string, ParticipantRow[]>();
  for (const p of parts) {
    const list = partsByChallenge.get(p.challenge_id) ?? [];
    list.push(p);
    partsByChallenge.set(p.challenge_id, list);
  }
  const checkInsByChallenge = new Map<string, CheckInRow[]>();
  for (const c of (checkIns ?? []) as CheckInRow[]) {
    const list = checkInsByChallenge.get(c.challenge_id) ?? [];
    list.push(c);
    checkInsByChallenge.set(c.challenge_id, list);
  }
  const stakeByChallenge = new Map<string, StakeRow>();
  for (const s of (stakes ?? []) as StakeRow[]) {
    stakeByChallenge.set(s.challenge_id, s);
  }

  return (rows ?? []).map((r) => {
    const row = r as ChallengeRow;
    return mapRow(
      row,
      partsByChallenge.get(row.id) ?? [],
      profMap,
      checkInsByChallenge.get(row.id) ?? [],
      user.id,
      nudgedToday,
      stakeByChallenge.get(row.id),
    );
  });
}

/** E10 "Yeniden başlat" — resets start_date to today and status to active. */
export async function restartChallenge(challengeId: string): Promise<void> {
  const { error } = await supabase.rpc('restart_challenge', { p_challenge_id: challengeId });
  if (error) throw error;
}

/** E10 "Erken bitir" — marks the challenge completed. */
export async function endChallengeEarly(challengeId: string): Promise<void> {
  const { error } = await supabase.rpc('end_challenge_early', { p_challenge_id: challengeId });
  if (error) throw error;
}
