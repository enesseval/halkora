import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

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

/** Pull the real `{ error }` JSON body out of a failed Edge Function call. */
async function edgeFunctionError(e: unknown): Promise<Error> {
  if (e instanceof FunctionsHttpError) {
    try {
      const body = await e.context.json();
      if (body?.error) return new Error(body.error as string);
    } catch {
      // fall through to the generic message below
    }
  }
  return e instanceof Error ? e : new Error(String(e));
}

/**
 * Real check-in write. The day_number is computed and validated
 * SERVER-SIDE by the `check-in` Edge Function (supabase/functions/check-in) —
 * never trusted from the client. See docs/PHASE2-SUPABASE.md "Ek F".
 */
export async function insertCheckIn(
  challengeId: string,
  type: CheckInType = 'done',
): Promise<{ dayNumber: number }> {
  const { data, error } = await supabase.functions.invoke('check-in', {
    body: { challenge_id: challengeId, type },
  });
  if (error) throw await edgeFunctionError(error);
  return { dayNumber: (data as { day_number: number }).day_number };
}

/** Undo — removes the check-in this device just added (own row only, RLS-scoped). */
export async function deleteCheckIn(challengeId: string, dayNumber: number): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Oturum bulunamadı.');
  const participantId = await myParticipantId(challengeId, user.id);

  const { error } = await supabase
    .from('check_ins')
    .delete()
    .eq('participant_id', participantId)
    .eq('day_number', dayNumber);
  if (error) throw error;
}
