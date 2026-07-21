import { supabase } from '@/lib/supabase';
import { edgeFunctionError } from '@/lib/errors';

/**
 * Writes this device's Expo push token to its own row in `push_tokens` — a
 * separate, owner-only-readable table (docs/PHASE2-SUPABASE.md "Ek I"). NOT
 * on `profiles`: the co-participant read policy there (Ek E) grants whole-row
 * access, which would let anyone sharing a challenge with you read your token.
 */
export async function savePushToken(userId: string, token: string): Promise<void> {
  const { error } = await supabase
    .from('push_tokens')
    .upsert({ user_id: userId, token, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/** Clears this user's push token on sign-out so a shared/reused device stops
 * receiving notifications for an account nobody's signed into anymore. */
export async function clearPushToken(userId: string): Promise<void> {
  const { error } = await supabase.from('push_tokens').delete().eq('user_id', userId);
  if (error) throw error;
}

/**
 * Persists the user's chosen app language so server-side copy (push
 * notification bodies — docs/PHASE2-SUPABASE.md "Ek N") can match it too.
 * Best-effort from the caller's side — the in-app language switch itself
 * never depends on this succeeding.
 */
export async function saveLocale(userId: string, locale: string): Promise<void> {
  const { error } = await supabase.from('profiles').update({ locale }).eq('id', userId);
  if (error) throw error;
}

/**
 * Whether push notifications for chat messages show the real text or just
 * "X sent a message" — Settings' own toggle (docs/db-nudge-and-message-notify.sql).
 * Read server-side by the `notify` Edge Function per-recipient; this is the
 * client's only write path to it.
 */
export async function saveMessagePreviewPref(userId: string, preview: boolean): Promise<void> {
  const { error } = await supabase.from('profiles').update({ notify_message_preview: preview }).eq('id', userId);
  if (error) throw error;
}

/**
 * Permanently deletes the signed-in user's account (App Store Review
 * Guideline 5.1.1(v) — required whenever account creation exists). Runs
 * server-side under the `delete-account` Edge Function so it can call the
 * admin API; see docs/PHASE2-SUPABASE.md "Ek L" for what it removes/keeps.
 */
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.functions.invoke('delete-account');
  if (error) throw await edgeFunctionError(error);
}
