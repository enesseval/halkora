import { Platform } from 'react-native';
import { ExtensionStorage } from '@bacons/apple-targets';
import type { Challenge } from '@/data/types';
import { getLocale } from '@/i18n';

// Same App Group id as app.json's ios.entitlements + targets/widget's
// expo-target.config.js (auto-synced from the main app) — must match
// EXACTLY (case-sensitive), see targets/widget/HalkoraWidget.swift.
const APP_GROUP = 'group.com.halkora.app.widget';
const SNAPSHOT_KEY = 'snapshot';

// ExtensionStorage's native module is iOS-only (no-ops safely on
// Android/web via the JS shim, but skip constructing it there anyway).
const storage = Platform.OS === 'ios' ? new ExtensionStorage(APP_GROUP) : null;

/**
 * Pushes the single most actionable challenge — the one still waiting on a
 * check-in today, or the first active one if everyone's done — into the
 * shared App Group so the home-screen widget (targets/widget) can render it
 * without its own network access; a WidgetKit extension can't run RN/JS or
 * call Supabase itself. Call this whenever the challenge list changes
 * (fetch, check-in, undo).
 *
 * Best-effort and silent: this is a side-channel for a nice-to-have Home
 * Screen widget, never allowed to throw into a real user-facing flow.
 */
export function syncWidgetSnapshot(challenges: Challenge[]): void {
  if (!storage) return;
  try {
    const active = challenges.filter((c) => c.status === 'active');
    const pick = active.find((c) => !c.meCheckedInToday) ?? active[0];
    if (!pick) {
      storage.remove(SNAPSHOT_KEY);
    } else {
      storage.set(SNAPSHOT_KEY, {
        challengeId: pick.id,
        title: pick.title,
        currentDay: pick.currentDay,
        totalDays: pick.totalDays,
        // ExtensionStorage.set only allows string/number values inside an
        // object (no booleans) — HalkoraWidget.swift reads this as 0/1.
        checkedInToday: pick.meCheckedInToday ? 1 : 0,
        locale: getLocale(),
      });
    }
    ExtensionStorage.reloadWidget();
  } catch {
    // never let widget sync break a real flow
  }
}
