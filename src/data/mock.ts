import { buildDays } from '@/lib/day';
import { getDict } from '@/i18n';
import { Challenge, Participant } from './types';

export const ME_ID = 'me';
export const ME_NAME = 'Selin Nur';
export const ME_INITIALS = 'SN';

function p(
  id: string,
  name: string,
  initials: string,
  checkedInToday: boolean,
  extra: Partial<Participant> = {},
): Participant {
  return { id, name, initials, checkedInToday, ...extra };
}

type MockDict = ReturnType<typeof getDict>['mock'];

/* ------------------------------------------------------------------ */
/* Challenge 1 — "30 Gün Kitap Okuma" (main E6/E7 flow + E8 + E10)      */
/* Day 7 of 14. I have NOT checked in. 4 others done → I become the 5th. */
/* Yesterday (day 6) missed, 1 joker remaining → drives E8.             */
/* ------------------------------------------------------------------ */
function buildC1(m: MockDict): Challenge {
  return {
    firstDayJoinOnly: false,
    joinClosed: false,
    id: 'c1',
    title: m.c1.title,
    dailyAction: m.c1.dailyAction,
    totalDays: 14,
    currentDay: 7,
    days: buildDays(14, [
      'done', 'done', 'joker', 'done', 'done', 'missed', 'today',
    ]),
    status: 'active',
    meCheckedInToday: false,
    jokerRemaining: 1,
    hasMissedYesterday: true,
    missedAcknowledged: false,
    inviteCode: 'kitap-14',
    scheduleSummary: m.c1.scheduleSummary,
    startsWhen: m.c1.startsWhen,
    stake: { mode: 'direct', text: m.c1.stake },
    participants: [
      p(ME_ID, ME_NAME, ME_INITIALS, false, { isMe: true }),
      p('enes', 'Enes Kaya', 'EK', true, { checkinTime: '08:20' }),
      p('zeynep', 'Zeynep Demir', 'ZD', true, { checkinTime: '07:05' }),
      p('burak', 'Burak Aslan', 'BA', true, { checkinTime: '09:12' }),
      p('deniz', 'Deniz Koç', 'DK', true, { checkinTime: '06:48' }),
      p('ayse', 'Ayşe Yılmaz', 'AY', false),
      p('mert', 'Mert Can', 'MC', false, { silentDays: 2 }),
      p('can', 'Can Öz', 'CÖ', false),
    ],
    messages: [
      {
        id: 'm1',
        kind: 'message',
        authorId: 'zeynep',
        authorName: 'Zeynep',
        text: m.c1.msg1,
        dayNumber: 7,
        reactions: [{ emoji: '🔥', count: 2 }],
      },
      {
        id: 'm2',
        kind: 'system',
        text: m.c1.msgSystemDone('Enes'),
        dayNumber: 7,
        reactions: [],
      },
      {
        id: 'm3',
        kind: 'message',
        authorId: ME_ID,
        authorName: ME_NAME,
        text: m.c1.msg3,
        dayNumber: 7,
        reactions: [],
        mine: true,
      },
    ],
    momentum: { last3: [6, 4, 2], total: 8, daysTogether: 9 },
  };
}

/* ------------------------------------------------------------------ */
/* Challenge 2 — "Şekersiz 14 Gün". Day 3, not done, 2 others done (2/5) */
/* ------------------------------------------------------------------ */
function buildC2(m: MockDict): Challenge {
  return {
    firstDayJoinOnly: false,
    joinClosed: false,
    id: 'c2',
    title: m.c2.title,
    dailyAction: m.c2.dailyAction,
    totalDays: 14,
    currentDay: 3,
    days: buildDays(14, ['done', 'done', 'today']),
    status: 'active',
    meCheckedInToday: false,
    jokerRemaining: 1,
    hasMissedYesterday: false,
    inviteCode: 'seker-14',
    scheduleSummary: m.c2.scheduleSummary,
    startsWhen: getDict().common.ongoing,
    stake: { mode: 'direct', text: m.c2.stake },
    participants: [
      p(ME_ID, ME_NAME, ME_INITIALS, false, { isMe: true }),
      p('kerem', 'Kerem Aydın', 'KA', true, { checkinTime: '07:40' }),
      p('sena', 'Sena Ak', 'SA', true, { checkinTime: '08:02' }),
      p('tolga', 'Tolga Er', 'TE', false),
      p('irem', 'İrem Su', 'İS', false),
    ],
    messages: [],
  };
}

/* ------------------------------------------------------------------ */
/* Challenge 3 — "Sabah 06:30 Kulübü". Day 12/21, DONE today (calm card) */
/* ------------------------------------------------------------------ */
function buildC3(m: MockDict): Challenge {
  return {
    firstDayJoinOnly: false,
    joinClosed: false,
    id: 'c3',
    title: m.c3.title,
    dailyAction: m.c3.dailyAction,
    totalDays: 21,
    currentDay: 12,
    days: buildDays(21, [
      'done', 'done', 'done', 'done', 'done', 'done',
      'done', 'done', 'done', 'done', 'done', 'done',
    ]),
    status: 'active',
    meCheckedInToday: true,
    myCheckinTime: '07:12',
    myOrder: 3,
    jokerRemaining: 2,
    hasMissedYesterday: false,
    inviteCode: 'sabah-21',
    scheduleSummary: m.c3.scheduleSummary,
    startsWhen: getDict().common.ongoing,
    stake: { mode: 'direct', text: m.c3.stake },
    participants: [
      p(ME_ID, ME_NAME, ME_INITIALS, true, { isMe: true, checkinTime: '07:12' }),
      p('mehmet', 'Mehmet Kaya', 'MK', true, { checkinTime: '06:31' }),
      p('elif', 'Elif Yıldız', 'EY', true, { checkinTime: '06:35' }),
      p('okan', 'Okan Şen', 'OŞ', true, { checkinTime: '06:40' }),
      p('naz', 'Naz Aksoy', 'NA', false),
      p('emre', 'Emre Ün', 'EÜ', false),
    ],
    messages: [],
  };
}

/* ------------------------------------------------------------------ */
/* Challenge 4 — "10.000 Adım × 7 Gün". Starts tomorrow, 6 ready.        */
/* ------------------------------------------------------------------ */
function buildC4(m: MockDict): Challenge {
  const startsTomorrow = getDict().common.startsTomorrow;
  return {
    firstDayJoinOnly: false,
    joinClosed: false,
    id: 'c4',
    title: m.c4.title,
    dailyAction: m.c4.dailyAction,
    totalDays: 7,
    currentDay: 0,
    days: buildDays(7, []),
    status: 'upcoming',
    startsLabel: startsTomorrow,
    meCheckedInToday: false,
    jokerRemaining: 1,
    hasMissedYesterday: false,
    inviteCode: 'adim-7',
    scheduleSummary: m.c4.scheduleSummary,
    startsWhen: startsTomorrow,
    stake: { mode: 'direct', text: m.c4.stake },
    participants: [
      p(ME_ID, ME_NAME, ME_INITIALS, false, { isMe: true }),
      p('cem', 'Cem Ay', 'CA', false),
      p('lale', 'Lale Gök', 'LG', false),
      p('arda', 'Arda Kaya', 'AK', false),
      p('pinar', 'Pınar Su', 'PS', false),
      p('bora', 'Bora Taş', 'BT', false),
    ],
    messages: [],
  };
}

/* ------------------------------------------------------------------ */
/* Archive — completed "30 Gün Kitap Okuma v1" → drives E9.             */
/* ------------------------------------------------------------------ */
function buildArchive1(m: MockDict): Challenge {
  return {
    firstDayJoinOnly: false,
    joinClosed: false,
    id: 'a1',
    title: m.archive1.title,
    dailyAction: m.archive1.dailyAction,
    totalDays: 14,
    currentDay: 14,
    days: buildDays(14, Array<'done'>(14).fill('done')),
    status: 'completed',
    meCheckedInToday: true,
    jokerRemaining: 0,
    hasMissedYesterday: false,
    inviteCode: 'kitap-v1',
    scheduleSummary: m.archive1.scheduleSummary,
    startsWhen: getDict().common.completed,
    stake: { mode: 'direct', text: m.archive1.stake },
    finishStats: { people: 8, checkins: 96, completionPct: 86 },
    stakeResult: m.archive1.stakeResult,
    participants: [
      p('zeynep', 'Zeynep Demir', 'ZD', true, { completedDays: 14 }),
      p('enes', 'Enes Kaya', 'EK', true, { completedDays: 14 }),
      p(ME_ID, ME_NAME, ME_INITIALS, true, { isMe: true, completedDays: 13 }),
      p('burak', 'Burak Aslan', 'BA', true, { completedDays: 13 }),
      p('deniz', 'Deniz Koç', 'DK', true, { completedDays: 12 }),
      p('ayse', 'Ayşe Yılmaz', 'AY', true, { completedDays: 12 }),
      p('mehmet', 'Mehmet Kaya', 'MK', true, { completedDays: 11 }),
      p('can', 'Can Öz', 'CÖ', true, { completedDays: 10 }),
    ],
    messages: [],
  };
}

/**
 * Demo challenges for Phase-1 mock mode (no Supabase configured) — built
 * fresh from the current locale each call. The mock STORE only calls this
 * once at module load to seed itself (src/stores/mockStore.ts), so a
 * language switch mid-demo-session won't retroactively translate whatever
 * was already seeded — acceptable for sample data, unlike real challenges.
 */
export function getMockChallenges(): Challenge[] {
  const m = getDict().mock;
  return [buildC1(m), buildC2(m), buildC3(m), buildC4(m), buildArchive1(m)];
}

/** Names used by the E4 "canlılık" ticker (participants joining live). */
export function getInviteJoiners() {
  const names = getDict().mock.inviteJoiners;
  return [
    { id: 'ali', name: names.ali, initials: 'AV' },
    { id: 'ayse2', name: names.ayse, initials: 'AY' },
    { id: 'enes2', name: names.enes, initials: 'EK' },
  ];
}

/** Preset templates for E3 step 1. */
export function getTemplates() {
  const t = getDict().mock.templates;
  return [
    { id: 't1', label: t.book.label, emoji: '📘', action: t.book.action, title: t.book.title },
    { id: 't2', label: t.run.label, emoji: '🏃', action: t.run.action, title: t.run.title },
    { id: 't3', label: t.earlyRise.label, emoji: '🌅', action: t.earlyRise.action, title: t.earlyRise.title },
    { id: 't4', label: t.meditation.label, emoji: '🧘', action: t.meditation.action, title: t.meditation.title },
    { id: 't5', label: t.noSugar.label, emoji: '🍫', action: t.noSugar.action, title: t.noSugar.title },
  ];
}

export function getStakePresets() {
  const s = getDict().mock.stakePresets;
  return [
    { id: 's1', label: s.coffee, emoji: '☕' },
    { id: 's2', label: s.meal, emoji: '🍽️' },
    { id: 's3', label: s.movie, emoji: '🎬' },
  ];
}

export const REACTION_EMOJIS = ['👍', '❤️', '🔥', '😂', '💪'];
