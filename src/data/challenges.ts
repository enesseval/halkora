import { supabase } from '@/lib/supabase';
import type { CreateChallengeInput } from '@/stores/mockStore';
import type { Challenge, Participant, SegmentState } from './types';
import { buildDays, formatShortDate } from '@/lib/day';
import { FAST_DAYS, fastDaysSince } from '@/lib/fastDays';
import { computeStakeOutcome } from './stakeOutcome';
import { getDict, getLocale } from '@/i18n';

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
  // Lobby (docs/db-lobby.sql): owner picks a start later from inside the
  // challenge (startChallenge below) — no start_date yet, so the day math
  // in mapRow/check-in never runs until then.
  const { data, error } = await supabase
    .from('challenges')
    .insert({
      owner_id: userId,
      title: input.title,
      daily_action: input.dailyAction,
      total_days: input.totalDays,
      start_date: input.lobby ? null : (input.startDateISO ?? todayInTimezone(timezone)),
      timezone,
      // Only two stored values carry meaning: 'lobby' (no start date yet) and
      // 'completed' (authoritative, set by ending). Whether a dated ring is
      // upcoming or running is read off start_date every time it's mapped, so
      // storing 'upcoming' here just created a value nothing maintains —
      // 42 rows in production still said 'upcoming' with a start date weeks
      // past. Write the neutral value and let the dates answer.
      status: input.lobby ? 'lobby' : 'active',
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
      kind: input.stake.kind ?? 'individual',
      threshold_missed: input.stake.thresholdMissed ?? null,
      collective_target_pct: input.stake.collectiveTargetPct ?? null,
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
  start_date: string | null; // null while status === 'lobby' (not started yet)
  timezone: string;
  status: string;
  invite_code: string;
  joker_allowance: number;
  first_day_join_only: boolean;
  created_at: string;
  owner_id: string | null;
  // Set only when the challenge was ended EARLY (docs/db-stake-v2.sql §2).
  ended_on_day: number | null;
}

interface ParticipantRow {
  id: string; // participants.id — what check_ins.participant_id references
  challenge_id: string;
  user_id: string;
  // When this person joined — the stake threshold only holds someone
  // responsible from their own join day onward (src/data/stakeOutcome.ts).
  // Nullable in the schema, so treat a missing value as "was here from day 1".
  joined_at: string | null;
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
  // Bahis v2 (docs/db-stake-v2.sql). Nullable across the board so a row
  // written before that migration still maps cleanly.
  kind: 'individual' | 'collective' | null;
  threshold_missed: number | null;
  collective_target_pct: number | null;
  settled_at: string | null;
}

/** Shared by both mapping paths — a pre-v2 row has no `kind`, and is treated
 * as 'individual' with no threshold, which means no outcome is computed and
 * the finish screen falls back to showing the raw text. */
function mapStake(stake: StakeRow | undefined): Challenge['stake'] {
  if (!stake) return undefined;
  return {
    mode: stake.mode,
    kind: stake.kind ?? 'individual',
    text: stake.text ?? '',
    thresholdMissed: stake.threshold_missed ?? undefined,
    collectiveTargetPct: stake.collective_target_pct ?? undefined,
    settled: !!stake.settled_at,
  };
}

interface NudgeRow {
  to_user: string;
  challenge_id: string;
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
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date()); // "YYYY-MM-DD"
  // Test-only acceleration: 1 day == 1 minute, anchored to created_at
  // because start_date has no time-of-day (see src/lib/fastDays.ts).
  //
  // The start date still gates it. Fast mode used to return a positive day
  // straight away, so a ring scheduled weeks out showed as running and took
  // check-ins the moment it was created. Acceleration applies to a ring that
  // has begun; it doesn't begin one.
  //
  // Before the start date it falls through to the real calendar math below,
  // so "3 gün sonra başlıyor" stays truthful instead of collapsing to a flat
  // "not started".
  if (FAST_DAYS && todayStr >= startISO) return fastDaysSince(createdAtISO);
  const start = new Date(`${startISO}T00:00:00Z`);
  const today = new Date(`${todayStr}T00:00:00Z`);
  return Math.round((today.getTime() - start.getTime()) / 86_400_000);
}

function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Longest run of consecutive covered days (done or joker) within 1..N. */
function longestStreak(days: Set<number>): number {
  if (days.size === 0) return 0;
  const last = Math.max(...days);
  let best = 0;
  let run = 0;
  for (let d = 1; d <= last; d++) {
    if (days.has(d)) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return best;
}

/**
 * 'lobby' — kurucu henüz başlatmadı, start_date yok. Gerçek gün matematiğine
 * (daysSinceStart vb.) HİÇ girmiyor — null bir start_date'i tarihe çevirmeye
 * çalışmak Invalid Date/NaN üretir, sessizce yanlış bir "gün 1" ya da check-in
 * kabulüne yol açabilirdi (check-in Edge Function'ında ayrıca ayrıca
 * guard'landı, docs/db-lobby.sql). Katılımcı listesi check-in/nudge farkı
 * gözetmeden minimal kuruluyor — henüz kimse check-in yapamaz.
 */
function mapLobbyRow(
  row: ChallengeRow,
  parts: ParticipantRow[],
  profMap: Map<string, { name?: string; initials?: string }>,
  myUserId: string,
  stake?: StakeRow,
): Challenge {
  const t = getDict();
  const participants: Participant[] = parts.map((p) => {
    const prof = profMap.get(p.user_id);
    const name = prof?.name ?? t.common.person;
    return {
      id: p.user_id,
      name,
      initials: prof?.initials ?? name.slice(0, 2).toUpperCase(),
      isMe: p.user_id === myUserId,
      checkedInToday: false,
      completedDays: 0,
      nudged: false,
    };
  });

  return {
    id: row.id,
    title: row.title,
    dailyAction: `${t.common.today}: ${row.daily_action}`,
    dailyActionRaw: row.daily_action,
    totalDays: row.total_days,
    currentDay: 0,
    days: [],
    status: 'lobby',
    startsLabel: t.common.lobbyWaiting,
    meCheckedInToday: false,
    jokerRemaining: row.joker_allowance,
    jokerAllowance: row.joker_allowance,
    timezone: row.timezone,
    startDate: row.start_date,
    createdAt: row.created_at,
    hasMissedYesterday: false,
    inviteCode: row.invite_code,
    scheduleSummary: t.common.scheduleSummary(row.daily_action, row.total_days),
    startsWhen: t.common.lobbyWaiting,
    firstDayJoinOnly: row.first_day_join_only,
    isOwner: row.owner_id === myUserId,
    joinClosed: false, // lobby'de katılım penceresi kavramı henüz devrede değil
    stake: mapStake(stake),
    participants,
    messages: [],
  };
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
  if (row.status === 'lobby' || !row.start_date) {
    return mapLobbyRow(row, parts, profMap, myUserId, stake);
  }
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
    // How far the ring actually got. Ending early freezes it there: the days
    // after that never arrived, so they stay empty instead of turning into
    // missed days as the calendar keeps moving. Same number stakeOutcome
    // counts against.
    const elapsed =
      status === 'completed'
        ? Math.min(row.ended_on_day ?? currentDay, row.total_days)
        : currentDay;
    // A finished ring has no "today" — its last day is history like every
    // other. Leaving it as 'today' left that segment breathing forever.
    const lastSettled = status === 'completed' ? elapsed : currentDay - 1;
    for (let i = 1; i <= lastSettled; i++) {
      const c = myByDay.get(i);
      explicit.push(c ? (c.type === 'joker' ? 'joker' : 'done') : 'missed');
    }
    if (status !== 'completed') {
      const todayCheckIn = myByDay.get(currentDay);
      explicit.push(todayCheckIn ? (todayCheckIn.type === 'joker' ? 'joker' : 'done') : 'today');
    }
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
      // Under FAST_DAYS this always reads false: the DB limit counts a real
      // calendar day, not a fast-day, and insertNudge already clears today's
      // row before every test-mode insert — showing the stale "already
      // nudged" state here would just make ParticipantRow block the retry
      // before that clear-then-insert ever runs.
      nudged: !FAST_DAYS && nudgedToday.has(p.user_id),
    };
  });

  // Bahis v2 outcome — the stake threshold only becomes answerable once the
  // challenge is over. Uses the shared helper so the mock store computes the
  // exact same thing (src/data/stakeOutcome.ts), and counts each person from
  // THEIR join day against the day the challenge actually stopped on.
  const stakeOutcomeResult =
    status === 'completed'
      ? computeStakeOutcome({
          stake: mapStake(stake),
          participants,
          totalDays: row.total_days,
          endedOnDay: row.ended_on_day ?? undefined,
          joinDayByParticipant: new Map(
            parts.map((p) => [
              p.user_id,
              row.start_date && p.joined_at
                ? Math.max(daysSinceStart(row.start_date, row.timezone, p.joined_at) + 1, 1)
                : 1,
            ]),
          ),
          totalCheckIns: checkIns.length,
        })
      : {};

  // E9 finish stats — only meaningful once the challenge is actually over.
  const finishStats =
    status === 'completed' && parts.length > 0
      ? {
          people: parts.length,
          checkins: checkIns.length,
          completionPct: Math.round((checkIns.length / (parts.length * row.total_days)) * 100),
        }
      : undefined;

  // Halkora Pro — gelişmiş istatistikler. Aynı verinin (checkIns) daha zengin
  // bir okuması: kişi kişi seri/oran + herkesin işaretlediği "kusursuz" günler.
  const advancedStats =
    status === 'completed' && parts.length > 0
      ? (() => {
          // day_number -> distinct participants who covered it (perfect-day count).
          const coveredByDay = new Map<number, Set<string>>();
          for (const c of checkIns) {
            if (!coveredByDay.has(c.day_number)) coveredByDay.set(c.day_number, new Set());
            coveredByDay.get(c.day_number)!.add(c.participant_id);
          }
          const perfectDayNumbers: number[] = [];
          for (let d = 1; d <= row.total_days; d++) {
            if ((coveredByDay.get(d)?.size ?? 0) === parts.length) perfectDayNumbers.push(d);
          }
          const perfectDays = perfectDayNumbers.length;

          const leaderboard = parts
            .map((p) => {
              const myDays = new Set(
                checkIns.filter((c) => c.participant_id === p.id).map((c) => c.day_number),
              );
              const prof = profMap.get(p.user_id);
              const name = prof?.name ?? t.common.person;
              return {
                name,
                initials: prof?.initials ?? name.slice(0, 2).toUpperCase(),
                completedDays: myDays.size,
                completionPct: Math.round((myDays.size / row.total_days) * 100),
                longestStreak: longestStreak(myDays),
              };
            })
            .sort((a, b) => b.completedDays - a.completedDays || b.longestStreak - a.longestStreak);

          return { perfectDays, perfectDayNumbers, leaderboard };
        })()
      : undefined;

  return {
    id: row.id,
    title: row.title,
    dailyAction: `${t.common.today}: ${row.daily_action}`,
    dailyActionRaw: row.daily_action,
    totalDays: row.total_days,
    currentDay,
    days: buildDays(row.total_days, explicit),
    status,
    startsLabel: status === 'upcoming' ? startsWhen : undefined,
    meCheckedInToday,
    myCheckinTime: myTodayCheckIn ? hhmm(myTodayCheckIn.created_at) : undefined,
    myOrder: meCheckedInToday ? myOrder || undefined : undefined,
    jokerRemaining: Math.max(row.joker_allowance - jokerUsed, 0),
    jokerAllowance: row.joker_allowance,
    timezone: row.timezone,
    startDate: row.start_date,
    createdAt: row.created_at,
    hasMissedYesterday,
    inviteCode: row.invite_code,
    scheduleSummary: t.common.scheduleSummary(row.daily_action, row.total_days),
    startsWhen,
    firstDayJoinOnly: row.first_day_join_only,
    isOwner: row.owner_id === myUserId,
    // Client-side mirror of the join_challenge_by_code RPC's check (Ek M) —
    // display only, the RPC is what actually enforces it server-side.
    joinClosed: row.first_day_join_only && currentDay > 1,
    stake: mapStake(stake),
    participants,
    messages: [],
    finishStats,
    advancedStats,
    // Both undefined for a pre-v2 stake (no threshold was ever chosen), in
    // which case the finish screen falls back to the raw stake text.
    stakeResult: stakeOutcomeResult.text,
    stakeOutcome: stakeOutcomeResult.outcome,
    endedOnDay: row.ended_on_day ?? undefined,
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
        'id, title, daily_action, total_days, start_date, timezone, status, invite_code, joker_allowance, first_day_join_only, created_at, owner_id, ended_on_day',
      )
      .in('id', ids),
    supabase
      .from('participants')
      .select('id, challenge_id, user_id, joined_at')
      .in('challenge_id', ids),
    supabase
      .from('check_ins')
      .select('participant_id, challenge_id, day_number, type, created_at')
      .in('challenge_id', ids),
    supabase
      .from('stakes')
      .select(
        'challenge_id, mode, text, kind, threshold_missed, collective_target_pct, settled_at',
      )
      .in('challenge_id', ids),
    // "Have I already nudged this person today, IN THIS CHALLENGE?" — the DB's
    // uniqueness window is now (from_user, to_user, challenge_id, day)
    // (docs/db-nudge-and-message-notify.sql §5): nudging someone in one
    // challenge no longer shows them as already-nudged in a completely
    // different one you happen to share (saha testi bulgusu — "yeni challange
    // oluşturdum onda bile sallandı gözüküyor").
    supabase.from('nudges').select('to_user, challenge_id, created_at').eq('from_user', user.id).in('challenge_id', ids),
  ]);
  if (e2) throw e2;
  if (e3) throw e3;
  if (e4) throw e4;
  if (e5) throw e5;
  if (e6) throw e6;

  const todayUTC = new Date().toISOString().slice(0, 10);
  // challenge_id -> Set(recipient user_id) nudged today, in THAT challenge.
  const nudgedTodayByChallenge = new Map<string, Set<string>>();
  for (const n of (myNudges ?? []) as NudgeRow[]) {
    if (utcDateOf(n.created_at) !== todayUTC) continue;
    const set = nudgedTodayByChallenge.get(n.challenge_id) ?? new Set<string>();
    set.add(n.to_user);
    nudgedTodayByChallenge.set(n.challenge_id, set);
  }

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
      nudgedTodayByChallenge.get(row.id) ?? new Set<string>(),
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

/**
 * Closes the stake ("ödendi/kutlandı") — docs/db-stake-v2.sql. The RPC
 * computes the result text ITSELF and posts the chat system message; we only
 * pass the locale so it picks a language. Deliberately NOT sending the
 * client's own computed string: a system message renders with more
 * authority than a normal one and also goes out as a push, so letting any
 * member supply that text would be an injection vector.
 */
export async function settleStake(challengeId: string): Promise<void> {
  const { error } = await supabase.rpc('settle_stake', {
    p_challenge_id: challengeId,
    p_locale: getLocale(),
  });
  if (error) throw error;
}

/** Owner-only hard delete — docs/db-challenge-lifecycle.sql cascades the rest. */
export async function deleteChallenge(challengeId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_challenge', { p_challenge_id: challengeId });
  if (error) throw error;
}

/** Non-owner participant removes themselves; the RPC rejects the owner. */
export async function leaveChallenge(challengeId: string): Promise<void> {
  const { error } = await supabase.rpc('leave_challenge', { p_challenge_id: challengeId });
  if (error) throw error;
}

/**
 * Owner-only. Leaves lobby state: `p_start_date` omitted/undefined starts
 * today (right now); pass a future "YYYY-MM-DD" for "start at X" instead —
 * mapRow's normal date math takes over from here exactly like any other
 * challenge (docs/db-lobby.sql).
 */
export async function startChallenge(challengeId: string, startDateISO?: string): Promise<void> {
  const { error } = await supabase.rpc('start_challenge', {
    p_challenge_id: challengeId,
    p_start_date: startDateISO ?? null,
  });
  if (error) throw error;
}

/**
 * Faz 3C madde 3 — owner-only edit of title/daily action/stake text.
 * Deliberately narrow (docs/db-owner-settings.sql): day count, jokers, start
 * date, and the join window can never be changed this way — they'd change
 * the meaning/fairness of check-ins the group already made.
 */
export async function updateChallengeDetails(
  challengeId: string,
  title: string,
  dailyAction: string,
  stakeText: string,
): Promise<void> {
  const { error } = await supabase.rpc('update_challenge_details', {
    p_challenge_id: challengeId,
    p_title: title,
    p_daily_action: dailyAction,
    p_stake_text: stakeText,
  });
  if (error) throw error;
}
