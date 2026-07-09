import { useEffect } from 'react';
import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

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
      useAuthStore.setState({ session: data.session });
      await loadProfileName(data.session);
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

/* ---------------- actions ---------------- */

async function signInAnonymously(): Promise<void> {
  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
}

/**
 * Placeholder: native "Sign in with Apple" needs a dev build (see
 * docs/PHASE2-SUPABASE.md §8). Until then we sign in anonymously so the rest
 * of the flow (onboarding, create, join) is fully testable in Expo Go.
 */
async function signInWithApple(): Promise<void> {
  await signInAnonymously();
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
  await supabase.auth.signOut();
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
    name,
    needsOnboarding: !!session && !name,
    signInAnonymously,
    signInWithApple,
    saveName,
    signOut,
    resetOnboarding,
  };
}
