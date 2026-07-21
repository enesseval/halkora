import { supabase } from '@/lib/supabase';
import type { Message } from '@/data/types';
import { getDict } from '@/i18n';

interface MessageRow {
  id: string;
  user_id: string;
  day_number: number;
  kind: 'message' | 'system';
  text: string;
  created_at: string;
}

/** Messages + reaction counts for one challenge, newest last. */
export async function fetchMessages(challengeId: string): Promise<Message[]> {
  // getSession() (local, no network) instead of getUser() (network round-trip
  // every call) — this runs on every 4s poll, and a slow/flaky getUser() call
  // used to make "mine" detection unreliable and slowed the whole poll down.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;

  const { data: msgs, error } = await supabase
    .from('messages')
    .select('id, user_id, day_number, kind, text, created_at')
    .eq('challenge_id', challengeId)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const rows = (msgs ?? []) as MessageRow[];
  if (rows.length === 0) return [];

  const ids = rows.map((m) => m.id);
  const userIds = Array.from(new Set(rows.map((m) => m.user_id)));

  const [{ data: reactions }, { data: profs }] = await Promise.all([
    supabase.from('message_reactions').select('message_id, emoji').in('message_id', ids),
    supabase.from('profiles').select('id, name').in('id', userIds),
  ]);

  const nameById = new Map((profs ?? []).map((p) => [p.id as string, (p.name as string) ?? getDict().common.person]));
  const countsByMsg = new Map<string, Map<string, number>>();
  for (const r of (reactions ?? []) as { message_id: string; emoji: string }[]) {
    const inner = countsByMsg.get(r.message_id) ?? new Map<string, number>();
    inner.set(r.emoji, (inner.get(r.emoji) ?? 0) + 1);
    countsByMsg.set(r.message_id, inner);
  }

  return rows.map((m) => ({
    id: m.id,
    kind: m.kind,
    authorId: m.user_id,
    authorName: nameById.get(m.user_id) ?? getDict().common.person,
    text: m.text,
    dayNumber: m.day_number,
    reactions: Array.from(countsByMsg.get(m.id) ?? new Map()).map(([emoji, count]) => ({ emoji, count })),
    mine: m.user_id === user?.id,
  }));
}

export async function insertMessage(challengeId: string, dayNumber: number, text: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) throw new Error(getDict().errors.sessionMissing);
  const { error } = await supabase
    .from('messages')
    .insert({ challenge_id: challengeId, user_id: user.id, day_number: dayNumber, kind: 'message', text });
  if (error) throw error;
}

/**
 * A 'system' event visible to the whole group (a nudge, a challenge-details
 * change) — same table/RLS as a real message, just a different `kind` so
 * the chat UI renders it as a centered plain-text line instead of a bubble
 * (src/components/Chat.tsx).
 *
 * `notifyOthers` controls whether this ALSO pushes to the other participants
 * (supabase/functions/notify's `messages` branch checks this column) —
 * default true (a details change is worth a push), but a nudge's own system
 * message passes false since the nudge already sent its own targeted push
 * via the `nudges` table; without this it'd double-notify the recipient for
 * one nudge.
 */
export async function insertSystemMessage(
  challengeId: string,
  dayNumber: number,
  text: string,
  notifyOthers = true,
): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) throw new Error(getDict().errors.sessionMissing);
  const { error } = await supabase
    .from('messages')
    .insert({
      challenge_id: challengeId,
      user_id: user.id,
      day_number: dayNumber,
      kind: 'system',
      text,
      notify_others: notifyOthers,
    });
  if (error) throw error;
}

export async function insertReaction(messageId: string, emoji: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) throw new Error(getDict().errors.sessionMissing);
  const { error } = await supabase
    .from('message_reactions')
    .insert({ message_id: messageId, user_id: user.id, emoji });
  // 23505 = unique violation (already reacted with this emoji) — not an error the user needs to see.
  if (error && error.code !== '23505') throw error;
}

export async function insertNudge(challengeId: string, toUserId: string, message?: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) throw new Error(getDict().errors.sessionMissing);
  const { error } = await supabase
    .from('nudges')
    .insert({ challenge_id: challengeId, from_user: user.id, to_user: toUserId, message });
  // 23505 = unique violation — the DB's own "one nudge per person per day"
  // limit (docs/PHASE2-SUPABASE.md "Ek K") already tripped; not a real error,
  // the UI already shows the nudge as sent.
  if (error && error.code !== '23505') throw error;
}
