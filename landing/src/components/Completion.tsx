'use client';

import { useEffect, useRef } from 'react';
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useTransform,
} from 'framer-motion';
import { useTranslations } from 'next-intl';
import { StaticRing, buildStates } from './Ring';

/** Number that springs up from 0 once it scrolls into view. */
function Count({
  to,
  prefix = '',
  suffix = '',
}: {
  to: number;
  prefix?: string;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => `${prefix}${Math.round(v)}${suffix}`);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(mv, to, { type: 'spring', stiffness: 55, damping: 18 });
    return () => controls.stop();
  }, [inView, mv, to]);

  return <motion.span ref={ref}>{text}</motion.span>;
}

/**
 * The payoff: a closed ring, quiet stats, and the "flawless days" record.
 * The ring arrives already complete — completion settles, it doesn't pop.
 */
export default function Completion() {
  const t = useTranslations('done');

  return (
    <section className="mx-auto max-w-4xl px-6 py-28 text-center sm:py-40">
      <motion.span
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="inline-block rounded-xl bg-ember-soft px-3.5 py-2 font-display text-[13px] font-semibold text-ember"
      >
        {t('chip')}
      </motion.span>

      <motion.div
        initial={{ opacity: 0, scale: 0.78, rotate: -30 }}
        whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ type: 'spring', bounce: 0.25, duration: 1 }}
        className="relative mx-auto mt-10 w-fit"
      >
        <div className="absolute inset-0 -z-10 scale-110 rounded-full bg-ember/15 blur-3xl" />
        <StaticRing
          states={buildStates(14, 14)}
          size={180}
          stroke={13}
          gap={3}
          pulse={false}
        />
        <span className="tabular absolute inset-0 flex items-center justify-center font-display text-3xl font-bold tracking-[-0.02em]">
          14/14
        </span>
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
        className="mt-10 font-display text-4xl font-semibold leading-[1.1] tracking-[-0.02em] sm:text-6xl"
      >
        {t('title')}
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.7, delay: 0.3 }}
        className="mt-3 text-[17px] text-muted"
      >
        {t('sub')}
      </motion.p>

      <div className="mt-12 grid grid-cols-3 gap-3 sm:gap-5">
        {[
          { value: 6, label: t('s1') },
          { value: 84, label: t('s2') },
          { value: 92, label: t('s3'), prefix: '%' },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 44, scale: 0.94 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ type: 'spring', bounce: 0.25, duration: 0.8, delay: 0.1 * i }}
            className="rounded-3xl border border-line bg-surface px-3 py-6 sm:py-8"
          >
            <p className="tabular font-display text-4xl font-bold tracking-[-0.02em] sm:text-5xl">
              <Count to={s.value} prefix={s.prefix ?? ''} />
            </p>
            <p className="mt-1.5 text-[13px] text-faint sm:text-[14px]">{s.label}</p>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 36 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ type: 'spring', bounce: 0.22, duration: 0.85, delay: 0.3 }}
        className="mt-5 flex items-center justify-center gap-3 rounded-3xl border border-line bg-surface px-6 py-5"
      >
        <span className="font-display text-[17px] font-semibold text-joker">
          ✦ {t('perfect')}
        </span>
        <span className="hidden h-4 w-px bg-line sm:block" />
        <span className="text-[14px] text-muted">{t('perfectCopy')}</span>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.9, delay: 0.45 }}
        className="mx-auto mt-12 max-w-xl text-[17px] italic leading-relaxed text-muted"
      >
        {t('closing')}
      </motion.p>
    </section>
  );
}
