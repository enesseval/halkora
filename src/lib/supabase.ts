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

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // RN has no URL-based session; disable web-only detection.
    detectSessionInUrl: false,
  },
});
