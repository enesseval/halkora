import { buildDays } from '@/lib/day';
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

/* ------------------------------------------------------------------ */
/* Challenge 1 — "30 Gün Kitap Okuma" (main E6/E7 flow + E8 + E10)      */
/* Day 7 of 14. I have NOT checked in. 4 others done → I become the 5th. */
/* Yesterday (day 6) missed, 1 joker remaining → drives E8.             */
/* ------------------------------------------------------------------ */
const c1: Challenge = {
  firstDayJoinOnly: false,
  joinClosed: false,
  id: 'c1',
  title: '30 Gün Kitap Okuma',
  dailyAction: 'Bugün: 20 sayfa oku',
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
  scheduleSummary: 'Her gün 20 sayfa · 14 gün · 1 joker',
  startsWhen: 'Yarın 06:00',
  stake: { mode: 'direct', text: 'Tamamlayamayan kahve ısmarlar' },
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
      text: 'Bugün 30 sayfa gitti, kitap açıldı resmen 📖',
      dayNumber: 7,
      reactions: [{ emoji: '🔥', count: 2 }],
    },
    {
      id: 'm2',
      kind: 'system',
      text: 'Enes tamamladı ✓',
      dayNumber: 7,
      reactions: [],
    },
    {
      id: 'm3',
      kind: 'message',
      authorId: ME_ID,
      authorName: ME_NAME,
      text: 'Ben akşama bırakıyorum, uyumadan hallederim 💪',
      dayNumber: 7,
      reactions: [],
      mine: true,
    },
  ],
  momentum: { last3: [6, 4, 2], total: 8, daysTogether: 9 },
};

/* ------------------------------------------------------------------ */
/* Challenge 2 — "Şekersiz 14 Gün". Day 3, not done, 2 others done (2/5) */
/* ------------------------------------------------------------------ */
const c2: Challenge = {
  firstDayJoinOnly: false,
  joinClosed: false,
  id: 'c2',
  title: 'Şekersiz 14 Gün',
  dailyAction: 'Bugün: Şeker yok',
  totalDays: 14,
  currentDay: 3,
  days: buildDays(14, ['done', 'done', 'today']),
  status: 'active',
  meCheckedInToday: false,
  jokerRemaining: 1,
  hasMissedYesterday: false,
  inviteCode: 'seker-14',
  scheduleSummary: 'Her gün şekersiz · 14 gün',
  startsWhen: 'Devam ediyor',
  stake: { mode: 'direct', text: 'Bırakan tatlıcıya ısmarlar' },
  participants: [
    p(ME_ID, ME_NAME, ME_INITIALS, false, { isMe: true }),
    p('kerem', 'Kerem Aydın', 'KA', true, { checkinTime: '07:40' }),
    p('sena', 'Sena Ak', 'SA', true, { checkinTime: '08:02' }),
    p('tolga', 'Tolga Er', 'TE', false),
    p('irem', 'İrem Su', 'İS', false),
  ],
  messages: [],
};

/* ------------------------------------------------------------------ */
/* Challenge 3 — "Sabah 06:30 Kulübü". Day 12/21, DONE today (calm card) */
/* ------------------------------------------------------------------ */
const c3: Challenge = {
  firstDayJoinOnly: false,
  joinClosed: false,
  id: 'c3',
  title: 'Sabah 06:30 Kulübü',
  dailyAction: "Bugün: 06:30'da kalk",
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
  scheduleSummary: "Her gün 06:30 · 21 gün",
  startsWhen: 'Devam ediyor',
  stake: { mode: 'direct', text: 'Uyuyan kahvaltı ısmarlar' },
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

/* ------------------------------------------------------------------ */
/* Challenge 4 — "10.000 Adım × 7 Gün". Starts tomorrow, 6 ready.        */
/* ------------------------------------------------------------------ */
const c4: Challenge = {
  firstDayJoinOnly: false,
  joinClosed: false,
  id: 'c4',
  title: '10.000 Adım × 7 Gün',
  dailyAction: 'Bugün: 10.000 adım',
  totalDays: 7,
  currentDay: 0,
  days: buildDays(7, []),
  status: 'upcoming',
  startsLabel: 'Yarın başlıyor',
  meCheckedInToday: false,
  jokerRemaining: 1,
  hasMissedYesterday: false,
  inviteCode: 'adim-7',
  scheduleSummary: 'Her gün 10.000 adım · 7 gün',
  startsWhen: 'Yarın başlıyor',
  stake: { mode: 'direct', text: 'Tamamlamayan brunch ısmarlar' },
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

/* ------------------------------------------------------------------ */
/* Archive — completed "30 Gün Kitap Okuma v1" → drives E9.             */
/* ------------------------------------------------------------------ */
const archive1: Challenge = {
  firstDayJoinOnly: false,
  joinClosed: false,
  id: 'a1',
  title: '30 Gün Kitap Okuma',
  dailyAction: 'Her gün 20 sayfa',
  totalDays: 14,
  currentDay: 14,
  days: buildDays(14, Array<'done'>(14).fill('done')),
  status: 'completed',
  meCheckedInToday: true,
  jokerRemaining: 0,
  hasMissedYesterday: false,
  inviteCode: 'kitap-v1',
  scheduleSummary: 'Her gün 20 sayfa · 14 gün',
  startsWhen: 'Tamamlandı',
  stake: { mode: 'direct', text: 'Tamamlayamayan kahve ısmarlar' },
  finishStats: { people: 8, checkins: 96, completionPct: 86 },
  stakeResult: '☕ Kahveler Mehmet\'ten',
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

export const MOCK_CHALLENGES: Challenge[] = [c1, c2, c3, c4, archive1];

/** Names used by the E4 "canlılık" ticker (participants joining live). */
export const INVITE_JOINERS = [
  { id: 'ali', name: 'Ali Vural', initials: 'AV' },
  { id: 'ayse2', name: 'Ayşe Yılmaz', initials: 'AY' },
  { id: 'enes2', name: 'Enes Kaya', initials: 'EK' },
];

/** Preset templates for E3 step 1. */
export const TEMPLATES = [
  { id: 't1', label: 'Kitap okuma', emoji: '📘', action: '20 sayfa oku', title: '30 Gün Kitap Okuma' },
  { id: 't2', label: 'Koşu', emoji: '🏃', action: '3 km koş', title: 'Koşu Challenge' },
  { id: 't3', label: 'Erken kalkma', emoji: '🌅', action: "06:30'da kalk", title: 'Sabah Kulübü' },
  { id: 't4', label: 'Meditasyon', emoji: '🧘', action: '10 dk medite et', title: 'Meditasyon 21 Gün' },
  { id: 't5', label: 'Şekersiz', emoji: '🍫', action: 'Şeker yok', title: 'Şekersiz Challenge' },
];

export const STAKE_PRESETS = [
  { id: 's1', label: 'Kahve ısmarlar', emoji: '☕' },
  { id: 's2', label: 'Yemek ısmarlar', emoji: '🍽️' },
  { id: 's3', label: 'Grubun seçtiği filmi izler', emoji: '🎬' },
];

export const REACTION_EMOJIS = ['👍', '❤️', '🔥', '😂', '💪'];
