'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { StaticRing, buildStates } from './Ring';
import { AppStoreButton } from './ComingSoon';

/**
 * Final CTA. The ring arrives fully closed — calm, no pulse: completion in
 * this design system is ember settling, not confetti.
 */
export default function FinalCta() {
  const t = useTranslations('cta');

  return (
    <section id="download" className="relative overflow-hidden px-6 py-40 text-center sm:py-52">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.82, rotate: -24, opacity: 0 }}
          whileInView={{ scale: 1, rotate: 0, opacity: 1 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ type: 'spring', bounce: 0.2, duration: 1.1 }}
          className="scale-[0.6] sm:scale-90 lg:scale-100"
        >
          <StaticRing
            states={buildStates(14, 14)}
            size={460}
            stroke={16}
            gap={3}
            pulse={false}
            className="opacity-90 drop-shadow-[0_0_80px_rgba(255,107,71,0.22)]"
          />
        </motion.div>
      </div>

      <div className="relative">
        <motion.h2
          initial={{ opacity: 0, y: 34 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          className="font-display text-5xl font-semibold leading-[1.08] tracking-[-0.02em] sm:text-7xl"
        >
          {t('title')}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.28 }}
          className="mx-auto mt-5 max-w-md text-[17px] leading-relaxed text-muted"
        >
          {t('sub')}
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.94 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ type: 'spring', bounce: 0.3, duration: 0.8, delay: 0.42 }}
          className="mt-10"
        >
          <AppStoreButton size="lg" label={t('button')} />
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-6 text-[13px] text-faint"
        >
          {t('note')}
        </motion.p>
      </div>
    </section>
  );
}
