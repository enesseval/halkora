import type { Challenge } from '@/data/types';

/**
 * Faz 2 §2.3 — which halka the widget should lead with.
 *
 * Scored here rather than in Swift on purpose: the widget is meant to decode
 * and draw, nothing else. Ordering is a product judgement that changes far
 * more often than a layout does, and changing it here doesn't need an Archive.
 *
 * Not implemented from the spec: the "unread nudge" term (+500). Nothing in
 * the app currently records a nudge RECEIVED — `nudgedToday` tracks who *you*
 * nudged — so the signal has no source yet. Left out rather than faked, since
 * a term that's always zero silently changes every other weight's meaning.
 */

/** Local evening, after which an open ring starts reading as a risk. Config,
 * not a magic number in the middle of the formula. */
export const RISK_HOUR = 20;

export interface Urgency {
  score: number;
  /** Everyone else has closed today; the ring is waiting on this person
   * alone. The single strongest thing the widget can say. */
  userIsLast: boolean;
  /** Who the ring is still waiting on, at most two — the widget adds "+N". */
  pendingNames: string[];
}

/** Consecutive covered days ending yesterday, plus today if it's covered. */
function streak(c: Challenge): number {
  let n = 0;
  for (let i = Math.min(c.currentDay, c.days.length) - 1; i >= 0; i--) {
    const d = c.days[i];
    if (d === 'done' || d === 'joker') n += 1;
    else if (d === 'today') continue; // an open today doesn't break it
    else break;
  }
  return n;
}

/** Hours until the ring's cut-off, from `now` in the ring's own timezone. */
function hoursToDeadline(c: Challenge, now: Date): number {
  const localHour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: c.timezone,
      hour: '2-digit',
      hour12: false,
    }).format(now),
  );
  const localMinute = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: c.timezone,
      minute: '2-digit',
    }).format(now),
  );
  const deadlineHour = Number(c.deadlineTime.slice(0, 2));
  const deadlineMinute = Number(c.deadlineTime.slice(3, 5));
  const diff = deadlineHour * 60 + deadlineMinute - (localHour * 60 + localMinute);
  // Already past today's cut-off: the next one is a full cycle away.
  return ((diff + 1440) % 1440) / 60;
}

export function urgencyOf(c: Challenge, now: Date = new Date()): Urgency {
  const pending = c.participants.filter((p) => !p.checkedInToday);
  const userIsLast = !c.meCheckedInToday && pending.length === 1 && !!pending[0]?.isMe;
  const pendingNames = pending.filter((p) => !p.isMe).map((p) => p.name);

  if (c.status !== 'active') {
    // Not running: below everything that is, but still ordered among itself by
    // how soon it starts — a ring beginning tomorrow beats one in three weeks.
    return { score: -1000, userIsLast: false, pendingNames };
  }

  let score = 0;
  if (userIsLast) score += 1000;

  // Closer to the cut-off, higher — full weight in the last hour, none a full
  // cycle out.
  const hours = hoursToDeadline(c, now);
  score += Math.min(300, Math.round(300 * (1 - Math.min(hours, 24) / 24)));

  // Something is actually on the line today.
  const openToday = !c.meCheckedInToday;
  if (openToday && (streak(c) > 0 || c.jokerRemaining === 0)) score += 200;

  // Already closed: keep it, but under everything still open.
  if (c.meCheckedInToday) score -= 800;

  // Tiebreaks folded in as small terms so the caller can sort on one number:
  // more people still pending first, then the sooner cut-off.
  score += Math.min(pending.length, 20) * 2;
  score += Math.max(0, 24 - Math.min(hours, 24)) / 24;

  return { score, userIsLast, pendingNames };
}

/** Most urgent first. Stable for equal scores, so the list doesn't shuffle
 * between refreshes for no reason. */
export function byUrgency(challenges: Challenge[], now: Date = new Date()): Challenge[] {
  return challenges
    .map((c, i) => ({ c, i, u: urgencyOf(c, now) }))
    .sort((a, b) => b.u.score - a.u.score || a.i - b.i)
    .map((x) => x.c);
}
