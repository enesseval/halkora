import type { Participant, Stake, StakeOutcome } from './types';
import { getDict } from '@/i18n';

/**
 * Who owes what once a challenge is over — the single implementation shared
 * by the real data layer (`mapRow`) and the mock store, so the demo can
 * never drift from production behaviour.
 *
 * ## Why the day math looks like this
 *
 * The naive version — `missed = totalDays - completedDays` — is wrong in two
 * cases that are both COMMON, not edge cases:
 *
 *  - **Ended early.** `end_challenge_early` flips status to 'completed'
 *    without shortening `total_days`, so every unelapsed day would count as
 *    missed and the entire group would lose the bet. That's why
 *    `endedOnDay` exists (docs/db-stake-v2.sql §2).
 *  - **Joined late.** `first_day_join_only` defaults to false, so joining
 *    mid-challenge is the normal path. Someone who joined on day 5 must not
 *    be charged for days 1-4.
 *
 * Jokers are deliberately forgiving: `completedDays` counts check-in rows of
 * any type, so a joker-covered day is not a missed day. That's a product
 * decision, not an accident — a group that wants stricter accounting would
 * need the threshold to ignore joker rows.
 */

export interface StakeOutcomeInput {
  stake: Stake | undefined;
  participants: Participant[];
  totalDays: number;
  /** The day the challenge actually stopped on; falls back to totalDays. */
  endedOnDay?: number;
  /** 1-based day each participant joined on (their first eligible day).
   * Missing entry = treated as day 1. */
  joinDayByParticipant?: Map<string, number>;
  /** Every check-in in the challenge, all participants — collective only. */
  totalCheckIns?: number;
}

export interface StakeOutcomeResult {
  outcome?: StakeOutcome;
  /** Ready-to-show line; `undefined` for a pre-v2 stake with no threshold. */
  text?: string;
}

/** Days this person was actually on the hook for. */
function earnedDays(elapsed: number, joinDay: number): number {
  return Math.max(elapsed - Math.max(joinDay, 1) + 1, 0);
}

export function computeStakeOutcome(input: StakeOutcomeInput): StakeOutcomeResult {
  const { stake, participants, totalDays, endedOnDay, joinDayByParticipant, totalCheckIns } = input;
  if (!stake) return {};
  const t = getDict();
  const elapsed = endedOnDay ?? totalDays;

  if (stake.kind === 'collective' && stake.collectiveTargetPct != null) {
    const target = Math.ceil((stake.collectiveTargetPct / 100) * elapsed * participants.length);
    const total = totalCheckIns ?? 0;
    const hit = total >= target;
    return {
      outcome: {
        kind: 'collective',
        losers: [],
        collectiveHit: hit,
        collectiveTotal: total,
        collectiveTarget: target,
      },
      text: hit
        ? t.complete.stakeCollectiveWin(total, target)
        : t.complete.stakeCollectiveFail(total, target, stake.text),
    };
  }

  if (stake.thresholdMissed != null) {
    const threshold = stake.thresholdMissed;
    const losers = participants.filter((p) => {
      const earned = earnedDays(elapsed, joinDayByParticipant?.get(p.id) ?? 1);
      const missed = Math.max(earned - (p.completedDays ?? 0), 0);
      return missed > threshold;
    });
    return {
      outcome: { kind: 'individual', losers },
      text:
        losers.length === 0
          ? t.complete.stakeAllPassed
          : t.complete.stakeLosers(losers.map((p) => p.name).join(', '), stake.text),
    };
  }

  // Pre-v2 stake: no threshold was ever chosen, so there's nothing to
  // compute — the finish screen falls back to showing `stake.text`.
  return {};
}
