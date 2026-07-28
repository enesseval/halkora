/** Visual state of a single day segment on the ProgressRing. */
export type SegmentState = 'done' | 'joker' | 'missed' | 'empty' | 'today';

// 'lobby' — kurucu-tetiklemeli başlangıç (ROADMAP "Saha testi bulguları"):
// start_date henüz yok, kurucu ne zaman isterse (ya da ileri bir tarih
// seçerek) başlatana kadar bekler. Yalnızca gerçek modda mümkün.
export type ChallengeStatus = 'active' | 'completed' | 'upcoming' | 'lobby';

export interface Participant {
  id: string;
  name: string;
  initials: string;
  isMe?: boolean;
  checkedInToday: boolean;
  checkinTime?: string; // e.g. "09:41"
  silentDays?: number; // consecutive quiet days (>=2 shows "El salla")
  nudged?: boolean;
  completedDays?: number; // for the finish/E9 leaderboard (x/total)
}

export interface Reaction {
  emoji: string;
  count: number;
}

export type MessageKind = 'message' | 'system';

export interface Message {
  id: string;
  kind: MessageKind;
  authorId?: string;
  authorName?: string;
  text: string;
  dayNumber: number;
  reactions: Reaction[];
  mine?: boolean;
}

export type StakeMode = 'direct' | 'vote';

export interface StakeOption {
  id: string;
  label: string;
  votes: number;
}

/** 'individual' — whoever exceeds the missed-day threshold pays.
 *  'collective' — the group either hits a shared check-in target or doesn't. */
export type StakeKind = 'individual' | 'collective';

export interface Stake {
  mode: StakeMode;
  kind: StakeKind;
  text: string; // headline shown in StakeBadge
  /** individual: max missed days allowed. `undefined` = pre-v2 record, no
   * outcome is computed and only `text` is shown (docs/db-stake-v2.sql). */
  thresholdMissed?: number;
  /** collective: group check-in target as a percentage. */
  collectiveTargetPct?: number;
  /** The "ödendi/kutlandı" ritual already happened. */
  settled?: boolean;
  options?: StakeOption[];
}

/** Structured result so the finish screen never has to parse the display
 * string. Computed client-side in src/data/stakeOutcome.ts — the same shape
 * `settle_stake` derives server-side when it writes the chat message. */
export interface StakeOutcome {
  kind: StakeKind;
  /** individual: everyone past the threshold. Empty = nobody pays. */
  losers: Participant[];
  collectiveHit?: boolean;
  collectiveTotal?: number;
  collectiveTarget?: number;
}

export interface Momentum {
  last3: number[]; // e.g. [6, 4, 2]
  total: number; // group size
  daysTogether: number; // "9 gün birlikte devam ettiniz."
}

export interface Challenge {
  id: string;
  title: string;
  dailyAction: string; // "Bugün: 20 sayfa oku"
  totalDays: number;
  currentDay: number; // 1-based; 0 for upcoming
  days: SegmentState[]; // length === totalDays
  status: ChallengeStatus;
  startsLabel?: string; // "Yarın başlıyor"
  meCheckedInToday: boolean;
  myCheckinTime?: string;
  myOrder?: number; // "Sen 5. tamamlayansın"
  jokerRemaining: number;
  /** The challenge's total joker allowance (owner's choice at creation) —
   * jokerRemaining alone can't show "2 of 3 left" without this. */
  jokerAllowance: number;
  /** Everything below is the raw day-math input the home-screen widget needs
   * to recompute "which day is it / did I check in TODAY" entirely on its
   * own (targets/widget/HalkoraWidget.swift). currentDay/meCheckedInToday
   * above are snapshots taken whenever the app last fetched — a widget
   * holding only those goes stale at midnight and can't tell, since a
   * WidgetKit extension can't re-run this mapping (saha testi bulgusu:
   * "tekrar uygulamaya girene kadar yeni güne widget geçmiyor").
   * `startDate` is null while status === 'lobby' (not started yet). */
  timezone: string;
  startDate: string | null; // "YYYY-MM-DD"
  createdAt: string; // ISO — FAST_DAYS test mode anchors its 1-minute days here
  /** Set when the challenge was ended EARLY — the day it actually stopped on.
   * The stake threshold counts against this, not `totalDays`, or every
   * unelapsed day would read as "missed" and the whole group would lose
   * (docs/db-stake-v2.sql §2). `undefined` for a challenge that ran its
   * natural course. */
  endedOnDay?: number;
  hasMissedYesterday: boolean;
  missedAcknowledged?: boolean;
  inviteCode: string;
  scheduleSummary: string; // "Her gün 20 sayfa · 14 gün"
  startsWhen: string; // "Yarın başlıyor"
  /** Kurucunun seçimi: true ise davet yalnızca 1. gün açık (Ek M). */
  firstDayJoinOnly: boolean;
  /** Viewer is this challenge's owner — gates the Detail screen's ⚙️ owner
   * settings entry (Faz 3C madde 3). Demo/pre-seeded mock challenges are
   * never editable this way (only ones created via the real create flow). */
  isOwner: boolean;
  /** dailyAction without the "Bugün:" prefix, for the owner edit sheet.
   * Only set where isOwner can ever be true (real challenges + freshly
   * created mock ones) — pre-seeded demo challenges never need it. */
  dailyActionRaw?: string;
  /** firstDayJoinOnly + 1. gün geçtiyse true — davet artık kapalı. */
  joinClosed: boolean;
  stake?: Stake;
  participants: Participant[];
  messages: Message[];
  momentum?: Momentum;
  // finish/E9
  finishStats?: { people: number; checkins: number; completionPct: number };
  // Halkora Pro — gelişmiş istatistikler (Faz 4). Yalnızca tamamlanmış
  // challenge'larda dolu; mevcut check_ins'ten hesaplanır, ekstra veri yok.
  advancedStats?: {
    perfectDays: number; // herkesin check-in yaptığı gün sayısı
    /** HANGİ günlerin kusursuz olduğu (1-tabanlı). Sayı tek başına halkayı
     * çizmeye yetmiyor: halka her yerde "hangi günler" demek, "kaç gün"
     * değil — ilk N segmenti doldurmak sahte bir takvim gösterirdi. */
    perfectDayNumbers: number[];
    leaderboard: {
      name: string;
      initials: string;
      completedDays: number;
      completionPct: number;
      longestStreak: number;
    }[];
  };
  /** Display string for the finish screen. Computed from the stake's
   * threshold/target once the challenge is completed; `undefined` for a
   * pre-v2 stake (then the raw `stake.text` is shown instead). */
  stakeResult?: string; // "☕ Kahveler Mehmet'ten"
  /** The same result, structured — lets complete.tsx decide whether to offer
   * the "ödendi" button without parsing `stakeResult`. */
  stakeOutcome?: StakeOutcome;
}
