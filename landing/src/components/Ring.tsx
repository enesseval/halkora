'use client';

import { motion, useTransform, type MotionValue } from 'framer-motion';

/**
 * The signature segmented progress ring, ported 1:1 from the app's design
 * system (desing_files/Design System.dc.html): N equal arc segments with a
 * gap between them. Filled = ember, joker = amber, waiting = neutral.
 * "Today" is a thin ember overlay that breathes on a 2s pulse.
 */
export type SegState = 'filled' | 'joker' | 'waiting' | 'today';

const SEG_COLORS: Record<SegState, string> = {
  filled: '#FF6B47',
  joker: '#E0B34C',
  waiting: '#3A3F4A',
  today: '#3A3F4A',
};

function pt(c: number, r: number, deg: number): string {
  const a = (deg * Math.PI) / 180;
  return `${(c + r * Math.cos(a)).toFixed(2)} ${(c + r * Math.sin(a)).toFixed(2)}`;
}

export function segmentPaths(
  total: number,
  size: number,
  stroke: number,
  gapDeg: number,
): string[] {
  const c = size / 2;
  const r = (size - stroke) / 2;
  const span = 360 / total;
  const out: string[] = [];
  for (let i = 0; i < total; i++) {
    const a0 = -90 + i * span + gapDeg / 2;
    const a1 = -90 + (i + 1) * span - gapDeg / 2;
    const large = a1 - a0 > 180 ? 1 : 0;
    out.push(`M ${pt(c, r, a0)} A ${r} ${r} 0 ${large} 1 ${pt(c, r, a1)}`);
  }
  return out;
}

export function buildStates(
  total: number,
  filledTo: number,
  opts: { joker?: number; today?: number; missed?: number[] } = {},
): SegState[] {
  const { joker = -1, today = -1, missed = [] } = opts;
  return Array.from({ length: total }, (_, i) => {
    let s: SegState = i < filledTo ? 'filled' : 'waiting';
    if (missed.includes(i)) s = 'waiting';
    if (i === joker) s = 'joker';
    if (i === today) s = 'today';
    return s;
  });
}

type StaticRingProps = {
  states: SegState[];
  size?: number;
  stroke?: number;
  gap?: number;
  pulse?: boolean;
  /** Segments fade in one by one on mount (used in the hero). */
  staggerIn?: boolean;
  className?: string;
};

export function StaticRing({
  states,
  size = 160,
  stroke = 10,
  gap = 3,
  pulse = true,
  staggerIn = false,
  className,
}: StaticRingProps) {
  const paths = segmentPaths(states.length, size, stroke, gap);
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      aria-hidden="true"
    >
      {paths.map((d, i) => {
        const state = states[i];
        return (
          <g key={i}>
            {staggerIn ? (
              <motion.path
                d={d}
                stroke={SEG_COLORS[state]}
                strokeWidth={stroke}
                fill="none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 + i * 0.055, duration: 0.4 }}
              />
            ) : (
              <path
                d={d}
                stroke={SEG_COLORS[state]}
                strokeWidth={stroke}
                fill="none"
              />
            )}
            {state === 'today' && (
              <path
                d={d}
                stroke="#FF6B47"
                strokeWidth={Math.max(1.5, stroke * 0.3)}
                fill="none"
                className={pulse ? 'animate-ring-pulse' : undefined}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

type ScrollRingProps = {
  /** 0 → empty ring, 1 → fully closed. Drives each segment in turn. */
  progress: MotionValue<number>;
  total?: number;
  size?: number;
  stroke?: number;
  gap?: number;
  joker?: number;
  className?: string;
};

function ScrollSegment({
  d,
  index,
  total,
  stroke,
  progress,
  joker,
}: {
  d: string;
  index: number;
  total: number;
  stroke: number;
  progress: MotionValue<number>;
  joker: boolean;
}) {
  // Segment `index` fills within its own narrow window of the overall
  // progress, so the ring lights up day by day as you scroll.
  const start = (index + 0.55) / total;
  const end = (index + 1) / total;
  const opacity = useTransform(progress, [start, end], [0, 1]);
  return (
    <g>
      <path d={d} stroke="#3A3F4A" strokeWidth={stroke} fill="none" />
      <motion.path
        d={d}
        stroke={joker ? '#E0B34C' : '#FF6B47'}
        strokeWidth={stroke}
        fill="none"
        style={{ opacity }}
      />
    </g>
  );
}

export function ScrollRing({
  progress,
  total = 14,
  size = 360,
  stroke = 14,
  gap = 3,
  joker,
  className,
}: ScrollRingProps) {
  const paths = segmentPaths(total, size, stroke, gap);
  const c = size / 2;
  const r = (size - stroke) / 2;

  // Ember head that rides the fill line; doubles as the "start marker" at
  // 12 o'clock when the ring is still empty (a promise, not a failure).
  const angle = useTransform(progress, (p) => (-90 + 360 * p) * (Math.PI / 180));
  const headX = useTransform(angle, (a) => r * Math.cos(a));
  const headY = useTransform(angle, (a) => r * Math.sin(a) + r);
  const headOpacity = useTransform(progress, [0.985, 1], [1, 0]);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      aria-hidden="true"
    >
      {paths.map((d, i) => (
        <ScrollSegment
          key={i}
          d={d}
          index={i}
          total={total}
          stroke={stroke}
          progress={progress}
          joker={joker === i}
        />
      ))}
      <motion.circle
        cx={c}
        cy={c - r}
        r={stroke * 0.8}
        fill="#FF6B47"
        style={{ x: headX, y: headY, opacity: headOpacity }}
      />
    </svg>
  );
}

/** The brand mark: a small 8-segment ring, 3 filled, 1 joker. */
export function RingMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <StaticRing
      states={buildStates(8, 3, { joker: 3 })}
      size={size}
      stroke={Math.max(2.5, size * 0.14)}
      gap={8}
      pulse={false}
      className={className}
    />
  );
}
