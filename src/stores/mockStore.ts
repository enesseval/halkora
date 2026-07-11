import { create } from 'zustand';
import { buildDays, nowClock } from '@/lib/day';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  MOCK_CHALLENGES,
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
  openMomentumDemo: (id: string) => void;
  closeMomentumDemo: () => void;
}

/** Deep clone the seed so store mutations never touch the source module. */
function seed(): Challenge[] {
  return JSON.parse(JSON.stringify(MOCK_CHALLENGES)) as Challenge[];
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
    const challenge: Challenge = {
      id,
      title: input.title || 'Yeni Challenge',
      dailyAction: `Bugün: ${input.dailyAction || 'hedefini tamamla'}`,
      totalDays: input.totalDays,
      currentDay: input.startTomorrow ? 0 : 1,
      days: buildDays(
        input.totalDays,
        input.startTomorrow ? [] : ['today'],
      ),
      status: input.startTomorrow ? 'upcoming' : 'active',
      startsLabel: input.startTomorrow
        ? input.startsLabel ?? 'Yarın başlıyor'
        : undefined,
      meCheckedInToday: false,
      jokerRemaining: 1,
      hasMissedYesterday: false,
      inviteCode: override?.inviteCode ?? id.slice(-6),
      scheduleSummary: `${input.dailyAction || 'Günlük hedef'} · ${input.totalDays} gün`,
      startsWhen: input.startTomorrow
        ? input.startsLabel ?? 'Yarın 06:00'
        : 'Bugün başladı',
      stake: input.stake,
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

  openMomentumDemo: (id) => set({ momentumDemoId: id }),
  closeMomentumDemo: () => set({ momentumDemoId: null }),
}));

export { firstName };
