import { Platform, TextStyle } from 'react-native';

/**
 * THE CHALLENGE — Design Tokens (single source of truth)
 * Dark-first. One accent (ember). No red anywhere. Missed day == empty day.
 * Every color used in the app MUST come from here — no hardcoded hex in screens.
 */

export const colors = {
  bgBase: '#0D0E11',
  bgSurface: '#15171C',
  bgElevated: '#1D2027',
  strokeSubtle: '#262A33',
  textPrimary: '#F4F5F7',
  textSecondary: '#9AA0AC',
  textTertiary: '#5D6370',
  ember: '#FF6B47',
  emberSoft: 'rgba(255,107,71,0.12)',
  joker: '#E0B34C',
  jokerSoft: 'rgba(224,179,76,0.12)',
  waiting: '#3A3F4A',
  // pure black scrim for sheets / modals
  scrim: 'rgba(6,7,9,0.72)',
} as const;

export const radius = {
  card: 24,
  pill: 28,
  badge: 12,
  sheet: 32,
  sheetLow:10,
} as const;

export const spacing = {
  screenX: 20,
  cardPad: 20,
  section: 32,
} as const; // 4pt grid

/** Font family keys — must match the names registered in app/_layout.tsx */
export const fonts = {
  displaySemibold: 'GeneralSans-Semibold',
  displayBold: 'GeneralSans-Bold',
  displayMedium: 'GeneralSans-Medium',
  bodyRegular: 'Satoshi-Regular',
  bodyMedium: 'Satoshi-Medium',
  bodyBold: 'Satoshi-Bold',
} as const;

/** Tabular figures — apply to every number so counters/rings never jitter. */
export const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

/**
 * Type scale (pt). Display styles use General Sans with -2% tracking.
 * Body styles use Satoshi.
 */
export const type = {
  hero: {
    fontFamily: fonts.displayBold,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.68,
    color: colors.textPrimary,
  },
  screenTitle: {
    fontFamily: fonts.displaySemibold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.56,
    color: colors.textPrimary,
  },
  cardAction: {
    fontFamily: fonts.displaySemibold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.4,
    color: colors.textPrimary,
  },
  body: {
    fontFamily: fonts.bodyRegular,
    fontSize: 17,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  bodyMedium: {
    fontFamily: fonts.bodyMedium,
    fontSize: 17,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  secondary: {
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  meta: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textTertiary,
  },
} satisfies Record<string, TextStyle>;

/** Hairline used for the 1px stroke that builds depth instead of shadows. */
export const hairline = Platform.select({ ios: 0.5, default: 1 }) as number;
