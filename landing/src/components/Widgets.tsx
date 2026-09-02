'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { StaticRing, buildStates } from './Ring';

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** One dimmed placeholder app icon in the home-screen grid. */
function AppIcon({ dim = 1 }: { dim?: number }) {
  return (
    <div
      className="aspect-square rounded-[26%] bg-elevated"
      style={{ opacity: 0.45 * dim }}
    />
  );
}

function Item({ title, children }: { title: string; children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 46 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ type: 'spring', bounce: 0.2, duration: 0.8 }}
    >
      <h3 className="font-display text-[17px] font-semibold tracking-[-0.01em]">
        {title}
      </h3>
      <p className="mt-1 text-[15px] leading-relaxed text-muted">{children}</p>
    </motion.div>
  );
}

/**
 * Widget showcase — small (2×2) and medium (4×2) home-screen widgets plus the
 * lock-screen ring, all real features shipped in the app.
 */
export default function Widgets() {
  const t = useTranslations('widgets');

  return (
    <section className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
      <div className="mb-6 flex items-center gap-4">
        <span className="font-display text-[13px] font-semibold uppercase tracking-[0.16em] text-faint">
          {t('kicker')}
        </span>
        <div className="h-px flex-1 bg-line" />
        <span className="rounded-xl bg-ember-soft px-3 py-1.5 font-display text-[12px] font-semibold text-ember">
          {t('chip')}
        </span>
      </div>
      <h2 className="max-w-2xl font-display text-3xl font-semibold leading-[1.15] tracking-[-0.02em] sm:text-5xl">
        {t('title')}
      </h2>
      <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-muted">{t('sub')}</p>

      <div className="mt-14 grid items-center gap-12 md:grid-cols-5">
        {/* Home screen panel */}
        <motion.div
          initial={{ opacity: 0, y: 80, scale: 0.95 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ type: 'spring', bounce: 0.2, duration: 0.9 }}
          className="rounded-[2.4rem] border border-line bg-abyss p-4 shadow-2xl md:col-span-3"
        >
          <div className="grid grid-cols-4 gap-3">
            <AppIcon />
            <AppIcon dim={0.7} />
            <AppIcon />
            <AppIcon dim={0.8} />

            {/* Small widget — 2×2 */}
            <motion.div
              initial={{ opacity: 0, x: -44, rotate: -2 }}
              whileInView={{ opacity: 1, x: 0, rotate: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ type: 'spring', bounce: 0.3, duration: 0.85, delay: 0.25 }}
              className="col-span-2 row-span-2 flex flex-col justify-between rounded-3xl border border-line bg-surface p-3.5"
            >
              <p className="text-[11px] font-medium leading-tight text-muted">
                {t('smallName')}
              </p>
              <div className="relative mx-auto">
                <StaticRing
                  states={buildStates(14, 7, { today: 7 })}
                  size={62}
                  stroke={6}
                  gap={4.5}
                />
                <span className="tabular absolute inset-0 flex items-center justify-center font-display text-[12px] font-semibold">
                  7/14
                </span>
              </div>
              <div className="rounded-full bg-ember py-1.5 text-center text-[11px] font-bold text-bg">
                {t('checkin')}
              </div>
            </motion.div>
            <AppIcon dim={0.75} />
            <AppIcon />
            <AppIcon />
            <AppIcon dim={0.6} />

            {/* Medium widget — 4×2 */}
            <motion.div
              initial={{ opacity: 0, y: 48, scale: 0.94 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ type: 'spring', bounce: 0.28, duration: 0.85, delay: 0.4 }}
              className="col-span-4 rounded-3xl border border-line bg-surface p-4"
            >
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <StaticRing
                    states={buildStates(21, 10, { joker: 6, today: 10 })}
                    size={76}
                    stroke={7}
                    gap={4}
                  />
                  <span className="tabular absolute inset-0 flex items-center justify-center font-display text-[11px] font-semibold">
                    10/21
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">{t('mediumName')}</p>
                  <p className="truncate text-[12px] text-muted">{t('mediumAction')}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-faint">
                    <span className="tabular">{t('mediumDay')}</span>
                    <span>·</span>
                    <span className="tabular">{t('mediumDone')}</span>
                    <span>·</span>
                    <span className="tabular text-joker">● {t('mediumJoker')}</span>
                  </div>
                </div>
                <div className="shrink-0 rounded-full bg-ember px-4 py-2 text-[12px] font-bold text-bg">
                  {t('checkin')}
                </div>
              </div>
            </motion.div>

            <AppIcon dim={0.8} />
            <AppIcon />
            <AppIcon dim={0.65} />
            <AppIcon />
          </div>
        </motion.div>

        {/* Copy + lock screen */}
        <div className="flex flex-col gap-8 md:col-span-2">
          <Item title={t('sTitle')}>{t('sCopy')}</Item>
          <Item title={t('mTitle')}>{t('mCopy')}</Item>

          <motion.div
            initial={{ opacity: 0, rotate: -6, scale: 0.9 }}
            whileInView={{ opacity: 1, rotate: 0, scale: 1 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ type: 'spring', bounce: 0.3, duration: 0.85, delay: 0.15 }}
            className="flex items-center gap-4 rounded-3xl border border-line bg-surface p-5"
          >
            <div className="relative flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-full border border-line bg-abyss">
              <StaticRing
                states={buildStates(14, 7)}
                size={54}
                stroke={5}
                gap={5}
                pulse={false}
              />
              <span className="tabular absolute inset-0 flex items-center justify-center font-display text-[11px] font-semibold">
                7/14
              </span>
            </div>
            <div>
              <h3 className="font-display text-[17px] font-semibold tracking-[-0.01em]">
                {t('lTitle')}
              </h3>
              <p className="mt-1 text-[15px] leading-relaxed text-muted">{t('lCopy')}</p>
            </div>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.8, delay: 0.35, ease: EASE }}
            className="text-[14px] italic leading-relaxed text-faint"
          >
            {t('note')}
          </motion.p>
        </div>
      </div>
    </section>
  );
}
