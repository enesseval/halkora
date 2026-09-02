'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { StaticRing, buildStates } from './Ring';

/** Per-card entrance: left slides in from left, middle grows, right from right. */
const DIRS = [
  { x: -90, rotate: -3 },
  { y: 70, scale: 0.92 },
  { x: 90, rotate: 3 },
] as const;

export default function HowItWorks() {
  const t = useTranslations('how');

  return (
    <section id="how" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-24 sm:py-32">
      <div className="mb-6 flex items-center gap-4">
        <span className="font-display text-[13px] font-semibold uppercase tracking-[0.16em] text-faint">
          {t('kicker')}
        </span>
        <div className="h-px flex-1 bg-line" />
      </div>
      <h2 className="mb-16 max-w-2xl font-display text-3xl font-semibold leading-[1.15] tracking-[-0.02em] sm:text-5xl">
        {t('title')}
      </h2>

      <div className="grid gap-5 md:grid-cols-3">
        {/* 01 — create */}
        <motion.article
          initial={{ opacity: 0, ...DIRS[0] }}
          whileInView={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ type: 'spring', bounce: 0.25, duration: 0.9 }}
          className="rounded-3xl border border-line bg-surface p-7"
        >
          <p className="tabular font-display text-5xl font-bold text-line">01</p>
          <h3 className="mt-5 font-display text-[22px] font-semibold tracking-[-0.02em]">
            {t('s1.title')}
          </h3>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">{t('s1.copy')}</p>

          <div className="mt-7 space-y-2.5">
            <div className="rounded-xl bg-elevated px-4 py-3">
              <p className="text-[12px] text-faint">{t('s1.fieldName')}</p>
            </div>
            <div className="rounded-xl bg-elevated px-4 py-3">
              <p className="text-[13px] text-muted">{t('s1.fieldAction')}</p>
            </div>
            <div className="flex gap-2 pt-1">
              {['7', '14', '21', '30'].map((d) => (
                <span
                  key={d}
                  className={`tabular rounded-full px-3.5 py-1.5 text-[12.5px] font-medium ${
                    d === '14'
                      ? 'border border-ember bg-ember-soft text-ember'
                      : 'border border-line text-faint'
                  }`}
                >
                  {d}
                </span>
              ))}
              <span className="py-1.5 text-[12.5px] text-faint">{t('s1.fieldDays')}</span>
            </div>
          </div>
        </motion.article>

        {/* 02 — invite */}
        <motion.article
          initial={{ opacity: 0, ...DIRS[1] }}
          whileInView={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ type: 'spring', bounce: 0.25, duration: 0.9, delay: 0.12 }}
          className="rounded-3xl border border-line bg-surface p-7"
        >
          <p className="tabular font-display text-5xl font-bold text-line">02</p>
          <h3 className="mt-5 font-display text-[22px] font-semibold tracking-[-0.02em]">
            {t('s2.title')}
          </h3>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">{t('s2.copy')}</p>

          <div className="mt-7 space-y-4">
            <div className="flex items-center justify-between rounded-full bg-elevated py-3 pl-5 pr-3">
              <span className="text-[13.5px] text-muted">{t('s2.link')}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-faint">
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <rect x="4.5" y="4.5" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M9.5 4.5v-1a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h1" stroke="currentColor" strokeWidth="1.4" />
                </svg>
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="flex">
                {['EK', 'AY', 'ZD', 'MC'].map((ini, i) => (
                  <span
                    key={ini}
                    className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface font-display text-[10px] font-semibold text-muted ${
                      i % 2 ? 'bg-line' : 'bg-elevated'
                    } ${i ? '-ml-2' : ''}`}
                  >
                    {ini}
                  </span>
                ))}
                <span className="-ml-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-ember-soft font-display text-[10px] font-semibold text-ember">
                  +2
                </span>
              </div>
              <span className="text-[13px] text-faint">{t('s2.ready')}</span>
            </div>
          </div>
        </motion.article>

        {/* 03 — check in */}
        <motion.article
          initial={{ opacity: 0, ...DIRS[2] }}
          whileInView={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ type: 'spring', bounce: 0.25, duration: 0.9, delay: 0.24 }}
          className="rounded-3xl border border-line bg-surface p-7"
        >
          <p className="tabular font-display text-5xl font-bold text-line">03</p>
          <h3 className="mt-5 font-display text-[22px] font-semibold tracking-[-0.02em]">
            {t('s3.title')}
          </h3>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">{t('s3.copy')}</p>

          <div className="mt-7">
            <div className="mb-4 flex items-center gap-4">
              <div className="relative">
                <StaticRing
                  states={buildStates(14, 6, { joker: 3, today: 6 })}
                  size={64}
                  stroke={6}
                  gap={4.5}
                />
                <span className="tabular absolute inset-0 flex items-center justify-center font-display text-[13px] font-semibold">
                  7/14
                </span>
              </div>
              <div className="flex-1">
                <div className="h-2 w-full overflow-hidden rounded-full bg-elevated">
                  <motion.div
                    initial={{ width: '0%' }}
                    whileInView={{ width: '50%' }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.1, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="h-full rounded-full bg-ember"
                  />
                </div>
                <p className="tabular mt-2 text-[12.5px] text-faint">7/14</p>
              </div>
            </div>
            <div className="flex h-11 items-center justify-center rounded-full bg-ember text-[15px] font-bold text-bg">
              {t('s3.button')}
            </div>
          </div>
        </motion.article>
      </div>
    </section>
  );
}
