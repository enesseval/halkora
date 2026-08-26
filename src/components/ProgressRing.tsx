import { ReactNode, useEffect, useRef } from 'react';
import { GestureResponderEvent, Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors } from '@/theme/tokens';
import { SegmentState } from '@/data/types';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export type RingSize = 'L' | 'M' | 'S';

interface Props {
  totalDays: number;
  days: SegmentState[];
  size: RingSize;
  /** index of the current day segment (the one that animates on check-in) */
  activeIndex?: number;
  centerContent?: ReactNode;
  /** override the preset diameter/stroke (e.g. 44px completed-card ring) */
  diameter?: number;
  strokeWidth?: number;
  /** Day numbers (1-based) a joker could still repair. They get a faint amber
   * hint so a tappable gap is distinguishable from a day that simply hasn't
   * arrived yet — without ever marking a missed day red. */
  repairableDays?: number[];
  /** Called with the 1-based day number when a repairable segment is tapped.
   * Taps anywhere else on the ring are ignored. */
  onRepairDayPress?: (dayNumber: number) => void;
  /** This ring shows no real progress — it's the boot animation. Suppresses
   * the check-in celebration, which only makes sense when a person actually
   * completed something. */
  decorative?: boolean;
}

/** The today segment's breath, dim end to bright end. */
const BREATH_DIM = 0.32;
const BREATH_BRIGHT = 0.55;
/** What a segment that never breathes sits at — the boot chase's lead. */
const BREATH_LEAD = 0.4;

const DIM: Record<RingSize, { px: number; stroke: number }> = {
  L: { px: 180, stroke: 11 },
  M: { px: 72, stroke: 6 },
  S: { px: 28, stroke: 3 },
};

function colorFor(state: SegmentState): string {
  switch (state) {
    case 'done':
      return colors.ember;
    case 'joker':
      return colors.joker;
    case 'today':
      return colors.ember;
    // missed and empty are intentionally identical — never red.
    default:
      return colors.waiting;
  }
}

/** point on the circle at `angleDeg` measured clockwise from the top */
function pointAt(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string {
  const s = pointAt(cx, cy, r, startDeg);
  const e = pointAt(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`;
}

interface SegProps {
  d: string;
  length: number;
  state: SegmentState;
  isActive: boolean;
  stroke: number;
  repairable?: boolean;
  decorative?: boolean;
}

function Segment({ d, length, state, isActive, stroke, repairable, decorative }: SegProps) {
  const filled = state === 'done' || state === 'joker';
  // opacity of the colored overlay; dashoffset controls the "sweep" fill.
  const op = useSharedValue(filled ? 1 : state === 'today' ? BREATH_DIM : 0);
  const offset = useSharedValue(filled ? 0 : length);
  const prev = useRef<SegmentState>(state);

  useEffect(() => {
    const was = prev.current;
    prev.current = state;

    cancelAnimation(op);

    if (state === 'today') {
      // Breathing outline. One timing played back and forth (reverse: true)
      // rather than a two-step sequence repeated forward: a repeated sequence
      // restarts from the top on every iteration instead of continuing from
      // where it ended, which puts a hard step at the seam — the segment
      // snapped dark and then eased back up, once per cycle. Ping-ponging a
      // single timing has no seam to step across.
      offset.value = 0;
      // The boot chase moves a segment through 'today' in 260ms, far less
      // than one breath, so all a breath does there is catch it mid-fade at
      // whatever value the timing had reached — the lead segment came out
      // dimmer than it used to be and the chase lost its shape. A decorative
      // ring gets a fixed lead instead, for the same reason it gets no
      // check-in pulse: there is nothing here to celebrate or to wait for.
      if (decorative) {
        op.value = BREATH_LEAD;
        return;
      }
      // Anchored explicitly, because the ping-pong runs between the value at
      // the moment it starts and the target. A segment arriving here from
      // 'empty' at a day rollover sits at 0 and would otherwise breathe
      // across the wrong range.
      op.value = BREATH_DIM;
      op.value = withRepeat(
        withTiming(BREATH_BRIGHT, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
      return;
    }

    if (state === 'done' && was === 'today') {
      // check-in: sweep fill (400ms) then a short brightness pulse
      op.value = 1;
      offset.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) });
      // The pulse celebrates a check-in someone just made. On a decorative
      // ring every segment crosses today→done as the chase goes round, and
      // the pulse runs 550ms against a 260ms step — so a segment is still
      // dimming and brightening while two more fill behind it, which reads as
      // random flicker (saha testi bulgusu: "3. halka dolarken 1. halkanın
      // rengi kapanıp açılıyor"). Nothing to celebrate here, so no pulse.
      if (!decorative) {
        op.value = withSequence(
          withTiming(1, { duration: 400 }),
          withTiming(0.7, { duration: 75 }),
          withTiming(1, { duration: 75 }),
        );
      }
      return;
    }

    if (state === 'joker' && was === 'missed') {
      // joker used: amber fades/sweeps in
      op.value = withTiming(1, { duration: 300 });
      offset.value = withTiming(0, { duration: 350, easing: Easing.out(Easing.cubic) });
      return;
    }

    // static
    op.value = filled ? 1 : 0;
    offset.value = filled ? 0 : length;
  }, [state, filled, length, op, offset, decorative]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: offset.value,
    strokeOpacity: op.value,
  }));

  return (
    <>
      {/* base track — always visible so empty/missed read as neutral */}
      <Path
        d={d}
        stroke={colors.waiting}
        strokeWidth={stroke}
        strokeLinecap="butt"
        fill="none"
      />
      {/* "a joker still fits here" — deliberately faint. It reads as an open
          slot inviting a tap, not as a red mark against the day. */}
      {repairable ? (
        <Path
          d={d}
          stroke={colors.joker}
          strokeWidth={stroke}
          strokeLinecap="butt"
          strokeOpacity={0.3}
          fill="none"
        />
      ) : null}
      {/* colored overlay */}
      <AnimatedPath
        d={d}
        stroke={colorFor(state === 'today' ? 'today' : state)}
        strokeWidth={stroke}
        strokeLinecap="butt"
        fill="none"
        strokeDasharray={[length, length + 1]}
        animatedProps={animatedProps}
      />
    </>
  );
}

export function ProgressRing({
  totalDays,
  days,
  size,
  activeIndex,
  centerContent,
  diameter,
  strokeWidth,
  repairableDays,
  onRepairDayPress,
  decorative,
}: Props) {
  const base = DIM[size];
  const px = diameter ?? base.px;
  const baseStroke = strokeWidth ?? base.stroke;
  // thinner strokes for long challenges so the circle never distorts
  const stroke =
    strokeWidth == null && totalDays >= 21
      ? Math.max(baseStroke - 2, 2)
      : baseStroke;
  const cx = px / 2;
  const cy = px / 2;
  const r = px / 2 - stroke / 2 - 1;

  const gapDeg = Math.min(6, Math.max(2, 90 / totalDays));
  const step = 360 / totalDays;
  const span = step - gapDeg;
  const length = (r * span * Math.PI) / 180;

  const repairable = new Set(repairableDays ?? []);
  const tappable = onRepairDayPress != null && repairable.size > 0;

  /**
   * Resolve a touch to a day. Per-segment hit targets would be ~18px apart on
   * a 30-day ring and would have to overlap to be thumb-sized, so instead the
   * whole ring takes the touch and the segment is derived from its angle —
   * exact at any day count.
   */
  const handlePress = (e: GestureResponderEvent) => {
    if (!onRepairDayPress) return;
    // locationX/Y are relative to whichever view took the touch. That is
    // either this Pressable or the Svg inside it — and the Svg is laid out
    // exactly on top of the Pressable's box (same size, at 0,0), so both give
    // the same numbers. Keep them coincident if this layout ever changes.
    const { locationX, locationY } = e.nativeEvent;
    const dx = locationX - cx;
    const dy = locationY - cy;
    const dist = Math.hypot(dx, dy);
    // Only the ring band itself, generously padded for fingers. Taps that land
    // in the middle belong to the check-in button, not to a day.
    const band = Math.max(stroke * 2.5, 22);
    if (dist < r - band || dist > r + band) return;
    // Angle clockwise from 12 o'clock, matching how the arcs are laid out.
    const deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    const norm = ((deg % 360) + 360) % 360;
    const day = Math.floor(norm / step) + 1;
    if (!repairable.has(day)) return;
    onRepairDayPress(day);
  };

  const body = (
    <>
      <Svg
        width={px}
        height={px}
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        {Array.from({ length: totalDays }).map((_, i) => {
          const start = i * step + gapDeg / 2;
          const end = start + span;
          const d = arcPath(cx, cy, r, start, end);
          const state = days[i] ?? 'empty';
          return (
            <Segment
              decorative={decorative}
              key={i}
              d={d}
              length={length}
              state={state}
              isActive={i === activeIndex}
              stroke={stroke}
              repairable={repairable.has(i + 1)}
            />
          );
        })}
      </Svg>
      {centerContent ? (
        // box-none: the wrapper covers the whole ring, so it must let ring
        // taps fall through to the Pressable below while its own children
        // (the check-in button) still receive theirs.
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {centerContent}
        </View>
      ) : null}
    </>
  );

  const boxStyle = {
    width: px,
    height: px,
    alignItems: 'center',
    justifyContent: 'center',
  } as const;

  if (!tappable) return <View style={boxStyle}>{body}</View>;

  return (
    <Pressable style={boxStyle} onPress={handlePress}>
      {body}
    </Pressable>
  );
}
