import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { View } from 'react-native';
import { colors, fonts } from '@/theme/tokens';
import { AppText, FixedType } from './ui';
import { useT } from '@/i18n';
import type { Challenge } from '@/data/types';

/**
 * The invite/progress share card — the image that gets posted to a Story.
 *
 * Two variants, because the two moments are not the same card:
 *   A (invitation) — a ring that hasn't started. There is no progress, and a
 *     card reading "0/14" says "nothing has happened yet", which is useless as
 *     an invitation. So the ring is an empty frame with the start date in it,
 *     and the card is about who's already in and whether you'll join them.
 *   B (progress) — a ring already running or finished. The number is the
 *     GROUP's, never the sharer's own: this app has no individual score.
 *
 * Laid out at 360×640 logical points and captured at the device pixel ratio,
 * so a 3x phone produces the 1080×1920 the design specifies. Every measurement
 * below is the design's 1080-canvas number divided by three, kept as that
 * arithmetic rather than a rounded guess so the two stay comparable.
 */

export const STORY_W = 360;
export const STORY_H = 640;
export const SQUARE = 360;

/** 1080-canvas value → logical points. */
const u = (px: number) => px / 3;

const TYPE = {
  title: u(92),
  titleLine: u(101),
  action: u(46),
  invite: u(64),
  whoIsIn: u(40),
  meta: u(40),
  wordmark: u(34),
};

/**
 * The square puts the ring and the text side by side, so the text column is
 * roughly a third of the width the story gives it. Story sizes wrapped into
 * unreadable stacks there; these are the same hierarchy at a scale the column
 * can actually hold.
 */
const TYPE_SQUARE = {
  ...TYPE,
  title: u(64),
  titleLine: u(72),
  action: u(38),
  invite: u(46),
  whoIsIn: u(34),
  meta: u(34),
};

/**
 * Line-height factor for the ring's big numerals. Not a guess at Satoshi's
 * metrics — a margin wide enough that it doesn't matter what they are.
 */
const RING_LINE = 1.3;

const PAD = {
  edge: u(90),
  // Instagram's own UI covers the top and bottom ~250px of a story; these
  // clear it with room to spare.
  top: u(300),
  bottom: u(290),
};

const RING = {
  story: u(560),
  square: u(440),
  stroke: u(34),
};

/**
 * The card's ring is the LOGO, not a day chart.
 *
 * One arc per day looked right at 7 and fell apart past 21 — at 30 the arcs
 * were thinner than the gaps between them and the circle read as noise (saha
 * testi bulgusu). And a share image doesn't need to be countable: nobody
 * squints at a Story to tally segments, the number in the middle already says
 * it. So the ring keeps the mark's own eight-segment geometry at every length,
 * exactly as the app icon and the boot animation draw it, and progress is
 * mapped onto those eight.
 */
const LOGO_SEGMENTS = 8;
/**
 * The share ring's own geometry, matched to the app's.
 *
 * It used to borrow the wordmark's 12° gaps, and that is twice what
 * ProgressRing draws on every screen (6°) — so the card's ring read as a
 * different, airier object than the one people had been looking at all week
 * (saha testi bulgusu — "parçaların arası çok açık, uygulamanın diğer
 * noktalarında gösterdiğimiz görsellerle aynı değil"). The wordmark keeps
 * the logo's spacing below; it IS the logo.
 */
const RING_GAP = 6;
const RING_SPAN = 360 / 8 - RING_GAP;

/** Straight from the wordmark below: 33° of arc, 12° of gap. */
const LOGO_SPAN = 33;
const LOGO_GAP = 12;

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const p = (a: number) => {
    const rad = ((a - 90) * Math.PI) / 180;
    return `${(cx + r * Math.cos(rad)).toFixed(2)} ${(cy + r * Math.sin(rad)).toFixed(2)}`;
  };
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${p(a0)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 ${large} 1 ${p(a1)}`;
}

/**
 * The ring, drawn to the share spec rather than reused from ProgressRing —
 * that one owns the in-app geometry (6° gaps, its own size presets) and is on
 * every screen in the app. Giving it a second personality for one card would
 * put every screen at risk for no gain.
 */
function ShareRing({
  size,
  totalDays,
  filledDays,
  empty,
  children,
}: {
  size: number;
  totalDays: number;
  filledDays: number;
  /** Variant A: no progress claim, just the frame and a start mark. */
  empty?: boolean;
  children: React.ReactNode;
}) {
  const stroke = RING.stroke;
  const r = size / 2 - stroke / 2;
  const cx = size / 2;
  const cy = size / 2;
  const step = 360 / LOGO_SEGMENTS;

  // Days mapped onto the eight. Ceil rather than round so a single day in
  // shows as one lit segment instead of rounding away to an untouched ring —
  // the difference between "we've begun" and "nothing yet".
  const lit = empty
    ? 0
    : filledDays <= 0
      ? 0
      : Math.min(LOGO_SEGMENTS, Math.max(1, Math.ceil((filledDays / totalDays) * LOGO_SEGMENTS)));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {Array.from({ length: LOGO_SEGMENTS }, (_, i) => (
          <Path
            key={i}
            d={arcPath(cx, cy, r, i * step + RING_GAP / 2, i * step + RING_GAP / 2 + RING_SPAN)}
            stroke={i < lit ? colors.ember : colors.waiting}
            strokeWidth={stroke}
            // Butt, like every other ring in the app — the home cards, the
            // detail screen, the boot chase and the widget all draw square
            // ends. Round ones here made the share card read as a different
            // product's artwork.
            strokeLinecap="butt"
            fill="none"
          />
        ))}
      </Svg>
      {children}
    </View>
  );
}

/** Small initial bubbles, capped, with a "+N" chip like the design's row. */
function Faces({ challenge, max = 4 }: { challenge: Challenge; max?: number }) {
  const people = challenge.participants.slice(0, max);
  const extra = challenge.participants.length - people.length;
  const D = u(56);
  return (
    <View style={{ flexDirection: 'row' }}>
      {people.map((p, i) => (
        <View
          key={p.id ?? i}
          style={{
            width: D,
            height: D,
            borderRadius: D / 2,
            backgroundColor: colors.bgElevated,
            borderWidth: 1.5,
            borderColor: colors.bgBase,
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: i === 0 ? 0 : -u(18),
          }}
        >
          <AppText style={{ fontFamily: fonts.bodyMedium, fontSize: u(24), color: colors.textSecondary }}>
            {p.initials}
          </AppText>
        </View>
      ))}
      {extra > 0 ? (
        <View
          style={{
            width: D,
            height: D,
            borderRadius: D / 2,
            backgroundColor: colors.emberSoft,
            borderWidth: 1.5,
            borderColor: colors.bgBase,
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: -u(18),
          }}
        >
          <AppText style={{ fontFamily: fonts.bodyMedium, fontSize: u(22), color: colors.ember }}>
            +{extra}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

function Wordmark() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: u(18) }}>
      <Svg width={u(34)} height={u(34)}>
        {Array.from({ length: LOGO_SEGMENTS }, (_, i) => (
          <Path
            key={i}
            d={arcPath(u(17), u(17), u(13), i * 45 + LOGO_GAP / 2, i * 45 + LOGO_GAP / 2 + LOGO_SPAN)}
            stroke={colors.ember}
            strokeWidth={u(7)}
            strokeLinecap="butt"
            fill="none"
          />
        ))}
      </Svg>
      <AppText style={{ fontFamily: fonts.displaySemibold, fontSize: TYPE.wordmark, color: colors.textPrimary }}>
        halkora
      </AppText>
    </View>
  );
}

/** The vertical background wash the design calls for (#101116 → #0D0E11). */
function Backdrop({ w, h }: { w: number; h: number }) {
  return (
    <Svg width={w} height={h} style={{ position: 'absolute' }}>
      <Defs>
        <LinearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#101116" />
          <Stop offset="1" stopColor={colors.bgBase} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={w} height={h} fill="url(#bg)" />
    </Svg>
  );
}

export type InviteCardFormat = 'story' | 'square';

/**
 * `startsLabel` is passed in rather than derived here: the app already knows
 * how to say "Yarın" / "15 Ağustos" in the viewer's language (src/lib/day.ts),
 * and a second date formatter would be a second thing to keep in step.
 */
export function InviteCard({
  challenge,
  format,
}: {
  challenge: Challenge;
  format: InviteCardFormat;
}) {
  const { t } = useT();
  const w = format === 'story' ? STORY_W : SQUARE;
  const h = format === 'story' ? STORY_H : SQUARE;
  const type = format === 'story' ? TYPE : TYPE_SQUARE;

  // Variant A whenever the ring hasn't begun — a lobby or a future start date.
  const invite = challenge.status === 'lobby' || challenge.status === 'upcoming';
  const done = challenge.days.filter((d) => d === 'done' || d === 'joker').length;
  const finished = challenge.status === 'completed';
  const alone = challenge.participants.length <= 1;
  // A lobby ring has no start date yet, so the ring's centre showed the
  // words "Kurucu başlatacak" at headline size — a long phrase crammed into
  // a circle, with the one fact a stranger actually needs (how long this
  // runs) pushed into the small line under it. For these the day count is
  // the headline and the missing date is stated plainly instead.
  const undated = challenge.status === 'lobby';
  /**
   * A ring whose join window has shut. The detail menu already hides "invite"
   * for this, but the shared card still said "katılabilirsin" — an image
   * inviting people into something they cannot enter (saha testi bulgusu —
   * "sanki birini davet edebilecekmişim gibi").
   */
  const joinsClosed = !!challenge.firstDayJoinOnly && challenge.currentDay > 1;
  /** The ring's big line, and the day counter that shares its slot. */
  const counter = format === 'square' ? u(84) : u(112);
  const headline = undated ? counter : format === 'square' ? u(52) : u(72);
  const owner = challenge.participants[0]?.name ?? '';

  const ringSize = format === 'story' ? RING.story : RING.square;

  // In the square the ring is only 147pt across with the text beside it, and
  // "15 Ağustos'ta başlıyor" simply does not fit inside that circle — it spilled
  // out over the ring's own stroke. There the line moves up into the text
  // column instead, where it has the width it needs. An undated ring says
  // "7 gün", which does fit, so it stays in the middle where the eye is.
  const dateInsideRing = format === 'story' || undated;

  const ring = (
    <ShareRing size={ringSize} totalDays={challenge.totalDays} filledDays={done} empty={invite}>
      {invite && !dateInsideRing ? null : invite ? (
        <View style={{ alignItems: 'center' }}>
          <AppText
            style={{
              fontFamily: fonts.displaySemibold,
              fontSize: headline,
              // Explicit, because Satoshi's ascenders are taller than the
              // line box React Native derives on its own — the top of "0/14"
              // was sliced off in both formats, obviously in the story where
              // the type is largest and subtly in the square. RING_LINE is
              // deliberately generous: the ring has vertical room to spare,
              // and a clipped glyph is a far worse error than a loose line.
              lineHeight: headline * RING_LINE,
              color: colors.textPrimary,
              letterSpacing: undated ? -1 : -0.5,
              textAlign: 'center',
            }}
          >
            {undated
              ? t.shareCard.dayCount(challenge.totalDays)
              : (challenge.startsLabel ?? challenge.startsWhen ?? '')}
          </AppText>
          <AppText
            numberOfLines={2}
            style={{
              fontFamily: fonts.bodyRegular,
              fontSize: type.meta,
              color: colors.textTertiary,
              marginTop: u(10),
              maxWidth: ringSize * 0.72,
              textAlign: 'center',
            }}
          >
            {undated ? t.shareCard.startSoon : t.shareCard.startsIn(challenge.totalDays)}
          </AppText>
        </View>
      ) : (
        <View style={{ alignItems: 'center' }}>
          <AppText
            style={{
              fontFamily: fonts.displaySemibold,
              fontSize: counter,
              lineHeight: counter * RING_LINE,
              color: finished ? colors.ember : colors.textPrimary,
              letterSpacing: -1,
              textAlign: 'center',
            }}
          >
            {done}/{challenge.totalDays}
          </AppText>
          <AppText
            numberOfLines={1}
            style={{ fontFamily: fonts.bodyRegular, fontSize: type.meta, color: colors.textTertiary, marginTop: u(6), maxWidth: ringSize * 0.8 }}
          >
            {finished ? challenge.title : t.shareCard.together}
          </AppText>
        </View>
      )}
    </ShareRing>
  );

  const head = (
    <View style={{ alignItems: format === 'story' ? 'center' : 'flex-start' }}>
      {invite ? (
        alone ? (
          <AppText style={{ fontFamily: fonts.bodyRegular, fontSize: type.whoIsIn, color: colors.textSecondary, marginBottom: u(14) }}>
            {t.shareCard.startedAlone(owner)}
          </AppText>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: u(20), marginBottom: u(14) }}>
            <Faces challenge={challenge} />
            <AppText style={{ fontFamily: fonts.bodyRegular, fontSize: type.whoIsIn, color: colors.textSecondary }}>
              {t.shareCard.peopleIn(challenge.participants.length)}
            </AppText>
          </View>
        )
      ) : null}

      {invite && !dateInsideRing ? (
        <AppText
          style={{
            fontFamily: fonts.bodyMedium,
            fontSize: type.meta,
            color: colors.ember,
            marginBottom: u(10),
          }}
        >
          {challenge.startsLabel ?? challenge.startsWhen ?? ''} · {t.shareCard.dayCount(challenge.totalDays)}
        </AppText>
      ) : null}

      {finished ? (
        <AppText
          style={{
            fontFamily: fonts.displaySemibold,
            fontSize: type.title,
            lineHeight: type.titleLine,
            color: colors.textPrimary,
            letterSpacing: -type.title * 0.02,
            textAlign: format === 'story' ? 'center' : 'left',
          }}
        >
          {t.shareCard.finishedHeadline(challenge.totalDays)}
        </AppText>
      ) : (
        <>
          <AppText
            numberOfLines={2}
            style={{
              fontFamily: fonts.displaySemibold,
              fontSize: type.title,
              lineHeight: type.titleLine,
              color: colors.textPrimary,
              letterSpacing: -type.title * 0.02,
              textAlign: format === 'story' ? 'center' : 'left',
            }}
          >
            {challenge.title}
          </AppText>
          <AppText
            numberOfLines={1}
            style={{
              fontFamily: fonts.bodyRegular,
              fontSize: type.action,
              color: colors.textSecondary,
              marginTop: u(12),
              textAlign: format === 'story' ? 'center' : 'left',
            }}
          >
            {challenge.dailyActionRaw ?? ''}
          </AppText>
        </>
      )}
    </View>
  );

  const foot = (
    <View style={{ alignItems: format === 'story' ? 'center' : 'flex-start' }}>
      {!invite && !finished ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: u(20), marginBottom: u(22) }}>
          <Faces challenge={challenge} />
          <AppText style={{ fontFamily: fonts.bodyRegular, fontSize: type.meta, color: colors.textSecondary }}>
            {t.shareCard.groupMeta(challenge.participants.length, done)}
          </AppText>
        </View>
      ) : null}

      <AppText
        style={{
          fontFamily: fonts.displaySemibold,
          fontSize: type.invite,
          color: colors.textPrimary,
          textAlign: format === 'story' ? 'center' : 'left',
        }}
      >
        {invite
          ? alone
            ? t.shareCard.askAlone
            : t.shareCard.askGroup
          : finished
            ? t.shareCard.closed
            : joinsClosed
              ? t.shareCard.joinClosed
              : t.shareCard.stillOpen}
      </AppText>

      <AppText
        style={{
          fontFamily: fonts.bodyRegular,
          fontSize: type.meta,
          color: colors.textTertiary,
          marginTop: u(14),
          textAlign: format === 'story' ? 'center' : 'left',
        }}
      >
        {/* The code is never printed on the image — a story screenshot would
            let anyone into a group that never invited them. The link travels
            as text beside the image instead. */}
        {t.shareCard.linkBeside}
      </AppText>

      <View style={{ marginTop: u(34) }}>
        <Wordmark />
      </View>
    </View>
  );

  // Both formats are a fixed w x h box captured to an image, so nothing in
  // them may follow the system text-size setting — the box cannot grow with
  // the text, so scaled type overflows the card that gets shared.
  if (format === 'square') {
    return (
      <FixedType>
      <View style={{ width: w, height: h, overflow: 'hidden' }}>
        <Backdrop w={w} h={h} />
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: u(50),
            paddingHorizontal: PAD.edge,
          }}
        >
          {ring}
          <View style={{ flex: 1 }}>
            {head}
            <View style={{ height: u(40) }} />
            {foot}
          </View>
        </View>
      </View>
      </FixedType>
    );
  }

  return (
    <FixedType>
    <View style={{ width: w, height: h, overflow: 'hidden' }}>
      <Backdrop w={w} h={h} />
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: PAD.edge,
          paddingTop: PAD.top,
          paddingBottom: PAD.bottom,
        }}
      >
        {head}
        {ring}
        {foot}
      </View>
    </View>
    </FixedType>
  );
}
