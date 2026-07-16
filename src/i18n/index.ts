import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { tr } from './tr';
import { en } from './en';

export type Locale = 'tr' | 'en';

const DICTS = { tr, en } as const;
const STORAGE_KEY = 'halkora.locale';

interface I18nState {
  locale: Locale;
  setLocale: (l: Locale) => void;
}

/**
 * A plain zustand store (no persist middleware, same pattern as the rest of
 * this codebase — see src/lib/pendingInvite.ts) rather than a React Context,
 * so both components (via useT()) and plain modules (via getDict()/getLocale()
 * — src/lib/day.ts, src/data/*, src/stores/mockStore.ts) can read the current
 * language without needing to be inside a provider.
 */
export const useI18nStore = create<I18nState>((set) => ({
  locale: 'tr',
  setLocale: (locale) => {
    set({ locale });
    AsyncStorage.setItem(STORAGE_KEY, locale).catch(() => {});
  },
}));

export function getLocale(): Locale {
  return useI18nStore.getState().locale;
}

export function getDict() {
  return DICTS[getLocale()];
}

/**
 * Hook for components: re-renders on language change and returns the current
 * dictionary as a plain typed object (`t.common.continue`, `t.detail.useJoker(3)`,
 * `t.create.titles[step]`, ...) — real property access instead of a dot-path
 * string lookup, so every call site is autocompleted and refactor-safe, and
 * arrays/functions/nested groups all just work without a generic-path engine.
 */
export function useT() {
  const locale = useI18nStore((s) => s.locale);
  const setLocale = useI18nStore((s) => s.setLocale);
  return { t: DICTS[locale], locale, setLocale };
}

/** IANA-ish BCP-47 tag for Intl.DateTimeFormat etc. — 'tr-TR' / 'en-US'. */
export function intlTag(locale: Locale = getLocale()): string {
  return locale === 'tr' ? 'tr-TR' : 'en-US';
}

/**
 * Device language via the JS Intl API — Hermes derives its default locale
 * from the OS itself, so this reflects the phone's actual language setting
 * without needing a native module (expo-localization) and the prebuild/
 * rebuild cycle that would come with it. Only 'tr'/'en' are supported right
 * now, so anything not clearly Turkish falls back to English.
 */
function detectDeviceLocale(): Locale {
  try {
    const tag = Intl.DateTimeFormat().resolvedOptions().locale ?? '';
    return tag.toLowerCase().startsWith('tr') ? 'tr' : 'en';
  } catch {
    return 'tr';
  }
}

let initialized = false;

/** Call once from the root layout, before anything renders real copy. */
export async function initLocale(): Promise<void> {
  if (initialized) return;
  initialized = true;
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored === 'tr' || stored === 'en') {
      useI18nStore.setState({ locale: stored });
      return;
    }
  } catch {
    // fall through to device detection
  }
  useI18nStore.setState({ locale: detectDeviceLocale() });
}
