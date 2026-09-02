'use client';

import { useRef, type ReactNode } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useTranslations } from 'next-intl';

/**
 * Manifesto lines that brighten from near-invisible to full contrast as they
 * cross the middle of the viewport — scroll-linked, not one-shot.
 */
function Line({ ember = false, children }: { ember?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.92', 'start 0.42'],
  });
  const opacity = useTransform(scrollYProgress, [0, 1], [0.1, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [38, 0]);

  return (
    <motion.p
      ref={ref}
      style={{ opacity, y }}
      className={`font-display text-4xl font-semibold leading-[1.12] tracking-[-0.02em] sm:text-6xl ${
        ember ? 'text-ember' : ''
      }`}
    >
      {children}
    </motion.p>
  );
}

export default function Manifesto() {
  const t = useTranslations('manifesto');

  return (
    <section className="mx-auto max-w-4xl px-6 py-36 sm:py-52">
      <p className="mb-10 font-display text-[13px] font-semibold uppercase tracking-[0.16em] text-faint">
        {t('kicker')}
      </p>
      <div className="flex flex-col gap-5">
        <Line>{t('l1')}</Line>
        <Line>{t('l2')}</Line>
        <Line>{t('l3')}</Line>
        <Line ember>{t('l4')}</Line>
      </div>
    </section>
  );
}
