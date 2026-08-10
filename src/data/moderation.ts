import { supabase } from '@/lib/supabase';
import { getDict } from '@/i18n';

/**
 * Blocking and reporting — App Store Guideline 1.2, which requires an app
 * carrying user-generated content to offer filtering, reporting, blocking and
 * a way to act on reports.
 *
 * All of it is enforced in the database, not here. Blocking hides content
 * through an RLS policy on `messages` and `nudges`, so a blocked person's
 * messages never reach this device at all and there is nothing for a client
 * to forget to filter. The content filter is a BEFORE INSERT trigger, so it
 * applies to old app builds too.
 */

export type ReportReason = 'spam' | 'harassment' | 'hate' | 'sexual' | 'violence' | 'other';

async function requireUser(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const id = session?.user?.id;
  if (!id) throw new Error(getDict().errors.sessionMissing);
  return id;
}

/** Hides their content from me and mine from them, both ways. */
export async function blockUser(userId: string): Promise<void> {
  const me = await requireUser();
  const { error } = await supabase
    .from('blocked_users')
    .insert({ blocker_id: me, blocked_id: userId });
  // 23505 = already blocked. The outcome the caller wanted is already true.
  if (error && error.code !== '23505') throw error;
}

export async function unblockUser(userId: string): Promise<void> {
  const me = await requireUser();
  const { error } = await supabase
    .from('blocked_users')
    .delete()
    .eq('blocker_id', me)
    .eq('blocked_id', userId);
  if (error) throw error;
}

export interface BlockedPerson {
  userId: string;
  name: string;
  username: string | null;
}

/** Everyone I've blocked, for the Settings list that lets me undo it. */
export async function fetchBlocked(): Promise<BlockedPerson[]> {
  const me = await requireUser();
  const { data, error } = await supabase
    .from('blocked_users')
    .select('blocked_id')
    .eq('blocker_id', me)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const ids = (data ?? []).map((r) => r.blocked_id as string);
  if (ids.length === 0) return [];

  // Blocking doesn't hide profiles, only messages — otherwise this list would
  // be a column of "unknown person" rows with no way to tell them apart.
  const { data: profs } = await supabase
    .from('profiles')
    .select('id, name, username')
    .in('id', ids);

  const byId = new Map((profs ?? []).map((p) => [p.id as string, p]));
  return ids.map((id) => {
    const p = byId.get(id);
    return {
      userId: id,
      name: (p?.name as string) ?? getDict().common.person,
      username: (p?.username as string) ?? null,
    };
  });
}

/**
 * Files a report. The message text is copied into the report on purpose: the
 * message can be deleted or the account removed, and a report with no
 * evidence left in it can't be reviewed.
 */
export async function reportMessage(input: {
  messageId: string;
  reportedUserId: string;
  challengeId: string;
  messageText: string;
  reason: ReportReason;
}): Promise<void> {
  const me = await requireUser();
  const { error } = await supabase.from('reports').insert({
    reporter_id: me,
    reported_user_id: input.reportedUserId,
    message_id: input.messageId,
    challenge_id: input.challengeId,
    message_text: input.messageText,
    reason: input.reason,
  });
  if (error) throw error;

  // Tell the moderator inbox. Deliberately not awaited into failure: the
  // report is already stored, and a mail outage must not make the person
  // think their report was lost.
  supabase.functions.invoke('report-alert', { body: { reporter: me } }).catch(() => {});
}
