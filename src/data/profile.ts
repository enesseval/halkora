import { supabase } from '@/lib/supabase';

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
