'use client';

import { useRef } from 'react';
import { motion, useScroll, useSpring, useTransform, type MotionValue } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { ScrollRing } from './Ring';

const TOTAL = 14;

/**
 * The centerpiece: a 320vh pinned scene. Scrolling fills the signature ring
 * segment by segment, the day counter ticks up, the check-in button settles
 * into its done state, and milestones light up in turn.
 */
export default function RingDemo() {
  const t = useTranslations('ringDemo');
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  });

  // Fill runs on a spring so the segments land with weight, not linearly.
  const rawFill = useTransform(scrollYProgress, [0.08, 0.88], [0, 1]);
  const fill = useSpring(rawFill, { stiffness: 110, damping: 26, mass: 0.6 });

  const dayText = useTransform(fill, (p) => `${Math.round(p * TOTAL)}/${TOTAL}`);

  // Ring grows into place as the scene pins, then breathes out at the end.
  const ringScale = useTransform(scrollYProgress, [0, 0.1, 0.92, 1], [0.88, 1, 1, 0.96]);
  const glowOpacity = useTransform(fill, [0, 1], [0.1, 0.38]);

  // Check-in → done crossfade right as the last segment lands.
  const doneOpacity = useTransform(fill, [0.975, 0.999], [0, 1]);
  const idleOpacity = useTransform(fill, [0.975, 0.999], [1, 0]);

  const hintOpacity = useTransform(scrollYProgress, [0, 0.05], [1, 0]);

  return (
    <section ref={ref} className="relative h-[340vh]">
      <div className="sticky top-0 flex h-svh items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-6 md:grid-cols-2 md:gap-6">
          {/* Copy + milestones */}
          <div className="order-2 md:order-1">
            <div className="mb-6 flex items-center gap-4">
              <span className="font-display text-[13px] font-semibold uppercase tracking-[0.16em] text-faint">
                {t('kicker')}
              </span>
              <div className="h-px w-16 bg-line" />
            </div>
            <h2 className="font-display text-3xl font-semibold leading-[1.15] tracking-[-0.02em] sm:text-5xl">
              {t('title')}
            </h2>
            <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-muted">
              {t('copy')}
            </p>

            <div className="mt-10 flex flex-col gap-6 sm:mt-14 sm:gap-8">
              <Milestone
                progress={scrollYProgress}
                range={[0.08, 0.44]}
                title={t('m1.title')}
                copy={t('m1.copy')}
              />
              <Milestone
                progress={scrollYProgress}
                range={[0.44, 0.74]}
                title={t('m2.title')}
                copy={t('m2.copy')}
              />
              <Milestone
                progress={scrollYProgress}
                range={[0.74, 1]}
                title={t('m3.title')}
                copy={t('m3.copy')}
                last
              />
            </div>
          </div>

          {/* Ring */}
          <div className="order-1 md:order-2">
            <motion.div
              style={{ scale: ringScale }}
              className="relative mx-auto w-fit scale-[0.58] sm:scale-75 lg:scale-100"
            >
              <motion.div
                style={{ opacity: glowOpacity }}
                className="absolute inset-6 rounded-full bg-ember/25 blur-3xl"
              />
              <ScrollRing
                progress={fill}
                total={TOTAL}
                size={380}
                stroke={15}
                gap={3}
                className="relative"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.span className="tabular font-display text-5xl font-bold tracking-[-0.02em]">
                  {dayText}
                </motion.span>
                <span className="mt-1 text-[15px] text-faint">{t('dayLabel')}</span>
              </div>
            </motion.div>

            <div className="mt-2 flex flex-col items-center gap-4 sm:mt-6">
              <p className="text-[15px] font-medium text-muted">{t('action')}</p>
              <div className="relative h-[52px] w-60">
                <motion.div
                  style={{ opacity: idleOpacity }}
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-ember text-[17px] font-bold text-bg shadow-[0_0_48px_rgba(255,107,71,0.25)]"
                >
                  {t('checkin')}
                </motion.div>
                <motion.div
                  style={{ opacity: doneOpacity }}
                  className="absolute inset-0 flex items-center justify-center rounded-full border border-line text-[17px] font-medium text-muted"
                >
                  <span className="mr-2 text-ember">✓</span>
                  {t('done')}
                </motion.div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll hint, fades as soon as the fill starts */}
        <motion.div
          style={{ opacity: hintOpacity }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center"
        >
          <p className="mb-2 text-[12px] uppercase tracking-[0.2em] text-faint">
            {t('scrollHint')}
          </p>
          <motion.svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            className="mx-auto text-faint"
            animate={{ y: [0, 5, 0] }}
            transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
          >
            <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </motion.svg>
        </motion.div>
      </div>
    </section>
  );
}

function Milestone({
  progress,
  range,
  title,
  copy,
  last = false,
}: {
  progress: MotionValue<number>;
  range: [number, number];
  title: string;
  copy: string;
  last?: boolean;
}) {
  const opacity = useTransform(
    progress,
    last
      ? [range[0], range[0] + 0.06]
      : [range[0], range[0] + 0.06, range[1] - 0.04, range[1]],
    last ? [0.22, 1] : [0.22, 1, 1, 0.22],
  );
  const x = useTransform(progress, [range[0], range[0] + 0.06], [26, 0]);

  return (
    <motion.div style={{ opacity, x }} className="flex items-start gap-4">
      <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-ember" />
      <div>
        <p className="tabular font-display text-[17px] font-semibold tracking-[-0.01em]">
          {title}
        </p>
        <p className="mt-1 text-[15px] leading-relaxed text-muted">{copy}</p>
      </div>
    </motion.div>
  );
}
