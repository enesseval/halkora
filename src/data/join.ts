import { supabase } from '@/lib/supabase';

export interface ChallengePreview {
  id: string;
  title: string;
  dailyAction: string;
  totalDays: number;
  startDate: string;
  status: string;
  stakeText?: string;
  participantCount: number;
  sampleNames: string[];
  /** Ek M — kurucu daveti "yalnızca ilk gün" ile sınırlamışsa ve o gün geçtiyse true. */
  joinClosed: boolean;
}

interface PreviewRow {
  id: string;
  title: string;
  daily_action: string;
  total_days: number;
  start_date: string;
  status: string;
  stake_text: string | null;
  participant_count: number;
  sample_names: string[] | null;
  join_closed: boolean;
}

/** Public preview by invite code — works even before the viewer has joined. */
export async function fetchChallengePreview(code: string): Promise<ChallengePreview | null> {
  const { data, error } = await supabase.rpc('get_challenge_preview', { p_code: code });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as PreviewRow | undefined;
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    dailyAction: row.daily_action,
    totalDays: row.total_days,
    startDate: row.start_date,
    status: row.status,
    stakeText: row.stake_text ?? undefined,
    participantCount: row.participant_count ?? 0,
    sampleNames: row.sample_names ?? [],
    joinClosed: row.join_closed,
  };
}

/**
 * Am I already in this ring?
 *
 * Reads my OWN participant row and nothing else — `fetchMyChallenges` opens
 * with the same query, so RLS is known to allow it. A non-member simply gets
 * an empty result, which is exactly the answer we want, so one query answers
 * both directions without needing to see anyone else's row.
 */
export async function amIParticipant(challengeId: string): Promise<boolean> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return false;
  const { data, error } = await supabase
    .from('participants')
    .select('id')
    .eq('challenge_id', challengeId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

/**
 * Adds the current user as a participant. Returns the challenge id.
 *
 * `systemText` is the "… halkaya katıldı." line the group sees in chat,
 * composed by the caller for the same reason leave_challenge's is: the
 * database cannot reach the dictionaries. Always sent — `null` rather than
 * omitted, so PostgREST (which picks an overload by the parameter names in
 * the body) can only ever resolve to the two-argument function.
 */
export async function joinChallengeByCode(code: string, systemText?: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_challenge_by_code', {
    p_code: code,
    p_system_text: systemText ?? null,
  });
  if (error) throw error;
  return data as string;
}
