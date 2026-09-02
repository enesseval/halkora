'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { StaticRing, buildStates } from './Ring';

/**
 * The calm statement. Scales up past 100% as it crosses the viewport center
 * and settles back as it leaves — the "grow and shrink" beat.
 */
export default function Quote() {
  const t = useTranslations('quote');
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.9, 1.03, 0.94]);
  const opacity = useTransform(scrollYProgress, [0, 0.28, 0.78, 1], [0, 1, 1, 0.15]);
  const y = useTransform(scrollYProgress, [0, 0.5, 1], [60, 0, -40]);

  return (
    <section ref={ref} className="relative overflow-hidden px-6 py-40 sm:py-56">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <StaticRing
          states={buildStates(21, 21)}
          size={620}
          stroke={10}
          gap={5}
          pulse={false}
          className="animate-rotate-slow opacity-[0.13]"
        />
      </div>
      <motion.p
        style={{ scale, opacity, y }}
        className="relative mx-auto max-w-4xl text-center font-display text-4xl font-semibold leading-[1.15] tracking-[-0.02em] sm:text-6xl"
      >
        {t('line')}
      </motion.p>
    </section>
  );
}
