import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Faz 2 §2.6 — the widget is invisible until someone knows to look for it,
 * and iOS gives a widget no way to introduce itself. So the app does, once.
 *
 * Deliberately unpushy: it waits for proof of habit (a third check-in) rather
 * than firing at first launch, it never appears if a widget is already
 * installed, and dismissing it is permanent. A prompt that comes back is an
 * advert.
 */
const DISMISSED_KEY = 'widgetHintDismissed';

/** Check-ins before the hint has earned the right to appear. */
export const HINT_AFTER_CHECKINS = 3;

export async function isWidgetHintDismissed(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(DISMISSED_KEY)) === '1';
  } catch {
    // Storage failing shouldn't produce a nag loop — treat it as dismissed.
    return true;
  }
}

export async function dismissWidgetHint(): Promise<void> {
  try {
    await AsyncStorage.setItem(DISMISSED_KEY, '1');
  } catch {
    // Best-effort; worst case it appears once more.
  }
}
