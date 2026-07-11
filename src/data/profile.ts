import { supabase } from '@/lib/supabase';

/** Writes this device's Expo push token to the signed-in user's profile row. */
export async function savePushToken(userId: string, token: string): Promise<void> {
  const { error } = await supabase.from('profiles').update({ push_token: token }).eq('id', userId);
  if (error) throw error;
}
