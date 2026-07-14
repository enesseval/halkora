/**
 * TEST-ONLY time acceleration: when EXPO_PUBLIC_FAST_DAYS=1, a challenge
 * "day" lasts one minute instead of a calendar day, so a 7-day challenge can
 * be finished (and the completion flow observed) in ~7 minutes.
 *
 * The anchor is `challenges.created_at` (hour-precision), NOT `start_date`
 * (date-precision) — anchoring a 1-minute day to midnight would make a
 * challenge created at 14:30 instantly sit at "day 870". Day 1 is the first
 * minute after creation.
 *
 * The `check-in` Edge Function mirrors this with its own FAST_DAYS env
 * (supabase secrets set FAST_DAYS=1 + redeploy) — enable/disable BOTH sides
 * together, or the client will show a day the server rejects.
 *
 * Known test-mode quirks (accepted, this never ships enabled):
 * - "Yarın başla" and the first-day-only join window still run on real
 *   calendar dates (they live in SQL, which has no fast mode).
 * - The evening reminder stays date-based and won't fire per fast-day.
 *
 * NEVER enable in a production build.
 */
export const FAST_DAYS = process.env.EXPO_PUBLIC_FAST_DAYS === '1';

export const FAST_DAY_MS = 60_000;

/** 0 on the creation minute (== "starts today"), 1 a minute later, ... */
export function fastDaysSince(createdAtISO: string): number {
  return Math.floor((Date.now() - new Date(createdAtISO).getTime()) / FAST_DAY_MS);
}
