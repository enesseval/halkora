'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { RingMark, StaticRing, buildStates } from './Ring';

const AVATARS = ['ZD', 'EK', 'SN', 'BA', 'DK', 'AY'];

function AvatarStack() {
  return (
    <div className="flex">
      {AVATARS.map((ini, i) => (
        <span
          key={ini}
          className={`flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#101116] font-display text-[8px] font-semibold text-muted ${
            i % 2 ? 'bg-line' : 'bg-elevated'
          } ${i ? '-ml-1.5' : ''}`}
        >
          {ini}
        </span>
      ))}
      <span className="-ml-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#101116] bg-ember-soft font-display text-[8px] font-semibold text-ember">
        +2
      </span>
    </div>
  );
}

function Watermark() {
  return (
    <div className="flex items-center justify-center gap-1.5 text-faint">
      <RingMark size={14} />
      <span className="font-display text-[11px] font-semibold tracking-[-0.01em]">
        halkora.app
      </span>
    </div>
  );
}

function StatCell({ value, label, ember = false }: { value: string; label: string; ember?: boolean }) {
  return (
    <div className="rounded-xl bg-elevated px-2 py-2.5 text-center">
      <p
        className={`tabular font-display text-[17px] font-bold tracking-[-0.02em] ${
          ember ? 'text-ember' : ''
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[10px] text-faint">{label}</p>
    </div>
  );
}

/** 16 faint rays behind the ring of the fourth card. */
function Rays() {
  return (
    <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" aria-hidden="true">
      {Array.from({ length: 16 }, (_, i) => {
        const a = ((i * 22.5 - 90) * Math.PI) / 180;
        const x1 = 100 + 64 * Math.cos(a);
        const y1 = 100 + 64 * Math.sin(a);
        const x2 = 100 + 96 * Math.cos(a);
        const y2 = 100 + 96 * Math.sin(a);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#262A33"
            strokeWidth="3"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

/**
 * Share cards: every finished ring turns into a shareable story card. Four
 * variants ride a pinned, vertically-driven horizontal scroll.
 */
export default function ShareCards() {
  const t = useTranslations('share');
  const names = t.raw('names') as string[];

  const sectionRef = useRef<HTMLElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const [dist, setDist] = useState(0);

  useEffect(() => {
    const measure = () => {
      if (!stripRef.current) return;
      setDist(Math.max(0, stripRef.current.scrollWidth - window.innerWidth + 96));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  });
  const x = useTransform(scrollYProgress, [0.03, 0.97], [0, -dist]);

  const card =
    'relative flex aspect-[9/16] w-[272px] shrink-0 flex-col overflow-hidden rounded-[2rem] border border-line sm:w-[310px]';

  return (
    <section
      ref={sectionRef}
      style={{ height: `calc(100vh + ${Math.max(dist, 400)}px)` }}
      className="relative"
    >
      <div className="sticky top-0 flex h-svh flex-col justify-center overflow-hidden">
        <div className="mx-auto mb-10 w-full max-w-6xl px-6">
          <span className="mb-5 inline-block rounded-xl bg-ember-soft px-3.5 py-2 font-display text-[13px] font-semibold text-ember">
            {t('chip')}
          </span>
          <h2 className="font-display text-3xl font-semibold leading-[1.15] tracking-[-0.02em] sm:text-5xl">
            {t('title')}
          </h2>
          <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-muted sm:text-[17px]">
            {t('sub')}
          </p>
        </div>

        <motion.div
          ref={stripRef}
          style={{ x }}
          className="mask-fade-x flex w-max items-stretch gap-5 pl-6 sm:gap-8"
        >
          {/* A — Classic: logo, ring, 2×2 stat grid */}
          <div className={`${card} -rotate-2 bg-gradient-to-b from-[#101116] to-bg p-6`}>
            <div className="flex items-center gap-2">
              <RingMark size={20} />
              <span className="font-display text-[13px] font-semibold">halkora</span>
            </div>
            <p className="mt-6 font-display text-[22px] font-semibold leading-tight tracking-[-0.02em]">
              {t('cardTitle')}
            </p>
            <p className="mt-1 text-[13px] text-muted">{t('completed')}</p>
            <div className="relative mx-auto my-auto py-5">
              <StaticRing
                states={buildStates(14, 14)}
                size={120}
                stroke={10}
                gap={3}
                pulse={false}
              />
              <span className="tabular absolute inset-0 flex items-center justify-center font-display text-xl font-bold">
                14/14
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <StatCell value="14" label={t('daysL')} />
              <StatCell value="8" label={t('peopleL')} />
              <StatCell value="96" label={t('checkinsL')} />
              <StatCell value="%86" label={t('rateL')} ember />
            </div>
            <div className="mt-4 flex items-center justify-between">
              <AvatarStack />
              <Watermark />
            </div>
          </div>

          {/* B — Typographic: giant number, name list */}
          <div className={`${card} rotate-1 bg-gradient-to-b from-[#101116] to-bg p-6`}>
            <p className="tabular font-display text-[120px] font-bold leading-none tracking-[-0.04em]">
              14
            </p>
            <p className="mt-1 font-display text-[20px] font-semibold tracking-[-0.02em]">
              {t('together')}
            </p>
            <p className="mt-1 text-[13px] text-muted">{t('cardTitle')}</p>
            <div className="my-5 h-px bg-line" />
            <div className="space-y-1.5">
              {names.map((n, i) => (
                <p
                  key={n}
                  className={`text-[14px] ${i === names.length - 1 ? 'text-faint' : 'text-muted'}`}
                >
                  {n}
                </p>
              ))}
            </div>
            <div className="mt-auto">
              <p className="tabular mb-4 text-[12px] text-faint">
                {t('days')} · {t('people')} · {t('checkins')} ·{' '}
                <span className="text-ember">{t('rate')}</span>
              </p>
              <Watermark />
            </div>
          </div>

          {/* C — Ember band header, big ring */}
          <div className={`${card} -rotate-1 bg-gradient-to-b from-[#101116] to-bg`}>
            <div className="flex items-center justify-center gap-2 bg-ember py-3.5">
              <span className="font-display text-[14px] font-bold text-bg">
                {t('completed')}
              </span>
            </div>
            <div className="flex flex-1 flex-col p-6">
              <p className="font-display text-[20px] font-semibold leading-tight tracking-[-0.02em]">
                <span className="mr-1.5 text-ember">✓</span>
                {t('cardTitle')}
              </p>
              <div className="relative mx-auto my-auto py-4">
                <StaticRing
                  states={buildStates(14, 14)}
                  size={150}
                  stroke={12}
                  gap={3}
                  pulse={false}
                  className="drop-shadow-[0_0_40px_rgba(255,107,71,0.25)]"
                />
                <span className="tabular absolute inset-0 flex items-center justify-center font-display text-2xl font-bold">
                  14/14
                </span>
              </div>
              <p className="tabular mb-4 text-center text-[12px] text-faint">
                {t('days')} · {t('people')} · {t('checkins')}
              </p>
              <div className="flex items-center justify-between">
                <AvatarStack />
                <Watermark />
              </div>
            </div>
          </div>

          {/* D — Rays */}
          <div className={`${card} rotate-2 bg-gradient-to-b from-[#101116] to-bg p-6`}>
            <p className="text-center font-display text-[20px] font-semibold leading-tight tracking-[-0.02em]">
              {t('cardTitle')}
            </p>
            <p className="mt-1 text-center text-[13px] text-muted">{t('completed')}</p>
            <div className="relative mx-auto my-auto flex items-center justify-center py-4">
              <Rays />
              <div className="relative">
                <StaticRing
                  states={buildStates(14, 14)}
                  size={130}
                  stroke={11}
                  gap={3}
                  pulse={false}
                />
                <span className="tabular absolute inset-0 flex items-center justify-center font-display text-[22px] font-bold">
                  14/14
                </span>
              </div>
            </div>
            <p className="mb-1.5 text-center font-display text-[14px] font-semibold text-joker">
              {t('perfect')}
            </p>
            <p className="tabular mb-4 text-center text-[12px] text-faint">
              {t('days')} · {t('people')} · {t('checkins')} · {t('rate')}
            </p>
            <Watermark />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
