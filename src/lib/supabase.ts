import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
// Supabase renamed "anon key" -> "publishable key"; accept either name.
const anonKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  '';

/**
 * True only when both env vars are present. While false the app keeps running
 * on the Phase-1 mock layer (so it never crashes mid-migration in Expo Go).
 */
export const isSupabaseConfigured = Boolean(url && anonKey);

// `createClient('', '')` THROWS SYNCHRONOUSLY ("supabaseUrl is required.") —
// and this file runs at module-import time, before React even mounts, so
// that throw crashes the whole app on launch with no error boundary able to
// catch it. This bit the EAS/TestFlight build specifically: `.env` is (and
// should stay) gitignored, so EAS Build's cloud checkout never has the real
// EXPO_PUBLIC_SUPABASE_* values unless they're set as EAS env vars — see
// docs/PHASE2-SUPABASE.md "Ek H". Fall back to harmless placeholders so the
// client always constructs; every real call site is already gated behind
// `isSupabaseConfigured`, so a placeholder client is simply never used.
/**
 * How long any single request may hang before it is called a failure.
 *
 * Without one, an offline request sits there until the OS gives up, which on
 * iOS is around a minute — long enough that pull-to-refresh spins, the user
 * pulls again, and several "couldn't update" alerts arrive at once when the
 * timeouts finally land together (saha testi bulgusu — "defalarca
 * güncellenemedi/bağlantı yok alerti çıktı ve çok uzun sürdü"). Twelve
 * seconds is far more than any of these calls needs when there IS a network,
 * and turns being offline into a quick, single, honest answer.
 */
const REQUEST_TIMEOUT_MS = 12_000;

const timeoutFetch: typeof fetch = (input, init) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  // A caller's own signal still wins — chain it rather than replacing it.
  init?.signal?.addEventListener?.('abort', () => controller.abort());
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
};

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-anon-key',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // RN has no URL-based session; disable web-only detection.
      detectSessionInUrl: false,
    },
    global: { fetch: timeoutFetch },
  },
);
