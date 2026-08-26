import { supabase } from '@/lib/supabase';
import { edgeFunctionError } from '@/lib/errors';
import { getDict } from '@/i18n';

export type CheckInType = 'done' | 'joker';

async function myParticipantId(challengeId: string, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('participants')
    .select('id')
    .eq('challenge_id', challengeId)
    .eq('user_id', userId)
    .single();
  if (error) throw error;
  return data.id as string;
}

/**
 * Real check-in write. The day_number is computed and validated
 * SERVER-SIDE by the `check-in` Edge Function (supabase/functions/check-in) —
 * never trusted from the client. See docs/PHASE2-SUPABASE.md "Ek F".
 */
export async function insertCheckIn(
  challengeId: string,
  type: CheckInType = 'done',
  /** Jokers only: which past day to repair. Omitted means yesterday. The
   * server still validates that it is a real, past, uncovered day. */
  dayNumber?: number,
): Promise<{ dayNumber: number }> {
  const { data, error } = await supabase.functions.invoke('check-in', {
    body: { challenge_id: challengeId, type, day_number: dayNumber },
  });
  if (error) throw await edgeFunctionError(error);
  return { dayNumber: (data as { day_number: number }).day_number };
}

/** Undo — removes the check-in this device just added (own row only, RLS-scoped). */
export async function deleteCheckIn(challengeId: string, dayNumber: number): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) throw new Error(getDict().errors.sessionMissing);
  const participantId = await myParticipantId(challengeId, user.id);

  const { error } = await supabase
    .from('check_ins')
    .delete()
    .eq('participant_id', participantId)
    .eq('day_number', dayNumber)
    // Undo belongs to the check-in button, and that button only ever writes a
    // 'done'. Without this the same call would happily remove a joker sitting
    // on that day — spending a joker is not something a stray undo should be
    // able to take back.
    .eq('type', 'done');
  if (error) throw error;
}
