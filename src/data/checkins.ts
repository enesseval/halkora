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

/** Insert today's (or a given) check-in. Unique(participant_id, day_number) enforces one per day. */
export async function insertCheckIn(
  challengeId: string,
  dayNumber: number,
  type: CheckInType = 'done',
): Promise<void> {
  // day_number must be a real day of the challenge — belt-and-suspenders
  // against upcoming challenges (currentDay < 1) or a stale caller.
  if (dayNumber < 1) throw new Error('Bu challenge henüz başlamadı.');
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Oturum bulunamadı.');
  const participantId = await myParticipantId(challengeId, user.id);

  const { error } = await supabase
    .from('check_ins')
    .insert({ participant_id: participantId, challenge_id: challengeId, day_number: dayNumber, type });
  if (error) throw error;
}

/** Undo (within the mock 5-minute window the UI already enforces via long-press). */
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
