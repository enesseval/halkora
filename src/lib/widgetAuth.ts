import { Platform } from 'react-native';
import { ExtensionStorage } from '@bacons/apple-targets';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

const APP_GROUP = 'group.com.halkora.app.widget';
const storage = Platform.OS === 'ios' ? new ExtensionStorage(APP_GROUP) : null;

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * Mirrors the current Supabase session into the shared App Group so the
 * widget's CheckInIntent (targets/widget/HalkoraWidget.swift) can call the
 * `check-in` Edge Function directly, authenticated, without the app open —
 * a WidgetKit extension is its own process and never sees supabase-js's
 * in-memory session otherwise. Call on every auth state change (sign-in,
 * sign-out, TOKEN_REFRESHED) and once on cold start.
 */
export function syncWidgetSession(session: Session | null): void {
  if (!storage) return;
  try {
    if (!session) {
      storage.remove('accessToken');
      storage.remove('refreshToken');
      storage.remove('expiresAt');
      return;
    }
    storage.set('supabaseUrl', SUPABASE_URL);
    storage.set('supabaseAnonKey', SUPABASE_ANON_KEY);
    storage.set('accessToken', session.access_token);
    storage.set('refreshToken', session.refresh_token);
    storage.set('expiresAt', session.expires_at ?? 0);
  } catch {
    // best-effort — widget auth is a nice-to-have side channel
  }
}

/**
 * The widget may have refreshed the session on its own while the app wasn't
 * open (CheckInIntent's performCheckIn refreshes an expired token before
 * checking in). Supabase ROTATES refresh tokens on use, so if this app's own
 * supabase-js client later tries to auto-refresh with its now-stale
 * in-memory refresh token, that refresh fails and silently signs the user
 * out. Call this on every foreground resume, before anything else touches
 * auth: if the shared access token differs from the app's current one,
 * adopt it as the source of truth.
 */
export async function reconcileWidgetSession(): Promise<void> {
  if (!storage) return;
  try {
    const sharedAccessToken = storage.get('accessToken');
    const sharedRefreshToken = storage.get('refreshToken');
    if (!sharedAccessToken || !sharedRefreshToken) return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token === sharedAccessToken) return; // already in sync
    await supabase.auth.setSession({
      access_token: sharedAccessToken,
      refresh_token: sharedRefreshToken,
    });
  } catch {
    // best-effort — worst case the app's own auto-refresh eventually
    // recovers, or the user is prompted to sign in again like any other
    // expired-session path
  }
}
