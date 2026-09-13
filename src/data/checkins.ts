import { supabase } from '@/lib/supabase';
import { edgeFunctionError } from '@/lib/errors';

export type CheckInType = 'done' | 'joker';

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

/**
 * Undo — removes the check-in this device just added.
 *
 * ONE request. It used to look up `myParticipantId` first and then delete by
 * that id: two round trips, and offline both of them run all the way to the
 * 12s ceiling before the failure surfaces, so the error landed long after the
 * animation had finished and the button had already settled (saha testi
 * bulgusu — "geri alıyor, birkaç saniye sonra bağlantını kontrol et diyor").
 *
 * The lookup was never doing any work the database wasn't already doing:
 * check_ins' "delete own check-in" policy is
 * `exists (select 1 from participants p where p.id = participant_id and
 * p.user_id = auth.uid())`, so filtering on the ring and the day can only
 * ever reach this device's own row.
 */
export async function deleteCheckIn(challengeId: string, dayNumber: number): Promise<void> {
  const { error } = await supabase
    .from('check_ins')
    .delete()
    .eq('challenge_id', challengeId)
    .eq('day_number', dayNumber)
    // Undo belongs to the check-in button, and that button only ever writes a
    // 'done'. Without this the same call would happily remove a joker sitting
    // on that day — spending a joker is not something a stray undo should be
    // able to take back.
    .eq('type', 'done');
  if (error) throw error;
}
