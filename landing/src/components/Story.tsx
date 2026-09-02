'use client';

import { useRef, type ReactNode } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { RingMark } from './Ring';

/** Scroll-linked reveal, same language as the Manifesto lines. */
function Fade({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.92', 'start 0.5'],
  });
  const opacity = useTransform(scrollYProgress, [0, 1], [0.08, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [30, 0]);
  return (
    <motion.div ref={ref} style={{ opacity, y }} className={className}>
      {children}
    </motion.div>
  );
}

/** iOS-style notification banner that drops in from the top edge. */
function Banner({
  time,
  title,
  body,
}: {
  time: string;
  title: string;
  body: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -56, scale: 0.95 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '-90px' }}
      transition={{ type: 'spring', bounce: 0.38, duration: 0.75 }}
      className="rounded-2xl border border-line bg-surface/85 p-4 shadow-2xl backdrop-blur-md"
    >
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-faint">
        <RingMark size={16} />
        <span>halkora</span>
        <span className="ml-auto normal-case tracking-normal">{time}</span>
      </div>
      <p className="mt-2.5 text-[15px] font-semibold">{title}</p>
      <p className="mt-0.5 text-[13.5px] text-muted">{body}</p>
    </motion.div>
  );
}

/**
 * "A real evening" — the narrative beat. Evening reminder first, the friend's
 * wave second; two notification types the app actually sends, told as one
 * small story.
 */
export default function Story() {
  const t = useTranslations('story');

  return (
    <section className="mx-auto max-w-2xl px-6 py-32 sm:py-44">
      <Fade className="mb-12">
        <span className="rounded-xl bg-ember-soft px-3.5 py-2 font-display text-[13px] font-semibold text-ember">
          {t('chip')}
        </span>
      </Fade>

      <div className="flex flex-col gap-7 font-display text-[26px] font-semibold leading-[1.25] tracking-[-0.02em] sm:text-4xl">
        <Fade>
          <p>{t('l1')}</p>
        </Fade>

        <div className="my-2">
          <Banner time={t('rTime')} title={t('rTitle')} body={t('rBody')} />
        </div>

        <Fade>
          <p>{t('l2')}</p>
        </Fade>
        <Fade>
          <p>{t('l3')}</p>
        </Fade>

        <div className="my-2">
          <Banner time={t('wTime')} title={t('wTitle')} body={t('wBody')} />
        </div>

        <Fade>
          <p className="text-ember">{t('closing')}</p>
        </Fade>
      </div>
    </section>
  );
}
