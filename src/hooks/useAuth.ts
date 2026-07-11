import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { create } from 'zustand';
import * as Notifications from 'expo-notifications';
import * as AppleAuthentication from 'expo-apple-authentication';
import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { registerForPushToken } from '@/lib/push';
import { savePushToken, clearPushToken, deleteAccount as deleteAccountRequest } from '@/data/profile';

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
}

const useAuthStore = create<AuthState>(() => ({
  ready: false,
  session: null,
  name: null,
}));

async function loadProfileName(session: Session | null): Promise<void> {
  if (!session) {
    useAuthStore.setState({ name: null });
    return;
  }
  const { data } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', session.user.id)
    .maybeSingle();
  useAuthStore.setState({ name: data?.name ?? null });
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

    return () => {
      active = false;
      sub.subscription.unsubscribe();
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
  if (!credential.identityToken) throw new Error('Apple girişi tamamlanamadı.');
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
    throw new Error('Apple ile giriş bu cihazda kullanılamıyor.');
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
  if (!credential.identityToken) throw new Error('Apple girişi tamamlanamadı.');
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

async function signOut(): Promise<void> {
  // Clear this device's push token BEFORE signing out — its RLS policy
  // (own-row-only) needs the still-valid session to authorize the delete.
  // A shared/reused device would otherwise keep getting this account's
  // notifications after signing out of it.
  const userId = useAuthStore.getState().session?.user.id;
  if (userId) await clearPushToken(userId).catch(() => {});
  await supabase.auth.signOut();
  useAuthStore.setState({ session: null, name: null });
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
  useAuthStore.setState({ session: null, name: null });
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

/** Auth state + actions for screens. */
export function useAuth() {
  const ready = useAuthStore((s) => s.ready);
  const session = useAuthStore((s) => s.session);
  const name = useAuthStore((s) => s.name);
  return {
    ready,
    session,
    configured: isSupabaseConfigured,
    isSignedIn: !!session,
    isAnonymous: !!session?.user.is_anonymous,
    name,
    needsOnboarding: !!session && !name,
    signInAnonymously,
    signInWithApple,
    linkAppleIdentity,
    saveName,
    signOut,
    deleteAccount,
    resetOnboarding,
  };
}
