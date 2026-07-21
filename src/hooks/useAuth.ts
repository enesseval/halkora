import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { create } from 'zustand';
import * as Notifications from 'expo-notifications';
import * as AppleAuthentication from 'expo-apple-authentication';
import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { registerForPushToken } from '@/lib/push';
import {
  savePushToken,
  clearPushToken,
  saveLocale,
  saveMessagePreviewPref,
  deleteAccount as deleteAccountRequest,
} from '@/data/profile';
import { slugifyUsername, usernameCandidates } from '@/lib/username';
import { getDict, useI18nStore } from '@/i18n';

/** "Selin Nur" -> "SN" */
export function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface AuthState {
  ready: boolean; // initial session check finished
  session: Session | null;
  name: string | null; // profiles.name (null => needs onboarding)
  username: string | null; // profiles.username (@handle, docs "Ek O")
  isPro: boolean; // profiles.is_pro (Halkora Pro, docs "Ek R")
  // profiles.notify_message_preview — show the real chat message text in a
  // push notification, or just "X sent a message" (Settings toggle).
  // Defaults true (matches the column's own DB default) until loaded.
  messagePreview: boolean;
}

const useAuthStore = create<AuthState>(() => ({
  ready: false,
  session: null,
  name: null,
  username: null,
  isPro: false,
  messagePreview: true,
}));

async function loadProfileName(session: Session | null): Promise<void> {
  if (!session) {
    useAuthStore.setState({ name: null, username: null, isPro: false, messagePreview: true });
    return;
  }
  const { data, error } = await supabase
    .from('profiles')
    .select('name, username, is_pro, notify_message_preview')
    .eq('id', session.user.id)
    .maybeSingle();
  if (error) {
    // Never silently clobber known-good state (e.g. isPro) with a false
    // default just because this one fetch failed (network blip, stale
    // PostgREST schema cache right after an ALTER TABLE, etc.) — that
    // previously made a real Pro user look free again for no visible reason.
    console.error('loadProfileName failed', error);
    return;
  }
  useAuthStore.setState({
    name: data?.name ?? null,
    username: data?.username ?? null,
    isPro: !!data?.is_pro,
    messagePreview: data?.notify_message_preview ?? true,
  });
}

/**
 * Re-reads this device's OWN profile row (name/username/is_pro) from the
 * server. Called on every foreground resume (useAuthInit below) so a value
 * changed elsewhere — you flipping is_pro in the SQL editor, a future
 * RevenueCat webhook — shows up the next time the user opens/returns to the
 * app, without needing a full app restart.
 */
export async function refreshProfile(): Promise<void> {
  await loadProfileName(useAuthStore.getState().session);
}

/**
 * Call once from the root layout. Restores the persisted session and keeps
 * the store in sync with Supabase auth changes.
 */
export function useAuthInit(): void {
  useEffect(() => {
    if (!isSupabaseConfigured) {
      // No backend yet: mark ready so the app runs on the mock layer.
      useAuthStore.setState({ ready: true });
      return;
    }
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      let session = data.session;
      if (session) {
        // getSession() only reads the locally cached JWT — it does not confirm
        // the user still exists server-side. If the project's data was ever
        // wiped (e.g. while resetting test data), a device can be left holding
        // a session for a user row that's gone, which then surfaces later as a
        // cryptic FK error (e.g. "participants_user_id_fkey") instead of a
        // clean "please sign in again". Validate against the server up front.
        const { error } = await supabase.auth.getUser();
        if (error) {
          await supabase.auth.signOut();
          session = null;
        }
      }
      if (!active) return;
      useAuthStore.setState({ session });
      await loadProfileName(session);
      if (active) useAuthStore.setState({ ready: true });
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const prevUid = useAuthStore.getState().session?.user.id;
      useAuthStore.setState({ session });
      // Only refetch the profile when the user actually changes — TOKEN_REFRESHED
      // and other same-user events must not hammer the DB.
      if (session?.user.id !== prevUid) {
        await loadProfileName(session);
      }
    });

    // supabase-js's token auto-refresh runs on a setInterval, which iOS/Android
    // throttle or pause entirely while the app is backgrounded — the session
    // can go quietly stale, and the first request fired right on resume (e.g.
    // a chat message send) can hit the backend with an expired token before
    // the client's had a chance to refresh it. Supabase's own docs call this
    // out explicitly for native apps: start/stop the refresh loop with
    // AppState so it isn't silently starved while backgrounded (saha testi
    // bulgusu — an intermittent "new row violates row-level security policy"
    // on message send that a plain retry always fixed, consistent with a
    // once-off stale-token race rather than a real permission bug).
    if (Platform.OS !== 'web') supabase.auth.startAutoRefresh();

    // Re-read the profile every time the app comes back to the foreground —
    // is_pro (or name/username) may have changed while this device was
    // backgrounded (you flipping it manually, a subscription lapsing, a
    // future RevenueCat webhook) and a single fetch at cold-start would
    // otherwise never notice short of a full app restart.
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (Platform.OS !== 'web') {
        if (state === 'active') supabase.auth.startAutoRefresh();
        else supabase.auth.stopAutoRefresh();
      }
      if (state === 'active' && useAuthStore.getState().session) {
        refreshProfile().catch(() => {});
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
      appStateSub.remove();
    };
  }, []);
}

/**
 * Registers this device for push once signed in + onboarded (covers both a
 * fresh grant right after onboarding and existing users opening the app after
 * this feature shipped), and keeps `profiles.push_token` in sync if Expo
 * rotates the token while the app is running. Call once from the root layout.
 */
export function useSyncPushToken(): void {
  const ready = useAuthStore((s) => s.ready);
  const session = useAuthStore((s) => s.session);
  const name = useAuthStore((s) => s.name);
  const lastSaved = useRef<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !ready || !session || !name || Platform.OS === 'web') return;
    const userId = session.user.id;
    let active = true;

    registerForPushToken().then((token) => {
      if (!active || !token || token === lastSaved.current) return;
      lastSaved.current = token;
      savePushToken(userId, token).catch(() => {});
    });

    const sub = Notifications.addPushTokenListener((event) => {
      const token = event.data;
      if (!token || token === lastSaved.current) return;
      lastSaved.current = token;
      savePushToken(userId, token).catch(() => {});
    });

    return () => {
      active = false;
      sub.remove();
    };
  }, [ready, session, name]);
}

/**
 * Keeps `profiles.locale` in sync with the app's current language — read by
 * the `notify` / `evening-reminder` Edge Functions (docs/PHASE2-SUPABASE.md
 * "Ek N") so push copy matches whatever language this device is showing,
 * not just whatever it was at signup. Fires once the user is signed in +
 * onboarded, and again any time they switch language from Settings.
 */
export function useSyncLocale(): void {
  const ready = useAuthStore((s) => s.ready);
  const session = useAuthStore((s) => s.session);
  const name = useAuthStore((s) => s.name);
  const locale = useI18nStore((s) => s.locale);
  const lastSaved = useRef<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !ready || !session || !name) return;
    if (locale === lastSaved.current) return;
    lastSaved.current = locale;
    saveLocale(session.user.id, locale).catch(() => {});
  }, [ready, session, name, locale]);
}

/* ---------------- actions ---------------- */

async function signInAnonymously(): Promise<void> {
  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
}

/** True when Apple's error is just "the user closed the sheet" — not a real failure. */
function isAppleCancellation(e: unknown): boolean {
  return (e as { code?: string } | null)?.code === 'ERR_REQUEST_CANCELED';
}

/**
 * Real native Apple Sign-In (needs the Push/Sign-In-with-Apple capability +
 * Supabase Apple provider configured — see docs/PHASE2-SUPABASE.md "Ek J").
 * Falls back to the anonymous flow on Android/web or if the capability isn't
 * set up yet, so the rest of the app (onboarding, create, join) stays fully
 * testable without it.
 */
async function signInWithApple(): Promise<void> {
  if (Platform.OS !== 'ios' || !(await AppleAuthentication.isAvailableAsync())) {
    await signInAnonymously();
    return;
  }
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME],
    });
  } catch (e) {
    if (isAppleCancellation(e)) return; // user dismissed the sheet, not an error
    throw e;
  }
  if (!credential.identityToken) throw new Error(getDict().errors.appleIncomplete);
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
  if (error) throw error;
}

/**
 * Upgrades the CURRENT anonymous user to a permanent one by linking an Apple
 * identity — same user id, same challenges/participants rows, just no longer
 * losable if the app is deleted. Needs Supabase Auth's "Allow manual linking"
 * setting on (docs/PHASE2-SUPABASE.md "Ek J").
 */
async function linkAppleIdentity(): Promise<void> {
  if (Platform.OS !== 'ios' || !(await AppleAuthentication.isAvailableAsync())) {
    throw new Error(getDict().errors.appleUnavailable);
  }
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME],
    });
  } catch (e) {
    if (isAppleCancellation(e)) return;
    throw e;
  }
  if (!credential.identityToken) throw new Error(getDict().errors.appleIncomplete);
  const { error } = await supabase.auth.linkIdentity({
    provider: 'apple',
    token: credential.identityToken,
  });
  if (error) throw error;
}

async function saveName(name: string): Promise<void> {
  const session = useAuthStore.getState().session;
  if (!session) return;
  const clean = name.trim();
  const { error } = await supabase
    .from('profiles')
    .update({ name: clean, initials: initialsFrom(clean) })
    .eq('id', session.user.id);
  if (error) throw error;
  useAuthStore.setState({ name: clean });
}

/** True for both the RPC's own 'USERNAME_TAKEN' code and a raw unique-
 * constraint violation from a genuine two-callers-same-instant race
 * (docs/db-username.sql "Ek O" — the RPC checks-then-updates, not atomic). */
function isUsernameTakenError(error: { message?: string; code?: string }): boolean {
  return error.message === 'USERNAME_TAKEN' || error.code === '23505';
}

/**
 * Best-effort auto-handle right after onboarding sets a name — tries
 * `enesseval`, `enesseval2`, ... until one isn't taken. Never throws: a
 * network hiccup or exhausting all candidates just leaves username unset,
 * and the user can pick one later from Settings (Ek O). No-ops if a username
 * already exists — "Onboarding'i tekrar gör" clears `name` but not
 * `username`, and re-submitting the name step must not clobber a handle the
 * user may have since customized in Settings.
 */
async function ensureUsername(name: string): Promise<void> {
  const session = useAuthStore.getState().session;
  if (!session || useAuthStore.getState().username) return;
  const base = slugifyUsername(name);
  for (const candidate of usernameCandidates(base)) {
    const { error } = await supabase.rpc('set_username', { p_username: candidate });
    if (!error) {
      useAuthStore.setState({ username: candidate });
      return;
    }
    if (!isUsernameTakenError(error)) return; // some other failure — give up quietly
  }
}

/** Settings-driven rename — unlike ensureUsername, real errors (invalid
 * format, reserved, taken) are surfaced so the edit sheet can show them. */
async function saveUsername(username: string): Promise<void> {
  const { error } = await supabase.rpc('set_username', { p_username: username });
  if (error) throw error;
  useAuthStore.setState({ username: username.trim().toLowerCase() });
}

async function signOut(): Promise<void> {
  // Clear this device's push token BEFORE signing out — its RLS policy
  // (own-row-only) needs the still-valid session to authorize the delete.
  // A shared/reused device would otherwise keep getting this account's
  // notifications after signing out of it.
  const userId = useAuthStore.getState().session?.user.id;
  if (userId) await clearPushToken(userId).catch(() => {});
  await supabase.auth.signOut();
  useAuthStore.setState({ session: null, name: null, username: null, isPro: false });
}

/**
 * Permanently deletes the account (App Store Review Guideline 5.1.1(v)) via
 * the `delete-account` Edge Function, then clears local session state — the
 * server-side user is already gone at that point, so this just drops the
 * client's own copy of it rather than calling signOut() against a user that
 * no longer exists.
 */
async function deleteAccount(): Promise<void> {
  await deleteAccountRequest();
  useAuthStore.setState({ session: null, name: null, username: null, isPro: false });
}

/**
 * Clears the profile name so the root guard routes back through onboarding —
 * keeps the same (anonymous) user. Handy for re-viewing the flow.
 */
async function resetOnboarding(): Promise<void> {
  const session = useAuthStore.getState().session;
  if (!session) return;
  await supabase
    .from('profiles')
    .update({ name: null, initials: null })
    .eq('id', session.user.id);
  useAuthStore.setState({ name: null });
}

/**
 * DEV-ONLY: flip is_pro on the current profile so the paywall / advanced-stats
 * gating can be exercised before RevenueCat (Faz B) is wired. Guarded by
 * __DEV__ at the (single) call site — never reachable in a release build.
 */
async function setProDev(next: boolean): Promise<void> {
  const session = useAuthStore.getState().session;
  if (!session) return;
  await supabase.from('profiles').update({ is_pro: next }).eq('id', session.user.id);
  useAuthStore.setState({ isPro: next });
}

/** Settings' "show message content in notifications" toggle — optimistic
 * (Settings just flips it back on failure, same as the language switcher). */
async function setMessagePreview(next: boolean): Promise<void> {
  const session = useAuthStore.getState().session;
  if (!session) return;
  useAuthStore.setState({ messagePreview: next });
  await saveMessagePreviewPref(session.user.id, next);
}

/** Auth state + actions for screens. */
export function useAuth() {
  const ready = useAuthStore((s) => s.ready);
  const session = useAuthStore((s) => s.session);
  const name = useAuthStore((s) => s.name);
  const username = useAuthStore((s) => s.username);
  const isPro = useAuthStore((s) => s.isPro);
  const messagePreview = useAuthStore((s) => s.messagePreview);
  return {
    ready,
    session,
    configured: isSupabaseConfigured,
    isSignedIn: !!session,
    isAnonymous: !!session?.user.is_anonymous,
    name,
    username,
    isPro,
    messagePreview,
    needsOnboarding: !!session && !name,
    signInAnonymously,
    signInWithApple,
    linkAppleIdentity,
    saveName,
    ensureUsername,
    saveUsername,
    signOut,
    deleteAccount,
    resetOnboarding,
    setProDev,
    setMessagePreview,
  };
}
