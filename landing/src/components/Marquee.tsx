'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { StaticRing, buildStates } from './Ring';

/**
 * Two strips of example challenges, scrubbed in opposite directions by the
 * page scroll — the "cards go left and right" beat.
 */
export default function Marquee() {
  const t = useTranslations('marquee');
  const row1 = t.raw('row1') as string[];
  const row2 = t.raw('row2') as string[];

  const { scrollYProgress } = useScroll();
  const x1 = useTransform(scrollYProgress, [0, 1], ['2%', '-16%']);
  const x2 = useTransform(scrollYProgress, [0, 1], ['-16%', '2%']);

  return (
    <section className="mask-fade-x overflow-hidden border-y border-line/60 py-8">
      <motion.div style={{ x: x1 }} className="mb-3 flex w-max gap-3 pl-4">
        {[...row1, ...row1].map((label, i) => (
          <Chip key={`a-${i}`} label={label} filled={(i % 8) + 2} />
        ))}
      </motion.div>
      <motion.div style={{ x: x2 }} className="flex w-max gap-3 pl-4">
        {[...row2, ...row2].map((label, i) => (
          <Chip key={`b-${i}`} label={label} filled={(i % 8) + 2} />
        ))}
      </motion.div>
    </section>
  );
}

function Chip({ label, filled }: { label: string; filled: number }) {
  return (
    <span className="flex items-center gap-2.5 whitespace-nowrap rounded-full border border-line bg-surface px-4 py-2 text-[14px] text-muted">
      <StaticRing
        states={buildStates(8, filled)}
        size={16}
        stroke={3}
        gap={8}
        pulse={false}
      />
      {label}
    </span>
  );
}
