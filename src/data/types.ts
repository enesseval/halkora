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

export interface Stake {
  mode: StakeMode;
  text: string; // headline shown in StakeBadge
  options?: StakeOption[];
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
    leaderboard: {
      name: string;
      initials: string;
      completedDays: number;
      completionPct: number;
      longestStreak: number;
    }[];
  };
  stakeResult?: string; // "☕ Kahveler Mehmet'ten"
}
