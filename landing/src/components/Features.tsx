'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { StaticRing, buildStates, type SegState } from './Ring';

function Bento({
  className = '',
  from = { y: 60 },
  children,
}: {
  className?: string;
  from?: Record<string, number>;
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, ...from }}
      whileInView={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ type: 'spring', bounce: 0.22, duration: 0.9 }}
      className={`rounded-3xl border border-line bg-surface p-7 ${className}`}
    >
      {children}
    </motion.div>
  );
}

function CardTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="font-display text-[20px] font-semibold tracking-[-0.02em]">
      {children}
    </h3>
  );
}

function CardCopy({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2 text-[15px] leading-relaxed text-muted">{children}</p>
  );
}

const S_RING = { size: 26, stroke: 3, gap: 6 } as const;

function ParticipantRow({
  initials,
  name,
  status,
  done,
  states,
  last = false,
}: {
  initials: string;
  name: string;
  status: ReactNode;
  done?: boolean;
  states: SegState[];
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 py-2.5 ${last ? '' : 'border-b border-line'}`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-[11px] font-semibold text-muted ${
          done ? 'bg-elevated' : 'bg-line'
        }`}
      >
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium">{name}</p>
        <p className={`text-[12px] ${done ? 'text-muted' : 'text-faint'}`}>{status}</p>
      </div>
      <StaticRing states={states} {...S_RING} pulse={false} />
    </div>
  );
}

export default function Features() {
  const t = useTranslations('features');

  return (
    <section className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
      <div className="mb-6 flex items-center gap-4">
        <span className="font-display text-[13px] font-semibold uppercase tracking-[0.16em] text-faint">
          {t('kicker')}
        </span>
        <div className="h-px flex-1 bg-line" />
      </div>
      <h2 className="mb-16 max-w-2xl font-display text-3xl font-semibold leading-[1.15] tracking-[-0.02em] sm:text-5xl">
        {t('title')}
      </h2>

      <div className="grid gap-5 md:grid-cols-6">
        {/* Stake — wide, from the left */}
        <Bento className="md:col-span-4" from={{ x: -70, rotate: -1.5 }}>
          <CardTitle>{t('stake.title')}</CardTitle>
          <CardCopy>{t('stake.copy')}</CardCopy>
          <div className="mt-7 space-y-2.5">
            <div className="relative overflow-hidden rounded-2xl border border-ember px-4 py-3.5">
              <motion.div
                initial={{ width: '0%' }}
                whileInView={{ width: '62%' }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 1, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 bg-ember-soft"
              />
              <div className="relative flex items-center justify-between">
                <span className="text-[15px] font-medium">☕ {t('stake.opt1')}</span>
                <span className="tabular font-display text-[15px] font-semibold text-ember">
                  %62 ✓
                </span>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-line px-4 py-3.5">
              <motion.div
                initial={{ width: '0%' }}
                whileInView={{ width: '38%' }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 1, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 bg-ember-soft/50"
              />
              <div className="relative flex items-center justify-between">
                <span className="text-[15px] text-muted">🎬 {t('stake.opt2')}</span>
                <span className="tabular font-display text-[15px] font-semibold text-faint">
                  %38
                </span>
              </div>
            </div>
          </div>
        </Bento>

        {/* Joker — grows from below */}
        <Bento className="md:col-span-2" from={{ y: 70, scale: 0.92 }}>
          <div className="mb-5">
            <StaticRing
              states={buildStates(14, 4, { joker: 4, today: 5 })}
              size={84}
              stroke={8}
              gap={4}
            />
          </div>
          <CardTitle>{t('joker.title')}</CardTitle>
          <CardCopy>{t('joker.copy')}</CardCopy>
        </Bento>

        {/* Visibility — from the right */}
        <Bento className="md:col-span-2" from={{ x: 70 }}>
          <CardTitle>{t('social.title')}</CardTitle>
          <CardCopy>{t('social.copy')}</CardCopy>
          <div className="mt-5">
            <ParticipantRow
              initials="EK"
              name="Enes Kaya"
              status={
                <>
                  <span className="text-ember">✓</span> {t('social.now')}
                </>
              }
              done
              states={buildStates(14, 7)}
            />
            <ParticipantRow
              initials="AY"
              name="Ayşe Yılmaz"
              status={t('social.waiting')}
              states={buildStates(14, 6, { today: 6 })}
            />
            <ParticipantRow
              initials="MC"
              name="Mert Can"
              status={t('wave.status')}
              states={buildStates(14, 4, { today: 6, missed: [4, 5] })}
              last
            />
          </div>
        </Bento>

        {/* Wave — drops from above */}
        <Bento className="md:col-span-2" from={{ y: -60, scale: 0.94 }}>
          <CardTitle>{t('wave.title')}</CardTitle>
          <CardCopy>{t('wave.copy')}</CardCopy>
          <div className="mt-6 flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-line font-display text-[11px] font-semibold text-muted">
              MC
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium">Mert Can</p>
              <p className="text-[12px] text-faint">{t('wave.status')}</p>
            </div>
            <motion.button
              whileHover={{ rotate: [0, -8, 8, 0], scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              transition={{ duration: 0.4 }}
              className="cursor-pointer rounded-full border border-line bg-elevated px-4 py-2 text-[13px] font-medium"
            >
              {t('wave.button')}
            </motion.button>
          </div>
        </Bento>

        {/* Chat — from the right, slight tilt */}
        <Bento className="md:col-span-2" from={{ x: 70, rotate: 2 }}>
          <CardTitle>{t('chat.title')}</CardTitle>
          <CardCopy>{t('chat.copy')}</CardCopy>
          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="h-px flex-1 bg-line" />
              <span className="font-display text-[11px] font-semibold text-faint">
                {t('chat.day')}
              </span>
              <div className="h-px flex-1 bg-line" />
            </div>
            <div className="max-w-[92%]">
              <p className="mb-1 ml-1 text-[11px] text-faint">Zeynep</p>
              <div className="rounded-2xl rounded-bl-md bg-elevated px-3.5 py-2.5 text-[13.5px] leading-snug">
                {t('chat.b1')}
              </div>
              <span className="relative -mt-1.5 ml-3 inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-1.5 py-0.5 text-[11px]">
                🔥 <span className="tabular font-display text-muted">2</span>
              </span>
            </div>
            <p className="text-center text-[12px] text-faint">
              {t('chat.sys')} <span className="text-ember">✓</span>
            </p>
            <div className="ml-auto max-w-[92%]">
              <div className="rounded-2xl rounded-br-md bg-elevated px-3.5 py-2.5 text-[13.5px] leading-snug">
                {t('chat.b2')}
              </div>
            </div>
          </div>
        </Bento>
      </div>
    </section>
  );
}
