import { create } from 'zustand';
import { buildDays, nowClock } from '@/lib/day';
import { isSupabaseConfigured } from '@/lib/supabase';
import { getDict } from '@/i18n';
import {
  getMockChallenges,
  ME_ID,
  ME_NAME,
  ME_INITIALS,
} from '@/data/mock';
import { Challenge, Message, Stake } from '@/data/types';

export interface CreateChallengeInput {
  title: string;
  dailyAction: string;
  totalDays: number;
  startTomorrow: boolean;
  /** ISO date (YYYY-MM-DD) the challenge starts — used by the Supabase write */
  startDateISO?: string;
  /** joker allowance chosen in E3 step 3 */
  joker?: number;
  /** override the "starts" copy (e.g. a custom future date) */
  startsLabel?: string;
  stake?: Stake;
  /** Ek M — kurucu davet penceresini "yalnızca ilk gün" ile sınırlayabilir. */
  firstDayJoinOnly?: boolean;
  /** Saha testi bulgusu — "kurucu-tetiklemeli başlangıç" (lobi). true ise
   * startDateISO/startTomorrow yok sayılır; challenge status='lobby' ile
   * kurulur, gerçek başlangıç sonradan startChallenge ile verilir. */
  lobby?: boolean;
}

interface MockState {
  challenges: Challenge[];
  /** demo toggle so E10 momentum sheet can be forced from Settings */
  momentumDemoId: string | null;

  // actions
  checkIn: (id: string) => void;
  undoCheckIn: (id: string) => void;
  useJoker: (id: string) => void;
  ackMissed: (id: string) => void;
  /** Returns the generated local message id (used to roll back on send failure). */
  sendMessage: (id: string, text: string) => string;
  removeMessage: (id: string, messageId: string) => void;
  react: (id: string, messageId: string, emoji: string) => void;
  nudge: (id: string, participantId: string) => void;
  createChallenge: (
    input: CreateChallengeInput,
    override?: { id?: string; inviteCode?: string },
  ) => string;
  /** Replace the cache with challenges hydrated from Supabase. */
  setChallenges: (challenges: Challenge[]) => void;
  /** Replace one challenge's messages (Supabase-fetched, real ids). */
  setChallengeMessages: (id: string, messages: Message[]) => void;
  joinByCode: (code: string, name: string) => string;
  restart: (id: string) => void;
  endEarly: (id: string) => void;
  removeChallenge: (id: string) => void;
  /** Lobby → started (mock mode has no real dates, so this just flips the
   * status/day-1 fields directly instead of round-tripping through a
   * start_date, matching how `startTomorrow: false` create already works). */
  startChallenge: (id: string) => void;
  /** Faz 3C madde 3 — owner-only edit of title/daily action/stake text. */
  updateDetails: (id: string, title: string, dailyAction: string, stakeText: string) => void;
  openMomentumDemo: (id: string) => void;
  closeMomentumDemo: () => void;
}

/** Deep clone the seed so store mutations never touch the source module. */
function seed(): Challenge[] {
  return JSON.parse(JSON.stringify(getMockChallenges())) as Challenge[];
}

/**
 * Real backend configured => start EMPTY, not with fake demo data. Otherwise
 * a slow/failed first fetch would silently show mock challenges as if they
 * were the user's real ones (loading/error states now handle that instead —
 * see useChallengesQuery in src/hooks/index.ts). Only the Phase-1 mock/demo
 * mode (no Supabase env vars) still seeds the store.
 */
function initialChallenges(): Challenge[] {
  return isSupabaseConfigured ? [] : seed();
}

function firstName(full: string): string {
  return full.split(' ')[0] ?? full;
}

export const useMockStore = create<MockState>((set, get) => ({
  challenges: initialChallenges(),
  momentumDemoId: null,

  checkIn: (id) =>
    set((s) => ({
      challenges: s.challenges.map((c) => {
        // Can't check in before the challenge has actually started.
        if (c.id !== id || c.meCheckedInToday || c.status !== 'active' || c.currentDay < 1) {
          return c;
        }
        const participants = c.participants.map((p) =>
          p.id === ME_ID
            ? { ...p, checkedInToday: true, checkinTime: nowClock() }
            : p,
        );
        const order = participants.filter((p) => p.checkedInToday).length;
        const days = c.days.slice();
        const idx = c.currentDay - 1;
        if (idx >= 0 && idx < days.length) days[idx] = 'done';
        return {
          ...c,
          participants,
          days,
          meCheckedInToday: true,
          myCheckinTime: nowClock(),
          myOrder: order,
        };
      }),
    })),

  undoCheckIn: (id) =>
    set((s) => ({
      challenges: s.challenges.map((c) => {
        if (c.id !== id || !c.meCheckedInToday) return c;
        const participants = c.participants.map((p) =>
          p.id === ME_ID
            ? { ...p, checkedInToday: false, checkinTime: undefined }
            : p,
        );
        const days = c.days.slice();
        const idx = c.currentDay - 1;
        if (idx >= 0 && idx < days.length) days[idx] = 'today';
        return {
          ...c,
          participants,
          days,
          meCheckedInToday: false,
          myCheckinTime: undefined,
          myOrder: undefined,
        };
      }),
    })),

  useJoker: (id) =>
    set((s) => ({
      challenges: s.challenges.map((c) => {
        if (c.id !== id || c.jokerRemaining <= 0 || !c.hasMissedYesterday) {
          return c;
        }
        const days = c.days.slice();
        const yIdx = c.currentDay - 2; // yesterday
        if (yIdx >= 0 && yIdx < days.length && days[yIdx] === 'missed') {
          days[yIdx] = 'joker';
        }
        return {
          ...c,
          days,
          jokerRemaining: c.jokerRemaining - 1,
          hasMissedYesterday: false,
          missedAcknowledged: true,
        };
      }),
    })),

  ackMissed: (id) =>
    set((s) => ({
      challenges: s.challenges.map((c) =>
        c.id === id ? { ...c, missedAcknowledged: true } : c,
      ),
    })),

  sendMessage: (id, text) => {
    const localId = `local-${Date.now()}`;
    set((s) => ({
      challenges: s.challenges.map((c) => {
        if (c.id !== id) return c;
        const msg: Message = {
          id: localId,
          kind: 'message',
          authorId: ME_ID,
          authorName: ME_NAME,
          text,
          dayNumber: c.currentDay,
          reactions: [],
          mine: true,
        };
        return { ...c, messages: [...c.messages, msg] };
      }),
    }));
    return localId;
  },

  removeMessage: (id, messageId) =>
    set((s) => ({
      challenges: s.challenges.map((c) =>
        c.id === id ? { ...c, messages: c.messages.filter((m) => m.id !== messageId) } : c,
      ),
    })),

  react: (id, messageId, emoji) =>
    set((s) => ({
      challenges: s.challenges.map((c) => {
        if (c.id !== id) return c;
        const messages = c.messages.map((m) => {
          if (m.id !== messageId) return m;
          const existing = m.reactions.find((r) => r.emoji === emoji);
          if (existing) {
            return {
              ...m,
              reactions: m.reactions.map((r) =>
                r.emoji === emoji ? { ...r, count: r.count + 1 } : r,
              ),
            };
          }
          return { ...m, reactions: [...m.reactions, { emoji, count: 1 }] };
        });
        return { ...c, messages };
      }),
    })),

  nudge: (id, participantId) =>
    set((s) => ({
      challenges: s.challenges.map((c) => {
        if (c.id !== id) return c;
        return {
          ...c,
          participants: c.participants.map((p) =>
            p.id === participantId ? { ...p, nudged: true } : p,
          ),
        };
      }),
    })),

  createChallenge: (input, override) => {
    const id = override?.id ?? `new-${Date.now()}`;
    const t = getDict();
    const challenge: Challenge = {
      id,
      title: input.title || t.common.newChallengeFallback,
      dailyAction: `${t.common.today}: ${input.dailyAction || t.common.completeYourGoalFallback}`,
      dailyActionRaw: input.dailyAction || t.common.completeYourGoalFallback,
      totalDays: input.totalDays,
      currentDay: input.lobby ? 0 : input.startTomorrow ? 0 : 1,
      days: input.lobby ? [] : buildDays(
        input.totalDays,
        input.startTomorrow ? [] : ['today'],
      ),
      status: input.lobby ? 'lobby' : input.startTomorrow ? 'upcoming' : 'active',
      startsLabel: input.lobby
        ? t.common.lobbyWaiting
        : input.startTomorrow
          ? input.startsLabel ?? t.common.startsTomorrow
          : undefined,
      meCheckedInToday: false,
      jokerRemaining: input.joker ?? 1,
      jokerAllowance: input.joker ?? 1,
      hasMissedYesterday: false,
      inviteCode: override?.inviteCode ?? id.slice(-6),
      scheduleSummary: t.common.scheduleSummary(input.dailyAction || t.common.dailyGoalFallback, input.totalDays),
      startsWhen: input.lobby
        ? t.common.lobbyWaiting
        : input.startTomorrow
          ? input.startsLabel ?? t.common.tomorrowSixAm
          : t.common.startsToday,
      stake: input.stake,
      firstDayJoinOnly: input.firstDayJoinOnly ?? false,
      // Mock data doesn't simulate real elapsed time, so a just-created demo
      // challenge is never actually closed to new joiners.
      joinClosed: false,
      // Whoever runs the create flow is always its owner — matches real
      // mode's challenges.owner_id.
      isOwner: true,
      participants: [
        {
          id: ME_ID,
          name: ME_NAME,
          initials: ME_INITIALS,
          isMe: true,
          checkedInToday: false,
        },
      ],
      messages: [],
    };
    set((s) => ({ challenges: [challenge, ...s.challenges] }));
    return id;
  },

  setChallenges: (challenges) => set({ challenges }),

  setChallengeMessages: (id, messages) =>
    set((s) => ({
      challenges: s.challenges.map((c) => (c.id === id ? { ...c, messages } : c)),
    })),

  joinByCode: (code, name) => {
    const existing = get().challenges.find((c) => c.inviteCode === code);
    if (existing) {
      // add me if not already a participant
      if (!existing.participants.some((p) => p.isMe)) {
        set((s) => ({
          challenges: s.challenges.map((c) =>
            c.id === existing.id
              ? {
                  ...c,
                  participants: [
                    ...c.participants,
                    {
                      id: ME_ID,
                      name: name || ME_NAME,
                      initials: ME_INITIALS,
                      isMe: true,
                      checkedInToday: false,
                    },
                  ],
                }
              : c,
          ),
        }));
      }
      return existing.id;
    }
    return 'c1';
  },

  restart: (id) =>
    set((s) => ({
      challenges: s.challenges.map((c) => {
        if (c.id !== id) return c;
        return {
          ...c,
          status: 'active',
          currentDay: 1,
          days: buildDays(c.totalDays, ['today']),
          meCheckedInToday: false,
          myCheckinTime: undefined,
          myOrder: undefined,
          hasMissedYesterday: false,
          missedAcknowledged: true,
          participants: c.participants.map((p) => ({
            ...p,
            checkedInToday: false,
            checkinTime: undefined,
          })),
        };
      }),
      momentumDemoId: null,
    })),

  endEarly: (id) =>
    set((s) => ({
      challenges: s.challenges.map((c) =>
        c.id === id ? { ...c, status: 'completed' } : c,
      ),
      momentumDemoId: null,
    })),

  removeChallenge: (id) =>
    set((s) => ({ challenges: s.challenges.filter((c) => c.id !== id) })),

  startChallenge: (id) =>
    set((s) => {
      const t = getDict();
      return {
        challenges: s.challenges.map((c) => {
          if (c.id !== id || c.status !== 'lobby') return c;
          return {
            ...c,
            status: 'active',
            currentDay: 1,
            days: buildDays(c.totalDays, ['today']),
            startsLabel: undefined,
            startsWhen: t.common.startsToday,
          };
        }),
      };
    }),

  openMomentumDemo: (id) => set({ momentumDemoId: id }),
  closeMomentumDemo: () => set({ momentumDemoId: null }),

  updateDetails: (id, title, dailyAction, stakeText) => {
    const t = getDict();
    set((s) => ({
      challenges: s.challenges.map((c) => {
        if (c.id !== id) return c;
        const clean = stakeText.trim();
        return {
          ...c,
          title,
          dailyAction: `${t.common.today}: ${dailyAction}`,
          dailyActionRaw: dailyAction,
          scheduleSummary: t.common.scheduleSummary(dailyAction, c.totalDays),
          stake: clean ? { mode: c.stake?.mode ?? 'direct', text: clean } : undefined,
        };
      }),
    }));
  },
}));

export { firstName };
