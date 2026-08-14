import { Platform } from 'react-native';
import { ExtensionStorage } from '@bacons/apple-targets';
import type { Challenge } from '@/data/types';
import { cycleStart } from '@/lib/cycle';
import { byUrgency, urgencyOf } from '@/lib/widgetUrgency';
import { getLocale } from '@/i18n';

/**
 * Identifies WHICH day a check-in belongs to, so the widget can tell "done
 * today" from "done yesterday, still showing" without the app running.
 * Mirrors HalkoraWidget.swift's todayKey() — keep both in sync.
 */
function dayKeyFor(c: Challenge): string {
  // The CYCLE it belongs to, not the calendar date — with a 21:00 deadline a
  // check-in made at 22:00 belongs to the cycle that opened then, and keying
  // it by the calendar date would make it look stale to the widget five
  // minutes later. Identical to the calendar date at the default 00:00.
  return cycleStart(c.timezone, c.deadlineTime);
}

// Same App Group id as app.json's ios.entitlements + targets/widget's
// expo-target.config.js (auto-synced from the main app) — must match
// EXACTLY (case-sensitive), see targets/widget/HalkoraWidget.swift.
const APP_GROUP = 'group.com.halkora.app.widget';
// Full list, not just one pick — saha testi bulgusu: "aktif halkamız varsa
// kaydırarak bunlar arasında geçip widget üzerinden check-in yapabilelim".
// A WidgetKit view itself can't do swipe gestures (Apple only allows tap,
// via Button/Toggle+AppIntent on iOS 17+); the native way to "swipe between
// halkalar" is adding several copies of the SAME widget and letting iOS
// stack them — each copy configured (long-press -> Edit Widget) to a
// specific challenge via HalkoraWidget.swift's ChallengeEntity/EntityQuery,
// which needs the full list available, not just one.
const ACTIVE_CHALLENGES_KEY = 'activeChallenges';

// ExtensionStorage's native module is iOS-only (no-ops safely on
// Android/web via the JS shim, but skip constructing it there anyway).
const storage = Platform.OS === 'ios' ? new ExtensionStorage(APP_GROUP) : null;

/**
 * Pushes every active challenge into the shared App Group so the home-screen
 * widget (targets/widget) can render one without waiting for this app to be
 * open. Call this whenever the challenge list changes (fetch, check-in,
 * undo) — the widget's own tap-to-check-in (CheckInIntent) also calls the
 * check-in Edge Function directly over the network and writes the result
 * back into this same storage, so its view stays fresh even when this
 * function never runs (src/lib/widgetAuth.ts is what makes that call
 * authenticated).
 *
 * Best-effort and silent: this is a side-channel for a nice-to-have Home
 * Screen widget, never allowed to throw into a real user-facing flow.
 */
/**
 * DEV-only readback so "widget boş görünüyor" is self-diagnosable on a real
 * TestFlight device instead of guessed at. Every failure mode in this chain
 * is SILENT by design (the ExtensionStorage JS shim no-ops when the native
 * module isn't linked; UserDefaults(suiteName:) returns nil when the App
 * Group entitlement is missing; syncWidgetSnapshot swallows everything), so
 * this writes a probe, reads it straight back, and reports what actually
 * landed:
 *  - "native module yok" -> pod install/rebuild missing
 *  - "app group yazmıyor" -> App Group entitlement not provisioned
 *  - probe OK but 0 active -> nothing wrong with the plumbing at all, there
 *    just isn't an ACTIVE challenge (a 'lobby'/'upcoming' one doesn't count)
 */
export function widgetDiagnostics(challenges: Challenge[]): string {
  if (Platform.OS !== 'ios') return 'iOS değil';
  if (!storage) return 'storage yok';
  const byStatus = challenges.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {});
  const counts = Object.entries(byStatus)
    .map(([k, v]) => `${k}:${v}`)
    .join(' ');
  // Distinguishes the two ways a write can vanish, which need completely
  // different fixes. ExtensionStorage's JS side falls back to no-op stubs
  // when its native module isn't in the binary (see the package's
  // build/ExtensionStorage.js) — that's a pod install/rebuild problem. If
  // the module IS there but the write still doesn't read back, it's the App
  // Group entitlement instead.
  const nativeModule = (globalThis as { expo?: { modules?: Record<string, unknown> } }).expo?.modules
    ?.ExtensionStorage;
  if (!nativeModule) return `NATIVE MODÜL YOK (pod install/rebuild) · ${counts || 'halka yok'}`;

  try {
    storage.set('probe', Date.now());
    const probe = storage.get('probe');
    if (probe == null) return `APP GROUP YAZMIYOR (entitlement) · ${counts || 'halka yok'}`;
    const stored = storage.get(ACTIVE_CHALLENGES_KEY);
    const storedCount = stored ? (JSON.parse(stored) as unknown[]).length : null;
    return `probe OK · paylaşılan:${storedCount ?? 'yok'} · ${counts || 'halka yok'}`;
  } catch (e) {
    return `hata: ${e instanceof Error ? e.message : String(e)}`;
  }
}

/**
 * Per-day ring state, one character per day, as the widget's segmented ring
 * needs it. Only three cases actually render differently: a completed day, a
 * joker-covered day, and everything else — "missed" and "upcoming" are
 * deliberately identical in this product (never red, never punishing), so
 * they collapse to the same '-'. `today` isn't encoded: the widget knows
 * which day is today from its own math and paints that segment itself.
 */
function segmentsOf(c: Challenge): string {
  return c.days
    .map((d) => (d === 'done' ? 'd' : d === 'joker' ? 'j' : '-'))
    .join('');
}

/**
 * Has a widget of ours actually rendered recently?
 *
 * The widget stamps `widgetSeenAt` into the shared container every time it
 * builds a timeline (markWidgetAlive in HalkoraWidget.swift). WidgetKit's own
 * getCurrentConfigurations is only reachable from native code this app
 * doesn't have, and writing a native module to answer one boolean wasn't
 * worth it when the widget already shares a container and can just say so.
 *
 * Stale after a week: a widget that hasn't drawn in seven days has almost
 * certainly been removed, and the hint is worth offering again.
 */
export function hasWidgetInstalled(): boolean {
  if (!storage) return false;
  try {
    const seen = storage.get('widgetSeenAt');
    if (seen == null) return false;
    const at = Number(seen) * 1000;
    return Number.isFinite(at) && Date.now() - at < 7 * 86_400_000;
  } catch {
    return false;
  }
}

export function syncWidgetSnapshot(challenges: Challenge[]): void {
  if (!storage) return;
  try {
    // Upcoming/lobby halkalar are included too — the widget has a real
    // "not started yet" state for them (widget spec 04). Completed ones are
    // dropped: nothing to act on, and they'd crowd out a live halka.
    // Faz 2 §2.3 — ordered here, not in Swift. The widget shows the array as
    // it arrives; deciding which halka leads is a product judgement that
    // changes more often than a layout, and this way it changes without a
    // rebuild.
    const relevant = byUrgency(
      challenges.filter(
        (c) => c.status === 'active' || c.status === 'upcoming' || c.status === 'lobby',
      ),
    );
    const locale = getLocale();
    storage.set(
      ACTIVE_CHALLENGES_KEY,
      relevant.map((c) => ({
        challengeId: c.id,
        title: c.title,
        // Raw, un-prefixed action ("20 sayfa oku") — `dailyAction` carries a
        // "Bugün: " prefix that would just repeat inside the widget.
        dailyAction: c.dailyActionRaw ?? '',
        totalDays: c.totalDays,
        // Raw day-math inputs rather than a precomputed currentDay/
        // checkedInToday: the widget re-derives both itself so it rolls over
        // at midnight on its own (saha testi bulgusu: "tekrar uygulamaya
        // girene kadar yeni güne widget geçmiyor"). HalkoraWidget.swift
        // mirrors daysSinceStart() from src/data/challenges.ts exactly —
        // change one, change the other.
        timezone: c.timezone,
        // Faz 1: the day closes here, not at midnight. The widget re-derives
        // the cycle itself for the same reason it re-derives the day.
        deadlineTime: c.deadlineTime,
        startDate: c.startDate ?? '',
        // The day this check-in belongs to, not a boolean — a stale `true`
        // is exactly what made the widget claim "Yapıldı ✓" into the next
        // day. Empty when not checked in. Key format matches the widget's
        // own todayKey(): the challenge-timezone date.
        checkedInDayKey: c.meCheckedInToday ? dayKeyFor(c) : '',
        segments: segmentsOf(c),
        // Group progress ("4/8 tamamladı"). Only meaningful for the day it
        // was counted on, so it's stamped — the widget hides the line rather
        // than showing yesterday's count after a rollover.
        syncedDayKey: dayKeyFor(c),
        participantsTotal: c.participants.length,
        participantsDoneToday: c.participants.filter((p) => p.checkedInToday).length,
        // "Sıra sende" — everyone else has closed today. The strongest single
        // thing the widget can say, and not derivable from the counts alone
        // because it also depends on which of them is you.
        userIsLast: urgencyOf(c).userIsLast ? 1 : 0,
        // At most two names; the widget appends "+N" from participantsTotal.
        pendingNames: urgencyOf(c)
          .pendingNames.slice(0, 2)
          .map((n) => n.replace(/[,]/g, ''))
          .join(','),
        // Who's in, and who's still owed today — the large widget shows the
        // group person by person rather than as a count. Packed into one
        // string because ExtensionStorage only takes strings/numbers inside
        // an object, same reason `segments` is a string. Separators are
        // stripped from initials so a stray one can't split a field, and the
        // list is capped because a widget can't show more anyway.
        roster: c.participants
          .slice(0, 12)
          .map((p) => `${p.initials.replace(/[,:]/g, '')}:${p.checkedInToday ? 1 : 0}`)
          .join(','),
        jokerRemaining: c.jokerRemaining,
        // 'active' | 'upcoming' | 'lobby' — drives which layout the widget
        // renders; the widget never re-derives this itself because a lobby
        // has no start date to compute from.
        state: c.status,
        // Already-localized by the app ("Pazartesi başlıyor" / "Kurucu
        // başlatacak") — the widget's own COPY dict can't produce these
        // without duplicating the whole date-formatting layer.
        startsLabel: c.startsLabel ?? c.startsWhen ?? '',
        locale,
      })),
    );
    ExtensionStorage.reloadWidget();
  } catch {
    // never let widget sync break a real flow
  }
}
