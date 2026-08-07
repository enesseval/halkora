/**
 * Cycle math — a "day" runs deadline → deadline, not midnight → midnight.
 *
 * The same formula exists in three other places and they must agree exactly,
 * or the screen offers a check-in the server rejects:
 *   - `public.challenge_cycle_start()` (migration f1_deadline_time_and_cycle_math)
 *   - `cycleStartFor()` in supabase/functions/check-in/index.ts
 *   - `rawDay(at:)` in targets/widget/HalkoraWidget.swift
 * Deno and a widget extension can't import from here, hence the copies.
 */

/** Midnight — the default, and what every ring had before deadlines existed. */
export const DEFAULT_DEADLINE = '00:00';

/** Local wall-clock date ("YYYY-MM-DD") and time ("HH:MM") in `timeZone`. */
function localParts(timeZone: string, at: Date): { date: string; time: string } {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(at);
  return { date, time };
}

/**
 * The opening date of the cycle `at` falls in.
 *
 * Cycle D runs (D at deadline) → (D+1 at deadline), and is named after the
 * moment it OPENS. That direction is the whole reason midnight needs no
 * special case: a local time is never earlier than "00:00", so the answer is
 * always the calendar date — exactly what every ring did before deadlines.
 * Naming a cycle after the deadline that CLOSES it would push midnight onto
 * a branch of its own, which is where an off-by-one day would live.
 */
export function cycleStart(timeZone: string, deadline: string, at: Date = new Date()): string {
  const { date, time } = localParts(timeZone, at);
  if (time >= deadline.slice(0, 5)) return date;
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Whole days between two "YYYY-MM-DD" dates. */
export function daysBetween(fromISO: string, toISO: string): number {
  const a = new Date(`${fromISO}T00:00:00Z`).getTime();
  const b = new Date(`${toISO}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** When the open cycle closes, as a real instant — drives the countdown. */
export function cycleEndsAt(timeZone: string, deadline: string, at: Date = new Date()): Date {
  const start = cycleStart(timeZone, deadline, at);
  const next = new Date(`${start}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const [h, m] = deadline.slice(0, 5).split(':').map(Number);
  // Build the closing instant by asking what UTC offset the zone is on at
  // roughly that moment, so a DST change lands on the right side of the shift
  // instead of an hour out.
  const guess = new Date(`${next.toISOString().slice(0, 10)}T${pad(h)}:${pad(m)}:00Z`);
  const offsetMinutes = zoneOffsetMinutes(timeZone, guess);
  return new Date(guess.getTime() - offsetMinutes * 60_000);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Minutes `timeZone` is ahead of UTC at `at`. */
function zoneOffsetMinutes(timeZone: string, at: Date): number {
  const { date, time } = localParts(timeZone, at);
  const asUtc = new Date(`${date}T${time}:00Z`).getTime();
  return Math.round((asUtc - at.getTime()) / 60_000);
}
