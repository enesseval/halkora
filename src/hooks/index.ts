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
  endChallengeEarly,
  updateChallengeDetails,
  deleteChallenge as deleteChallengeRemote,
  leaveChallenge as leaveChallengeRemote,
  closeChallenge as closeChallengeRemote,
  startChallenge as startChallengeRemote,
  settleStake,
} from '@/data/challenges';
import { insertCheckIn, deleteCheckIn } from '@/data/checkins';
import { amIParticipant, fetchChallengePreview, joinChallengeByCode } from '@/data/join';
import { fetchMessages, insertMessage, insertReaction, insertNudge, insertSystemMessage } from '@/data/chat';
import { RECEIVED_INVITES_KEY } from '@/components/InvitesSheet';
import { errMessage, friendlyErrorMessage, isErrorCode, isNetworkError } from '@/lib/errors';
import { router } from 'expo-router';
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
import { syncWidgetSnapshot } from '@/lib/widget';
import { useAuth } from './useAuth';
import { firstName } from '@/stores/mockStore';
import { Challenge, Participant } from '@/data/types';
import { useT } from '@/i18n';

// Re-export types + static config so screens have a single import source.
export type { Challenge, Participant, Message, Stake, StakeOption, SegmentState } from '@/data/types';
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
  /**
   * Ids the last response didn't contain. A ring is only dropped once it has
   * been missing TWICE — see the pruning note below.
   */
  const missedOnce = useRef<Set<string>>(new Set());
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
    refetchInterval: isSupabaseConfigured ? 60_000 : false,
  });

  useEffect(() => {
    if (isSupabaseConfigured && query.data) {
      everHadData.current = true;
      const current = useMockStore.getState().challenges;
      const byId = new Map(query.data.map((c) => [c.id, c]));
      const currentIds = new Set(current.map((c) => c.id));
      // fetchMyChallenges never fetches chat messages (that's the separate
      // useChallengeMessages poll) — its rows always carry `messages: []`.
      // Applying it wholesale would stomp whatever the chat poll had just
      // populated back to empty every 5s, which is exactly what made a
      // just-sent message flash and then vanish for BOTH sides of the chat.
      //
      // missedAckDay is the same shape of problem: it lives only on the
      // client, so every poll handed back a row without it and the
      // missed-day gate reappeared over whatever you were doing, about once
      // a minute, with no way to get past it except checking in.
      //
      // Rings the server no longer returns are dropped, but only after being
      // absent TWICE. The comment that used to sit here said nothing ever
      // removes a ring from this list; leaving, deleting and closing all do
      // now, and so does deleting a row by hand — a ring gone from the
      // database sat in History until the app was reinstalled. Dropping on a
      // single absence would reintroduce what that comment was guarding
      // against, which is a just-created ring vanishing for a cycle because a
      // poll already in flight predates it. Nothing survives two consecutive
      // responses by accident.
      //
      // This is why `dataUpdatedAt` is in the dependency list below and not
      // just `data`. React Query's structural sharing hands back the PREVIOUS
      // object when a response is deeply equal to the last one, so two
      // identical polls change nothing about `data`'s identity and this
      // effect never runs a second time. The second strike could not land,
      // and a hand-deleted ring stayed in History forever — the rule read
      // correctly and could not fire (saha testi bulgusu — "veritabanından
      // elle sildiğim halka hala geçmişte gözüküyor"). `dataUpdatedAt`
      // changes on every successful fetch, equal payload or not.
      const gone = new Set<string>();
      for (const c of current) {
        if (byId.has(c.id)) continue;
        if (missedOnce.current.has(c.id)) gone.add(c.id);
      }
      missedOnce.current = new Set(
        current.filter((c) => !byId.has(c.id) && !gone.has(c.id)).map((c) => c.id),
      );

      const refreshed = current
        .filter((c) => !gone.has(c.id))
        .map((c) => {
          const fresh = byId.get(c.id);
          return fresh ? { ...fresh, messages: c.messages, missedAckDay: c.missedAckDay } : c;
        });
      const brandNew = query.data.filter((c) => !currentIds.has(c.id));
      const merged = [...refreshed, ...brandNew];
      setChallenges(merged);
      syncWidgetSnapshot(merged);
    }
  }, [query.data, query.dataUpdatedAt, setChallenges]);

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
    // 'lobby' (kurucu-tetiklemeli başlangıç) buraya da katılıyor — "henüz
    // başlamadı ama görünür olsun" anlamıyla 'upcoming' ile aynı bucket'a
    // giriyor; kartın startsWhen etiketi zaten lobi'ye özel metni gösteriyor.
    const upcoming = challenges.filter((c) => c.status === 'upcoming' || c.status === 'lobby');
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
  const { t } = useT();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    if (!isSupabaseConfigured) return;
    setRefreshing(true);
    try {
      // `throwOnError` because refetchQueries resolves successfully even when
      // the fetch failed — react-query considers "I ran the query" the job
      // done. Without it a refresh with no network looked identical to one
      // that worked: the spinner retracted and nothing said why nothing
      // changed. It also means the retries below are awaited rather than
      // left running under a spinner that already went away.
      await queryClient.refetchQueries({ queryKey: MY_CHALLENGES_KEY }, { throwOnError: true });
    } catch (e) {
      Alert.alert(
        isNetworkError(e) ? t.errors.offlineTitle : t.errors.loadFailed,
        friendlyErrorMessage(e),
      );
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
  /** The ring itself is over — closed by its owner or finished. Its invite
   * link outlives it, so the screen has to say so rather than let someone
   * walk into a ring nobody is checking into. */
  ringClosed: boolean;
  /** Already a member — including the owner opening their own invite link.
   * Nothing stopped that before, so a founder could walk their own join flow. */
  alreadyJoined: boolean;
  /** The previewed ring, so "you're already in" can offer a way into it. */
  challengeId?: string;
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

  // Membership is a separate question from the preview, and stays separate:
  // the preview RPC is a deliberately public read of a few safe fields, while
  // this one depends on who is looking. It can only start once the preview has
  // resolved to an id.
  const { data: joined, isLoading: joinedLoading } = useQuery({
    queryKey: ['challenge-membership', data?.id],
    queryFn: () => amIParticipant(data!.id),
    enabled: isSupabaseConfigured && !!data?.id,
  });

  if (isSupabaseConfigured) {
    if (!data) {
      return {
        loading: isLoading,
        alreadyJoined: false,
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
        ringClosed: false,
      };
    }
    return {
      // Membership decides which call-to-action this screen shows, so the
      // screen waits for it rather than flashing "Join" and swapping it out.
      loading: joinedLoading,
      alreadyJoined: joined === true,
      challengeId: data.id,
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
      // Same set the join RPC rejects on, so the screen and the server agree
      // on what "over" means.
      ringClosed: data.status === 'completed' || data.status === 'closed',
    };
  }

  if (!mock) {
    return {
      loading: false,
      notFound: true,
      alreadyJoined: false,
      isError: false,
      retry: () => {},
      title: '',
      totalDays: 0,
      scheduleSummary: '',
      startsWhen: '',
      participants: [],
      joinClosed: false,
      ringClosed: false,
    };
  }
  return {
    loading: false,
    notFound: false,
    alreadyJoined: mock.participants.some((p) => p.isMe),
    challengeId: mock.id,
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
    ringClosed: mock.status === 'completed',
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
    // Widget-checkin's deep link (app/widget-checkin/[id].tsx) navigates
    // away immediately after calling this, well before the invalidateQueries
    // below would've re-synced it — push the optimistic state now so the
    // widget shows "done" right away instead of on the next poll.
    syncWidgetSnapshot(useMockStore.getState().challenges);
    if (isSupabaseConfigured && challenge) {
      insertCheckIn(id, 'done')
        .then(({ dayNumber }) => {
          lastServerDay.current = dayNumber;
          queryClient.invalidateQueries({ queryKey: MY_CHALLENGES_KEY });
        })
        .catch((e) => {
          undo(id); // roll back the optimistic update
          syncWidgetSnapshot(useMockStore.getState().challenges);
          Alert.alert(t.errors.checkInFailed, friendlyErrorMessage(e));
        });
    }
  };

  const doUndo = () => {
    if (!challenge) return;
    undo(id);
    syncWidgetSnapshot(useMockStore.getState().challenges);
    if (!isSupabaseConfigured) return;
    const day = lastServerDay.current ?? challenge.currentDay;
    deleteCheckIn(id, day)
      .then(() => queryClient.invalidateQueries({ queryKey: MY_CHALLENGES_KEY }))
      .catch((e) => {
        // The optimistic undo didn't actually happen server-side. Swallowing
        // this left the tick gone on screen while the row was still in the
        // database, so the next poll silently put it back — undo looked like
        // it had worked and then changed its mind. Put it back deliberately
        // instead, and say why.
        checkIn(id);
        syncWidgetSnapshot(useMockStore.getState().challenges);
        Alert.alert(t.errors.undoFailed, friendlyErrorMessage(e));
      });
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
  const { data, isError, error, refetch, dataUpdatedAt } = useQuery({
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

    // A message on screen that this response doesn't contain is one of two
    // very different things, and the merge has to tell them apart.
    //
    //  - The response is simply older than the message. A stale/out-of-order
    //    fetch (the 20s poll racing the post-send invalidate) would otherwise
    //    wipe an already-confirmed message off the screen for a cycle even
    //    though it's safely stored — that hit both the sender's and the
    //    recipient's device.
    //  - The server genuinely stopped returning it. Blocking does exactly
    //    this: `messages`'s RLS policy is `is_member(...) and not
    //    is_blocked_pair(user_id)`, so a blocked person's messages stop
    //    arriving. This merge used to never shrink the list, so they stayed
    //    on screen forever and blocking looked broken (App Store 1.2).
    //
    // The cutoff separates them: only a message newer than the response
    // itself can legitimately be missing from it. The 10s slack covers the
    // request's own round trip — a message created while the request was in
    // flight is older than `dataUpdatedAt` but could not have been in the
    // answer. Blocked messages are older than that and drop out, at the
    // latest on the next poll, on BOTH devices — which matters, because a
    // client cannot compute this itself: `blocked_users` only lets you read
    // the blocks YOU created, so the person who was blocked has no way to
    // know. Only the server sees both directions.
    const cutoff = dataUpdatedAt - 10_000;
    const stillOnServer = (m: (typeof kept)[number]) => {
      if (byId.has(m.id)) return true;
      if (m.id.startsWith('local-')) return true; // not a server message yet
      if (!m.createdAt) return true; // mock/legacy row, nothing to compare
      return Date.parse(m.createdAt) > cutoff;
    };

    const keptIds = new Set(kept.filter(stillOnServer).map((m) => m.id));
    const refreshed = kept.filter(stillOnServer).map((m) => byId.get(m.id) ?? m);
    const brandNew = data.filter((m) => !keptIds.has(m.id));
    setMessages(id, [...refreshed, ...brandNew]);
  }, [data, dataUpdatedAt, id, setMessages]);

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
  const endEarly = useMockStore((s) => s.endEarly);
  const removeChallengeMock = useMockStore((s) => s.removeChallenge);
  const startChallengeMock = useMockStore((s) => s.startChallenge);
  const updateDetailsMock = useMockStore((s) => s.updateDetails);
  const settleStakeMock = useMockStore((s) => s.settleStake);
  const setChallenges = useMockStore((s) => s.setChallenges);
  const challenge = useChallenge(id);
  const queryClient = useQueryClient();
  const { name: myName } = useAuth();

  /** `dayNumber` omitted = yesterday (the missed-day gate); a number comes
   * from tapping that gap on the ring. */
  const doUseJoker = (dayNumber?: number) => {
    useJoker(id, dayNumber); // optimistic: that segment flips to amber immediately
    if (isSupabaseConfigured && challenge) {
      insertCheckIn(id, 'joker', dayNumber) // day + allowance validated server-side
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
          Alert.alert(t.errors.jokerFailed, friendlyErrorMessage(e));
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
        Alert.alert(t.errors.messageFailed, friendlyErrorMessage(e));
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

  const doNudge = (participantId: string, recipientName: string, message: string) => {
    nudgeMock(id, participantId); // optimistic "Sallandı ✓"
    if (isSupabaseConfigured && challenge) {
      insertNudge(id, participantId, message)
        // Visible to the whole group in chat, not just a private push to the
        // recipient (saha testi bulgusu: "chatte gözüksün, ne yaptın diye").
        // Best-effort — a failure here shouldn't undo the nudge itself.
        .then(() =>
          insertSystemMessage(
            id,
            challenge.currentDay,
            t.participant.nudgeSystemMessage(myName ?? t.common.person, recipientName, message),
            false, // already pushed via the nudges table above — don't double-notify
          ),
        )
        .then(() => queryClient.invalidateQueries({ queryKey: messagesKey(id) }))
        .catch(() => {});
    }
  };


  /** Closes the stake. Awaited by the finish screen so it can show the error
   * inline; ALREADY_SETTLED counts as success — two members tapping at the
   * same moment is a normal race, not something to complain about. */
  const doSettleStake = async (): Promise<void> => {
    if (isSupabaseConfigured) {
      try {
        await settleStake(id);
      } catch (e) {
        if (!isErrorCode(e, 'ALREADY_SETTLED')) throw e;
      }
      queryClient.invalidateQueries({ queryKey: MY_CHALLENGES_KEY });
      queryClient.invalidateQueries({ queryKey: messagesKey(id) });
    } else {
      settleStakeMock(id);
    }
  };

  const doEndEarly = () => {
    endEarly(id); // optimistic: local state already reflects "completed"
    if (isSupabaseConfigured) {
      endChallengeEarly(id)
        .then(() => queryClient.invalidateQueries({ queryKey: MY_CHALLENGES_KEY }))
        .catch((e) => Alert.alert(t.errors.endEarlyFailed, friendlyErrorMessage(e)));
    }
  };

  /** Owner-settings sheet awaits this directly (like saveUsername) so it can
   * show the error inline instead of a global Alert — unlike the other
   * actions here, there's no optimistic UI to roll back if it fails. */
  const doUpdateDetails = async (title: string, dailyAction: string, stakeText: string): Promise<void> => {
    if (isSupabaseConfigured) {
      // Snapshot BEFORE the write so the system message can say what
      // actually changed (the sheet always submits all three fields,
      // whether or not the owner touched them).
      const prevTitle = challenge?.title;
      const prevAction = challenge?.dailyActionRaw;
      const prevStake = challenge?.stake?.text ?? '';
      await updateChallengeDetails(id, title, dailyAction, stakeText);
      queryClient.invalidateQueries({ queryKey: MY_CHALLENGES_KEY });
      // Visible to the whole group in chat — saha testi bulgusu: "grup adını
      // değiştirdim ama chatte gözükmedi". Worth a push too (unlike a nudge's
      // own system message, there's no separate targeted push already
      // covering this), so notifyOthers stays true. Best-effort.
      if (challenge) {
        const changes: string[] = [];
        if (prevTitle !== undefined && prevTitle !== title) changes.push(t.detail.changedTitle(prevTitle, title));
        if (prevAction !== undefined && prevAction !== dailyAction) changes.push(t.detail.changedDailyAction(dailyAction));
        if (prevStake !== stakeText) changes.push(t.detail.changedStake(stakeText));
        if (changes.length > 0) {
          insertSystemMessage(id, challenge.currentDay, changes.join('\n'))
            .then(() => queryClient.invalidateQueries({ queryKey: messagesKey(id) }))
            .catch(() => {});
        }
      }
    } else {
      updateDetailsMock(id, title, dailyAction, stakeText);
    }
  };

  /** Owner-only. Awaited by the caller (like updateDetails) so it can
   * navigate away only once the delete is actually confirmed server-side.
   * Strips the challenge from the local store IMMEDIATELY on success rather
   * than only invalidating the query — a bug let a just-deleted challenge
   * keep showing on Home (and fail with CHALLENGE_NOT_FOUND on check-in)
   * because invalidateQueries's background refetch isn't guaranteed to land
   * before the next render/tap. */
  const doDelete = async (): Promise<void> => {
    if (isSupabaseConfigured) {
      await deleteChallengeRemote(id);
    }
    removeChallengeMock(id);
    if (isSupabaseConfigured) {
      queryClient.invalidateQueries({ queryKey: MY_CHALLENGES_KEY });
    }
  };

  /**
   * Removes this device's user from the ring. The owner may do it too — the
   * earliest-joined member takes over — unless they're the last one there,
   * which the RPC rejects with LAST_MEMBER_MUST_CLOSE.
   *
   * `systemText` is the line the group sees in chat; composed by the caller
   * because the database can't reach the dictionaries.
   */
  const doLeave = async (systemText?: string): Promise<void> => {
    if (isSupabaseConfigured) {
      await leaveChallengeRemote(id, systemText);
    }
    removeChallengeMock(id);
    if (isSupabaseConfigured) {
      queryClient.invalidateQueries({ queryKey: MY_CHALLENGES_KEY });
    }
  };

  /**
   * Closes the ring for everyone. Unlike delete, nothing is destroyed: it
   * leaves the active list, nobody can check in again, and every member keeps
   * their history. The system message it writes is what notifies them.
   */
  const doClose = async (systemText: string): Promise<void> => {
    if (isSupabaseConfigured) {
      await closeChallengeRemote(id, systemText);
      queryClient.invalidateQueries({ queryKey: MY_CHALLENGES_KEY });
    } else {
      removeChallengeMock(id);
    }
  };

  /** Owner-only — leaves lobby state. `startDateISO` omitted starts today. */
  const doStart = async (startDateISO?: string): Promise<void> => {
    if (isSupabaseConfigured) {
      await startChallengeRemote(id, startDateISO);
      queryClient.invalidateQueries({ queryKey: MY_CHALLENGES_KEY });
    } else {
      startChallengeMock(id);
    }
  };

  return {
    useJoker: doUseJoker,
    ackMissed: () => ackMissed(id),
    sendMessage: doSendMessage,
    react: doReact,
    nudge: doNudge,
    endEarly: doEndEarly,
    updateDetails: doUpdateDetails,
    settleStake: doSettleStake,
    deleteChallenge: doDelete,
    leaveChallenge: doLeave,
    closeChallenge: doClose,
    startChallenge: doStart,
  };
}

/**
 * Free-plan create gate, checked at the ENTRY of the create flow (not only
 * at the final server insert) so a capped user sees the paywall before
 * filling the whole form, not after. Returns true when creating is allowed;
 * otherwise routes to the paywall and returns false. The DB trigger
 * (docs/db-pro.sql) stays as the authoritative backstop — this is UX only.
 */
export function useCreateGate(): () => boolean {
  const { isPro } = useAuth();
  const challenges = useMockStore((s) => s.challenges);
  return () => {
    if (!isSupabaseConfigured || isPro) return true;
    // Mirror the server trigger: only challenges I OWN that are still
    // running occupy a free slot ('completed' here is already date-aware —
    // mapRow derives it client-side).
    const running = challenges.filter((c) => c.isOwner && c.status !== 'completed').length;
    if (running >= 2) {
      router.push('/paywall?reason=challengeLimit');
      return false;
    }
    return true;
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
          // Offline gets its own calm message — never the raw TypeError, and
          // never the old dev-only "did you set up RLS?" diagnostic, which
          // read as a broken app to a real user who simply has no signal.
          if (isNetworkError(e)) {
            Alert.alert(t.errors.offlineTitle, t.errors.checkConnection);
          } else {
            Alert.alert(t.errors.createFailed, friendlyErrorMessage(e));
          }
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
      // The invite that brought you here is spent. my_invites() already
      // excludes rings you're in, so this only has to ask again — without it
      // the bell kept its count until the next poll came round.
      queryClient.invalidateQueries({ queryKey: RECEIVED_INVITES_KEY });
      return id;
    }
    return joinByCode(code, name);
  };
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
