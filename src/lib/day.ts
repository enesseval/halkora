import { SegmentState } from '@/data/types';

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

const MONTHS_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];
const DAYS_TR = [
  'Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi',
];

/** "7 Temmuz Salı" */
export function formatLongDate(d: Date): string {
  return `${d.getDate()} ${MONTHS_TR[d.getMonth()]} ${DAYS_TR[d.getDay()]}`;
}

/** "8 Temmuz" */
export function formatShortDate(d: Date): string {
  return `${d.getDate()} ${MONTHS_TR[d.getMonth()]}`;
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

/** Human "join others" summary: "Ayşe, Can ve Mert'i bekliyoruz". */
export function waitingNames(names: string[]): string {
  if (names.length === 0) return 'Herkes tamamladı';
  if (names.length === 1) return `${names[0]}'i bekliyoruz`;
  const head = names.slice(0, -1).join(', ');
  const tail = names[names.length - 1];
  return `${head} ve ${tail}'i bekliyoruz`;
}
