import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'halkora.pendingInviteCode';

/**
 * A deep link to /join/{code} that arrives while the visitor is signed out or
 * mid-onboarding can't be honored immediately — the root guard (app/_layout.tsx)
 * redirects to /welcome or /onboarding first, which would otherwise drop the
 * code on the floor. Stash it here and resume once auth/onboarding finishes.
 */
export async function stashPendingInviteCode(code: string): Promise<void> {
  await AsyncStorage.setItem(KEY, code);
}

/** Reads + clears the stashed code in one go — it's meant to be consumed once. */
export async function takePendingInviteCode(): Promise<string | null> {
  const code = await AsyncStorage.getItem(KEY);
  if (code) await AsyncStorage.removeItem(KEY);
  return code;
}
