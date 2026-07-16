import { SegmentState } from '@/data/types';
import { getDict, getLocale, intlTag } from '@/i18n';

/**
 * Build a `days` array of a given length from a set of explicit states,
 * padding the rest with 'empty'. Guarantees `days.length === totalDays`.
 */
export function buildDays(
  totalDays: number,
  explicit: SegmentState[],
): SegmentState[] {
  const out: SegmentState[] = [];
  for (let i = 0; i < totalDays; i++) {
    out.push(explicit[i] ?? 'empty');
  }
  return out;
}

/** Index (0-based) of today's segment. Returns -1 when there is no active day. */
export function todayIndex(currentDay: number): number {
  return currentDay > 0 ? currentDay - 1 : -1;
}

/** Number of participants (including me) who have completed today. */
export function completedToday(participants: { checkedInToday: boolean }[]): number {
  return participants.filter((p) => p.checkedInToday).length;
}

/** "7 Temmuz Salı" / "Tuesday, July 7" — via Intl so month/weekday names AND
 * their locale-specific order follow the current app language, instead of a
 * hand-rolled Turkish-only table. */
export function formatLongDate(d: Date): string {
  return new Intl.DateTimeFormat(intlTag(), { day: 'numeric', month: 'long', weekday: 'long' }).format(d);
}

/** "8 Temmuz" / "July 8" */
export function formatShortDate(d: Date): string {
  return new Intl.DateTimeFormat(intlTag(), { day: 'numeric', month: 'long' }).format(d);
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Clock string "21:04" for the current time. */
export function nowClock(): string {
  const d = new Date();
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Human "join others" summary: "Ayşe, Can ve Mert'i bekliyoruz" / "Waiting on Ayşe, Can and Mert". */
export function waitingNames(names: string[]): string {
  const t = getDict();
  if (names.length === 0) return t.detail.everyoneWaiting;
  if (names.length === 1) return t.detail.waitingFor(names[0]);
  const head = names.slice(0, -1).join(', ');
  const tail = names[names.length - 1];
  return t.detail.waitingForMany(head, tail);
}
