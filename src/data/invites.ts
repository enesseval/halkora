import { supabase } from '@/lib/supabase';
import { getDict } from '@/i18n';

export interface UsernameLookup {
  id: string;
  name: string | null;
  initials: string | null;
  username: string;
}

interface UsernameLookupRow {
  id: string;
  name: string | null;
  initials: string | null;
  username: string;
}

/** Exact-match handle lookup (docs/db-username.sql "Ek O") — null when no
 * user has that exact username. Never a prefix/partial search. */
export async function findUserByUsername(username: string): Promise<UsernameLookup | null> {
  const { data, error } = await supabase.rpc('find_user_by_username', { p_username: username });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as UsernameLookupRow | undefined;
  return row ?? null;
}

/** True when the DB rejected the insert because this exact (challenge,
 * recipient) invite already exists (unique constraint, docs/db-invites.sql). */
export function isDuplicateInviteError(e: unknown): boolean {
  return !!e && typeof e === 'object' && (e as { code?: string }).code === '23505';
}

/** Sends an invite to an already-resolved user id. RLS (docs/db-invites.sql)
 * requires the caller to already be a member of `challengeId`. */
export async function sendInvite(challengeId: string, toUserId: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) throw new Error(getDict().errors.sessionMissing);
  const { error } = await supabase
    .from('invites')
    .insert({ challenge_id: challengeId, from_user: user.id, to_user: toUserId });
  if (error) throw error;
}
