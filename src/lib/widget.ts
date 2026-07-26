import { Platform } from 'react-native';
import { ExtensionStorage } from '@bacons/apple-targets';
import type { Challenge } from '@/data/types';
import { getLocale } from '@/i18n';

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
export function syncWidgetSnapshot(challenges: Challenge[]): void {
  if (!storage) return;
  try {
    const active = challenges.filter((c) => c.status === 'active');
    const locale = getLocale();
    storage.set(
      ACTIVE_CHALLENGES_KEY,
      active.map((c) => ({
        challengeId: c.id,
        title: c.title,
        currentDay: c.currentDay,
        totalDays: c.totalDays,
        // ExtensionStorage.set only allows string/number values inside an
        // object (no booleans) — HalkoraWidget.swift reads this as 0/1.
        checkedInToday: c.meCheckedInToday ? 1 : 0,
        locale,
      })),
    );
    ExtensionStorage.reloadWidget();
  } catch {
    // never let widget sync break a real flow
  }
}
