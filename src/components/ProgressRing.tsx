import { ReactNode, useEffect, useRef } from 'react';
import { View } from 'react-native';
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
}

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
}

function Segment({ d, length, state, isActive, stroke }: SegProps) {
  const filled = state === 'done' || state === 'joker';
  // opacity of the colored overlay; dashoffset controls the "sweep" fill.
  const op = useSharedValue(filled ? 1 : state === 'today' ? 0.4 : 0);
  const offset = useSharedValue(filled ? 0 : length);
  const prev = useRef<SegmentState>(state);

  useEffect(() => {
    const was = prev.current;
    prev.current = state;

    cancelAnimation(op);

    if (state === 'today') {
      // breathing outline
      offset.value = 0;
      op.value = withRepeat(
        withSequence(
          withTiming(0.55, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.32, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
      return;
    }

    if (state === 'done' && was === 'today') {
      // check-in: sweep fill (400ms) then a short brightness pulse
      op.value = 1;
      offset.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) });
      op.value = withSequence(
        withTiming(1, { duration: 400 }),
        withTiming(0.7, { duration: 75 }),
        withTiming(1, { duration: 75 }),
      );
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
  }, [state, filled, length, op, offset]);

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

  return (
    <View
      style={{ width: px, height: px, alignItems: 'center', justifyContent: 'center' }}
    >
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
              key={i}
              d={d}
              length={length}
              state={state}
              isActive={i === activeIndex}
              stroke={stroke}
            />
          );
        })}
      </Svg>
      {centerContent ? (
        <View
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
    </View>
  );
}
