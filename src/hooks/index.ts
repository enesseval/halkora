/**
 * DATA-ACCESS LAYER (Phase 1 = zustand mock).
 *
 * Screens import ONLY from here — never from '@/stores/*' or '@/data/*'.
 * In Phase 2 the internals swap to TanStack Query + Supabase while these
 * hook signatures stay identical (optimistic check-in etc.).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMockStore, CreateChallengeInput } from '@/stores/mockStore';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  insertChallenge,
  fetchMyChallenges,
  restartChallenge,
  endChallengeEarly,
  updateChallengeDetails,
} from '@/data/challenges';
import { insertCheckIn, deleteCheckIn } from '@/data/checkins';
import { fetchChallengePreview, joinChallengeByCode } from '@/data/join';
import { fetchMessages, insertMessage, insertReaction, insertNudge } from '@/data/chat';
import { errMessage, isErrorCode } from '@/lib/errors';
import { router } from 'expo-router';
import { FAST_DAYS } from '@/lib/fastDays';
import {
  ME_ID,
  ME_NAME,
  ME_INITIALS,
  getTemplates,
  getStakePresets,
  REACTION_EMOJIS,
  getInviteJoiners,
} from '@/data/mock';
import { formatLongDate, waitingNames } from '@/lib/day';
import { firstName } from '@/stores/mockStore';
import { Challenge, Participant } from '@/data/types';
import { useT } from '@/i18n';

// Re-export types + static config so screens have a single import source.
export type { Challenge, Participant, Message, Stake, StakeOption, SegmentState, Momentum } from '@/data/types';
export type { CreateChallengeInput };
export {
  ME_ID,
  ME_NAME,
  ME_INITIALS,
  getTemplates as TEMPLATES,
  getStakePresets as STAKE_PRESETS,
  REACTION_EMOJIS,
  getInviteJoiners as INVITE_JOINERS,
};

/** Single challenge by id (undefined if not found). */
export function useChallenge(id: string | undefined): Challenge | undefined {
  return useMockStore((s) => s.challenges.find((c) => c.id === id));
}

/** Query key for the current user's challenge list. */
export const MY_CHALLENGES_KEY = ['challenges', 'mine'] as const;

/**
 * Shared fetch of "my challenges". Every screen that needs real data (Home,
 * Detail, Invite, Complete) calls this — react-query dedupes by queryKey, so
 * mounting it from several screens at once is safe/cheap, and it means the
 * fetch starts the moment ANY of them mounts (e.g. a deep link straight into
 * Detail, with Home never mounted this session).
 *
 * Distinguishes three states so a screen never has to guess:
 *  - `loading`: first fetch in flight, nothing to show yet.
 *  - `firstLoadError`: it failed and we have never seen real data — show a
 *    real error, never mock/stale data pretending to be current.
 *  - `backgroundError`: it failed but we already have last-known-good data
 *    (a poll or pull-to-refresh went offline) — keep showing what we have,
 *    the caller decides how to mention it (e.g. a one-off Alert).
 */
export function useChallengesQuery() {
  const setChallenges = useMockStore((s) => s.setChallenges);
  const everHadData = useRef(false);
  useRealtimeMyChallenges();

  const query = useQuery({
    queryKey: MY_CHALLENGES_KEY,
    queryFn: fetchMyChallenges,
    enabled: isSupabaseConfigured,
    // Pure reconciliation safety net now that useRealtimeMyChallenges pushes
    // updates the instant anyone check-ins/joins/leaves — this only matters
    // if the websocket silently drops (network switch, background/foreground)
    // or Ek D's publication step isn't actually enabled. 60s is fine for
    // "catch up eventually"; it's not the primary way data gets fresh anymore.
    // In FAST_DAYS test mode a "day" is 60s, so a 60s poll can lag a whole
    // day — tighten it so day rollovers show up on screen as they happen.
    refetchInterval: isSupabaseConfigured ? (FAST_DAYS ? 10_000 : 60_000) : false,
  });

  useEffect(() => {
    if (isSupabaseConfigured && query.data) {
      everHadData.current = true;
      const current = useMockStore.getState().challenges;
      const byId = new Map(query.data.map((c) => [c.id, c]));
      // Nothing removes a challenge from "my list" (no leave/delete feature)
      // — a poll/refetch should only ever add to or update it, never shrink
      // it. A stale/out-of-order response racing with another concurrent
      // fetch (e.g. a poll whose DB snapshot predates something that just
      // committed) could otherwise wipe an already-loaded challenge off
      // Home/Detail for a cycle even though nothing actually changed.
      const currentIds = new Set(current.map((c) => c.id));
      // fetchMyChallenges never fetches chat messages (that's the separate
      // useChallengeMessages poll) — its rows always carry `messages: []`.
      // Applying it wholesale would stomp whatever the chat poll had just
      // populated back to empty every 5s, which is exactly what made a
      // just-sent message flash and then vanish for BOTH sides of the chat.
      const refreshed = current.map((c) => {
        const fresh = byId.get(c.id);
        return fresh ? { ...fresh, messages: c.messages } : c;
      });
      const brandNew = query.data.filter((c) => !currentIds.has(c.id));
      setChallenges([...refreshed, ...brandNew]);
    }
  }, [query.data, setChallenges]);

  return {
    loading: isSupabaseConfigured && query.isLoading,
    firstLoadError: isSupabaseConfigured && query.isError && !everHadData.current,
    backgroundError: isSupabaseConfigured && query.isError && everHadData.current,
    error: query.error,
    refetch: query.refetch,
  };
}

/** Home aggregation: date header + the three card buckets. */
export function useTodayStatus() {
  const challenges = useMockStore((s) => s.challenges);
  const { loading, firstLoadError, backgroundError, error, refetch } = useChallengesQuery();

  const buckets = useMemo(() => {
    const active = challenges.filter((c) => c.status === 'active');
    const pending = active.filter((c) => !c.meCheckedInToday);
    const done = active.filter((c) => c.meCheckedInToday);
    const upcoming = challenges.filter((c) => c.status === 'upcoming');
    return { pending, done, upcoming };
  }, [challenges]);

  return {
    dateLabel: formatLongDate(new Date()),
    ...buckets,
    loading,
    firstLoadError,
    backgroundError,
    error,
    retry: refetch,
  };
}

/**
 * Pull-to-refresh for Home + Detail. There's no realtime subscription yet
 * (Faz 2 checklist §7), so this is the interim way to see other people's
 * check-ins / new joiners without leaving and re-entering the screen.
 */
export function useRefreshChallenges() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    if (!isSupabaseConfigured) return;
    setRefreshing(true);
    try {
      await queryClient.refetchQueries({ queryKey: MY_CHALLENGES_KEY });
    } finally {
      setRefreshing(false);
    }
  };

  return { refreshing, refresh };
}

/** Archived / completed challenges (drives Home's "history" section + E9
 * entry from Settings). Reads the raw array and filters in a useMemo rather
 * than inside the Zustand selector — a selector that returns `.filter(...)`
 * directly hands back a brand-new array reference on every single read,
 * which useSyncExternalStore sees as "changed" and re-renders for, which
 * calls the selector again, forever (infinite render loop / "Maximum update
 * depth exceeded" — same pattern useTodayStatus above already avoids). */
export function useCompletedChallenges(): Challenge[] {
  const challenges = useMockStore((s) => s.challenges);
  return useMemo(() => challenges.filter((c) => c.status === 'completed'), [challenges]);
}

/** Preview lookup by invite code (E5 deep-link welcome) — Phase 1 mock only. */
export function useChallengeByCode(code: string | undefined): Challenge | undefined {
  return useMockStore((s) => s.challenges.find((c) => c.inviteCode === code));
}

export interface JoinPreview {
  loading: boolean;
  /** The RPC succeeded and genuinely found no such invite — never true on a network/server error. */
  notFound: boolean;
  /** A real fetch failure (network/RLS/etc.) — distinct from notFound so the screen never
   * tells someone their invite doesn't exist just because a request blipped. */
  isError: boolean;
  error?: unknown;
  retry: () => void;
  title: string;
  totalDays: number;
  scheduleSummary: string;
  startsWhen: string;
  stakeText?: string;
  participants: { id: string; initials: string; name: string }[];
  /** Ek M — kurucu daveti "yalnızca ilk gün" ile sınırlamışsa ve o gün geçtiyse true. */
  joinClosed: boolean;
}

/**
 * Join-screen (E5) preview by invite code. Works for a code the viewer hasn't
 * joined yet: Supabase path uses the `get_challenge_preview` RPC (public read
 * of a few safe fields); mock path reads the local store directly.
 */
export function useJoinPreview(code: string | undefined): JoinPreview {
  const { t } = useT();
  const mock = useChallengeByCode(code);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['challenge-preview', code],
    queryFn: () => fetchChallengePreview(code as string),
    enabled: isSupabaseConfigured && !!code,
  });

  if (isSupabaseConfigured) {
    if (!data) {
      return {
        loading: isLoading,
        // Only a genuinely-empty successful response counts as "not found" —
        // a thrown error must never be presented as "this invite doesn't exist".
        notFound: !isLoading && !isError,
        isError,
        error,
        retry: refetch,
        title: '',
        totalDays: 0,
        scheduleSummary: '',
        startsWhen: '',
        participants: [],
        joinClosed: false,
      };
    }
    return {
      loading: false,
      notFound: false,
      isError: false,
      retry: refetch,
      title: data.title,
      totalDays: data.totalDays,
      scheduleSummary: t.common.scheduleSummary(data.dailyAction, data.totalDays),
      startsWhen: data.status === 'upcoming' ? t.common.startsTomorrow : t.common.ongoing,
      stakeText: data.stakeText,
      participants: data.sampleNames.map((name, i) => ({
        id: `s${i}`,
        name,
        initials: name.slice(0, 2).toUpperCase(),
      })),
      joinClosed: data.joinClosed,
    };
  }

  if (!mock) {
    return {
      loading: false,
      notFound: true,
      isError: false,
      retry: () => {},
      title: '',
      totalDays: 0,
      scheduleSummary: '',
      startsWhen: '',
      participants: [],
      joinClosed: false,
    };
  }
  return {
    loading: false,
    notFound: false,
    isError: false,
    retry: () => {},
    title: mock.title,
    totalDays: mock.totalDays,
    scheduleSummary: mock.scheduleSummary,
    startsWhen: mock.startsWhen,
    stakeText: mock.stake?.text,
    participants: mock.participants
      .filter((p) => !p.isMe)
      .map((p) => ({ id: p.id, name: p.name, initials: p.initials })),
    joinClosed: mock.joinClosed,
  };
}

/** Check-in action + derived status for one challenge. */
export function useCheckIn(id: string) {
  const { t } = useT();
  const checkIn = useMockStore((s) => s.checkIn);
  const undo = useMockStore((s) => s.undoCheckIn);
  const challenge = useChallenge(id);
  const queryClient = useQueryClient();
  // The Edge Function decides the real day_number server-side; remember it
  // (rather than trusting challenge.currentDay) so undo removes the right row.
  const lastServerDay = useRef<number | null>(null);

  const doCheckIn = () => {
    // A challenge that hasn't started yet (upcoming, currentDay < 1) has
    // nothing to check in to — guard here too, even though the UI already
    // hides the button, so no stray caller can trigger a write.
    if (!challenge || challenge.status !== 'active' || challenge.currentDay < 1) return;
    checkIn(id); // optimistic: instant ring/animation feedback
    if (isSupabaseConfigured && challenge) {
      insertCheckIn(id, 'done')
        .then(({ dayNumber }) => {
          lastServerDay.current = dayNumber;
          queryClient.invalidateQueries({ queryKey: MY_CHALLENGES_KEY });
        })
        .catch((e) => {
          undo(id); // roll back the optimistic update
          Alert.alert(t.errors.checkInFailed, errMessage(e));
        });
    }
  };

  const doUndo = () => {
    undo(id);
    if (isSupabaseConfigured && challenge) {
      const day = lastServerDay.current ?? challenge.currentDay;
      deleteCheckIn(id, day)
        .then(() => queryClient.invalidateQueries({ queryKey: MY_CHALLENGES_KEY }))
        .catch(() => {});
    }
  };

  return {
    meCheckedInToday: challenge?.meCheckedInToday ?? false,
    myOrder: challenge?.myOrder,
    myCheckinTime: challenge?.myCheckinTime,
    checkIn: doCheckIn,
    undo: doUndo,
  };
}

/** Query key for one challenge's chat. */
export function messagesKey(id: string) {
  return ['messages', id] as const;
}

/**
 * Hydrates a single challenge's real messages (Detail screen only — Home
 * never needs chat). Call once from the Detail screen; it writes into the
 * same store entry `useChallenge(id)` already reads.
 */
export function useChallengeMessages(id: string | undefined) {
  const setMessages = useMockStore((s) => s.setChallengeMessages);
  const everHadData = useRef(false);
  const { data, isError, error, refetch } = useQuery({
    queryKey: messagesKey(id ?? ''),
    queryFn: () => fetchMessages(id as string),
    enabled: isSupabaseConfigured && !!id,
    // Same reconciliation-safety-net role as useChallengesQuery's poll —
    // useRealtimeChallenge already pushes new messages/reactions instantly
    // over the websocket. This is only the backstop for a dropped connection
    // or a project where Ek D's publication step isn't enabled.
    refetchInterval: isSupabaseConfigured && !!id ? 20_000 : false,
  });
  useEffect(() => {
    if (!isSupabaseConfigured || !id || !data) return;
    everHadData.current = true;
    const currentList = useMockStore.getState().challenges.find((c) => c.id === id)?.messages ?? [];
    const byId = new Map(data.map((m) => [m.id, m]));

    // Drop a local optimistic bubble (id `local-...`) once its real
    // (server-id) counterpart has shown up in `data` — matched by author +
    // text + day, since the ids never match a real db id.
    const confirmed = new Set(data.filter((d) => d.mine).map((d) => `${d.dayNumber}::${d.text}`));
    const kept = currentList.filter(
      (m) => !m.id.startsWith('local-') || !confirmed.has(`${m.dayNumber}::${m.text}`),
    );

    // Messages are never deleted server-side — a poll/refetch should only
    // ever add to (or refresh reaction counts on) the list, never shrink it.
    // A stale/out-of-order response (racing with another concurrent fetch,
    // e.g. the 4s poll vs. the post-send/post-reaction invalidate) could
    // otherwise wipe an already-confirmed message off the screen for a cycle
    // even though it's safely stored — this hit both the sender's and the
    // recipient's device, since neither has anything to do with the local
    // optimistic bubble once a message is truly persisted.
    const keptIds = new Set(kept.map((m) => m.id));
    const refreshed = kept.map((m) => byId.get(m.id) ?? m);
    const brandNew = data.filter((m) => !keptIds.has(m.id));
    setMessages(id, [...refreshed, ...brandNew]);
  }, [data, id, setMessages]);

  return {
    // Only surface this the first time — if we already have messages showing,
    // a background poll failing shouldn't nag every 4s.
    firstLoadError: isSupabaseConfigured && isError && !everHadData.current,
    error,
    retry: refetch,
  };
}

/**
 * Push-based updates for the "my challenges" list (Home, and anywhere else
 * useChallengesQuery is read) — a check-in, join, or restart/end-early by
 * ANYONE on ANY of the user's challenges invalidates the list instantly,
 * instead of waiting for the next poll. There's no single `challenge_id` to
 * filter these subscriptions on (this covers every challenge the user is
 * in), so — same pattern already used for `message_reactions` below —
 * subscribe unfiltered: Supabase only ever delivers rows the subscriber's
 * own RLS SELECT policies (Ek B) allow them to see, so this stays scoped to
 * "my" data. Requires Ek D's `alter publication supabase_realtime add table
 * ...` to have actually been run — until then this silently does nothing
 * and the poll below is the only thing keeping the list fresh.
 */
function useRealtimeMyChallenges(): void {
  const queryClient = useQueryClient();
  const instanceId = useRef(Math.random().toString(36).slice(2)).current;
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const bump = () => queryClient.invalidateQueries({ queryKey: MY_CHALLENGES_KEY });
    const channel = supabase
      .channel(`my-challenges-${instanceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'check_ins' }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'challenges' }, bump)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, instanceId]);
}

/**
 * Live updates for one challenge: someone else's check-in, a new joiner, a
 * new chat message, or a reaction all invalidate the relevant query so the
 * screen refreshes without a manual pull-to-refresh.
 */
export function useRealtimeChallenge(id: string | undefined) {
  const queryClient = useQueryClient();
  // A fixed channel name (e.g. `challenge-${id}`) can collide with a
  // not-yet-cleaned-up channel from a fast unmount/remount (React
  // StrictMode's double-invoke, or a quick nav-away-and-back): supabase-js
  // then reuses the still-subscribed channel object and throws "cannot add
  // postgres_changes callbacks ... after subscribe()" when we .on() it
  // again. A per-mount unique suffix sidesteps the collision entirely —
  // realtime topic names don't need to be stable across mounts.
  const instanceId = useRef(Math.random().toString(36).slice(2)).current;
  useEffect(() => {
    if (!isSupabaseConfigured || !id) return;
    const bump = (key: readonly unknown[]) => queryClient.invalidateQueries({ queryKey: key });
    const channel = supabase
      .channel(`challenge-${id}-${instanceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'check_ins', filter: `challenge_id=eq.${id}` },
        () => bump(MY_CHALLENGES_KEY),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'participants', filter: `challenge_id=eq.${id}` },
        () => bump(MY_CHALLENGES_KEY),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `challenge_id=eq.${id}` },
        () => bump(messagesKey(id)),
      )
      .on(
        // message_reactions has no challenge_id column to filter on, so this
        // channel sees reactions from every challenge — harmless, it only
        // ever invalidates this challenge's own message-list query.
        'postgres_changes',
        { event: '*', schema: 'public', table: 'message_reactions' },
        () => bump(messagesKey(id)),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, queryClient, instanceId]);
}

/** All challenge-scoped actions in one place. */
export function useChallengeActions(id: string) {
  const { t } = useT();
  const useJoker = useMockStore((s) => s.useJoker);
  const ackMissed = useMockStore((s) => s.ackMissed);
  const sendMessageMock = useMockStore((s) => s.sendMessage);
  const reactMock = useMockStore((s) => s.react);
  const nudgeMock = useMockStore((s) => s.nudge);
  const restart = useMockStore((s) => s.restart);
  const endEarly = useMockStore((s) => s.endEarly);
  const updateDetailsMock = useMockStore((s) => s.updateDetails);
  const setChallenges = useMockStore((s) => s.setChallenges);
  const challenge = useChallenge(id);
  const queryClient = useQueryClient();

  const doUseJoker = () => {
    useJoker(id); // optimistic: yesterday's segment flips to amber immediately
    if (isSupabaseConfigured && challenge) {
      insertCheckIn(id, 'joker') // day_number (yesterday) + allowance validated server-side
        .then(() => queryClient.invalidateQueries({ queryKey: MY_CHALLENGES_KEY }))
        .catch(async (e) => {
          // The optimistic amber flip didn't actually happen server-side (no
          // joker left, day already covered, etc.) — resync with the truth.
          // A plain invalidateQueries() only refetches *active* queries, and
          // Home isn't mounted while we're on this Detail screen, so fetch +
          // write the store directly instead (same fix as useJoin()).
          try {
            const fresh = await queryClient.fetchQuery({
              queryKey: MY_CHALLENGES_KEY,
              queryFn: fetchMyChallenges,
            });
            setChallenges(fresh);
          } catch {
            // best-effort resync; the alert below still tells the user it failed
          }
          Alert.alert(t.errors.jokerFailed, errMessage(e));
        });
    }
  };

  const removeMessageMock = useMockStore((s) => s.removeMessage);

  /** Returns true once the message is confirmed sent (or in mock mode) — the
   * composer only dismisses the keyboard on true, so a failed send leaves it
   * open with the draft still visible next to the error alert. */
  const doSendMessage = async (text: string): Promise<boolean> => {
    const localId = sendMessageMock(id, text); // optimistic local bubble
    if (isSupabaseConfigured && challenge) {
      try {
        await insertMessage(id, challenge.currentDay, text);
        queryClient.invalidateQueries({ queryKey: messagesKey(id) });
        return true;
      } catch (e) {
        removeMessageMock(id, localId); // roll back — it never actually sent
        Alert.alert(t.errors.messageFailed, errMessage(e));
        return false;
      }
    }
    return true;
  };

  const doReact = (messageId: string, emoji: string) => {
    reactMock(id, messageId, emoji); // optimistic +1
    if (isSupabaseConfigured) {
      insertReaction(messageId, emoji)
        .then(() => queryClient.invalidateQueries({ queryKey: messagesKey(id) }))
        .catch(() => {});
    }
  };

  const doNudge = (participantId: string) => {
    nudgeMock(id, participantId); // optimistic "Sallandı ✓"
    if (isSupabaseConfigured) {
      insertNudge(id, participantId).catch(() => {});
    }
  };

  const doRestart = () => {
    restart(id); // optimistic: local state already reflects "restarted"
    if (isSupabaseConfigured) {
      restartChallenge(id)
        .then(() => queryClient.invalidateQueries({ queryKey: MY_CHALLENGES_KEY }))
        .catch((e) => Alert.alert(t.errors.restartFailed, errMessage(e)));
    }
  };

  const doEndEarly = () => {
    endEarly(id); // optimistic: local state already reflects "completed"
    if (isSupabaseConfigured) {
      endChallengeEarly(id)
        .then(() => queryClient.invalidateQueries({ queryKey: MY_CHALLENGES_KEY }))
        .catch((e) => Alert.alert(t.errors.endEarlyFailed, errMessage(e)));
    }
  };

  /** Owner-settings sheet awaits this directly (like saveUsername) so it can
   * show the error inline instead of a global Alert — unlike the other
   * actions here, there's no optimistic UI to roll back if it fails. */
  const doUpdateDetails = async (title: string, dailyAction: string, stakeText: string): Promise<void> => {
    if (isSupabaseConfigured) {
      await updateChallengeDetails(id, title, dailyAction, stakeText);
      queryClient.invalidateQueries({ queryKey: MY_CHALLENGES_KEY });
    } else {
      updateDetailsMock(id, title, dailyAction, stakeText);
    }
  };

  return {
    useJoker: doUseJoker,
    ackMissed: () => ackMissed(id),
    sendMessage: doSendMessage,
    react: doReact,
    nudge: doNudge,
    restart: doRestart,
    endEarly: doEndEarly,
    updateDetails: doUpdateDetails,
  };
}

/**
 * Creates a challenge. Adds it to the local mock store for instant UI, and —
 * when Supabase is configured — performs the real write (challenges +
 * participants + stake). Returns the id used by the UI.
 */
export function useCreateChallenge() {
  const { t } = useT();
  const create = useMockStore((s) => s.createChallenge);
  const queryClient = useQueryClient();
  // Returns the new challenge id, or null when nothing was created (a
  // server-rejected write) — the caller must not navigate on null.
  return async (input: CreateChallengeInput): Promise<string | null> => {
    if (isSupabaseConfigured) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (user) {
        try {
          const row = await insertChallenge(input, user.id);
          // Optimistically add the real row to the cache, then refetch so the
          // list matches the server (real id keeps navigation working).
          const id = create(input, { id: row.id, inviteCode: row.invite_code });
          queryClient.invalidateQueries({ queryKey: MY_CHALLENGES_KEY });
          return id;
        } catch (e) {
          // Free-plan cap (2 active rings) tripped by the server-side trigger
          // (docs/db-pro.sql) — this isn't an error to alert, it's the
          // paywall's cue. Nothing was created; return null so the caller
          // stays put behind the paywall instead of navigating to invite.
          if (isErrorCode(e, 'CHALLENGE_LIMIT_REACHED')) {
            router.push('/paywall?reason=challengeLimit');
            return null;
          }
          const msg = errMessage(e);
          Alert.alert(t.errors.supabaseWriteFailed, t.errors.supabaseWriteFailedDetail(msg));
          return null;
        }
      }
    }
    return create(input);
  };
}

/** Join by invite code. Returns the challenge id to navigate to. */
export function useJoin() {
  const joinByCode = useMockStore((s) => s.joinByCode);
  const setChallenges = useMockStore((s) => s.setChallenges);
  const queryClient = useQueryClient();
  return async (code: string, name: string): Promise<string> => {
    if (isSupabaseConfigured) {
      const id = await joinChallengeByCode(code); // throws with a real message on failure
      // The joined challenge is brand new to this device's store. A plain
      // invalidateQueries() only refetches *active* (mounted) queries — Home
      // isn't mounted while we're on the join screen, so it would silently
      // no-op and the immediate router.replace(`/challenge/${id}`) would hit
      // "Challenge bulunamadı". Fetch + write the store directly instead.
      const fresh = await queryClient.fetchQuery({
        queryKey: MY_CHALLENGES_KEY,
        queryFn: fetchMyChallenges,
      });
      setChallenges(fresh);
      return id;
    }
    return joinByCode(code, name);
  };
}

/** E10 momentum demo toggle (fired from Settings). */
export function useMomentumDemo() {
  const momentumDemoId = useMockStore((s) => s.momentumDemoId);
  const open = useMockStore((s) => s.openMomentumDemo);
  const close = useMockStore((s) => s.closeMomentumDemo);
  return { momentumDemoId, open, close };
}

/* ---- derived helpers used across screens ---- */

export function completedCount(c: Challenge): number {
  return c.participants.filter((p) => p.checkedInToday).length;
}

export function meParticipant(c: Challenge): Participant | undefined {
  return c.participants.find((p) => p.isMe);
}

/** "Ayşe, Mert ve Can'i bekliyoruz" from the not-yet-done others. */
export function waitingLine(c: Challenge): string {
  const names = c.participants
    .filter((p) => !p.isMe && !p.checkedInToday)
    .map((p) => firstName(p.name));
  return waitingNames(names);
}
