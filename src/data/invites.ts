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

export interface PendingInvite {
  id: string;
  username: string;
  name: string | null;
}

/**
 * Who has been invited to this ring and hasn't joined.
 *
 * Reads `invites` directly rather than through an RPC: the policy added in
 * docs/db-pending-invites.md lets a ring's members read that ring's invites,
 * so RLS is the whole filter and there is nothing for a function to do. A
 * caller who isn't a member simply gets an empty list.
 *
 * Rows for people who have since joined are dropped here rather than in SQL —
 * the invite row is kept on purpose (it is the record of who asked whom), and
 * the participants list needed for the comparison is already on screen.
 *
 * Two queries rather than one embedded select, because `invites.to_user`
 * references auth.users and not profiles — there is no foreign key for
 * PostgREST to follow, so `profiles(...)` inside the select would fail rather
 * than join.
 */
export async function fetchPendingInvites(
  challengeId: string,
  joinedUserIds: string[],
): Promise<PendingInvite[]> {
  const { data, error } = await supabase
    .from('invites')
    .select('id, to_user')
    .eq('challenge_id', challengeId);
  if (error) throw error;

  const joined = new Set(joinedUserIds);
  const rows = (data ?? []).filter((r) => !joined.has(r.to_user as string));
  if (rows.length === 0) return [];

  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, username, name')
    .in(
      'id',
      rows.map((r) => r.to_user as string),
    );
  if (pErr) throw pErr;

  const byId = new Map(
    (profiles ?? []).map((p) => [p.id as string, p as { username: string | null; name: string | null }]),
  );
  return rows
    .map((r) => {
      const p = byId.get(r.to_user as string);
      return { id: r.id as string, username: p?.username ?? '', name: p?.name ?? null };
    })
    // No username means the profile isn't readable from here; a row with
    // nothing to show is worse than no row.
    .filter((r) => !!r.username);
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
export async function sendInvite(
  challengeId: string,
  toUserId: string,
  /** 'rematch' gives the push a different headline — the recipient already
   * knows this group (docs/db-stake-v2.sql §4, notify's invites branch). */
  kind: 'invite' | 'rematch' = 'invite',
): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) throw new Error(getDict().errors.sessionMissing);
  const { error } = await supabase
    .from('invites')
    .insert({ challenge_id: challengeId, from_user: user.id, to_user: toUserId, kind });
  if (error) throw error;
}

export interface ReceivedInvite {
  id: string;
  challengeId: string;
  inviteCode: string;
  title: string;
  dailyAction: string;
  totalDays: number;
  fromName: string;
  kind: 'invite' | 'rematch';
}

/**
 * Invites waiting for this device's user (docs/db-invites-inbox.sql).
 *
 * Until this existed the table was write-only: nothing read it, and nothing
 * could — the recipient had no SELECT policy, and showing the ring's name
 * needs `challenges`, which RLS blocks for someone who hasn't joined yet. So
 * the push was the only channel, and a push that never arrives or gets
 * swiped away took the invite with it (saha testi bulgusu: "sessizce
 * kayboluyor, erişemiyorum").
 *
 * The RPC drops invites to rings that ended and to rings you've already
 * joined, so what comes back is only what you can still act on.
 */
export async function fetchReceivedInvites(): Promise<ReceivedInvite[]> {
  const { data, error } = await supabase.rpc('my_invites');
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    challengeId: r.challenge_id as string,
    inviteCode: r.invite_code as string,
    title: (r.title as string) ?? '',
    dailyAction: (r.daily_action as string) ?? '',
    totalDays: (r.total_days as number) ?? 0,
    fromName: (r.from_name as string) || getDict().common.person,
    kind: (r.kind as 'invite' | 'rematch') ?? 'invite',
  }));
}

/** Turns down an invite. Only the recipient can, and it only removes the
 * invite — nothing about the ring changes. */
export async function dismissInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.from('invites').delete().eq('id', inviteId);
  if (error) throw error;
}
