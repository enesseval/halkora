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
