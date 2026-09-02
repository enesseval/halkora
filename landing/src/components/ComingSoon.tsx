'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { RingMark } from './Ring';

/**
 * Every "Download" surface on the page funnels into this. Until the real App
 * Store link exists, it opens a small on-brand dialog instead of navigating.
 */
const ComingSoonContext = createContext<() => void>(() => {});

export const useComingSoon = () => useContext(ComingSoonContext);

export function ComingSoonProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const t = useTranslations('soon');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <ComingSoonContext.Provider value={() => setOpen(true)}>
      {children}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <button
              aria-label={t('ok')}
              className="absolute inset-0 cursor-default bg-abyss/70 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              className="relative w-full max-w-sm rounded-3xl border border-line bg-surface p-8 text-center"
              initial={{ scale: 0.9, y: 24, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.94, y: 12, opacity: 0 }}
              transition={{ type: 'spring', bounce: 0.25, duration: 0.55 }}
            >
              <div className="mb-5 flex justify-center">
                <RingMark size={52} />
              </div>
              <h3 className="font-display text-[22px] font-semibold tracking-[-0.02em]">
                {t('title')}
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">
                {t('body')}
              </p>
              <button
                onClick={() => setOpen(false)}
                className="mt-6 h-12 w-full rounded-full bg-ember text-[16px] font-bold text-bg transition-all duration-200 hover:bg-ember-glow active:scale-[0.97]"
              >
                {t('ok')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ComingSoonContext.Provider>
  );
}

export function AppStoreButton({
  label,
  size = 'md',
  className = '',
}: {
  label: string;
  size?: 'md' | 'lg';
  className?: string;
}) {
  const open = useComingSoon();
  const sizing =
    size === 'lg' ? 'h-14 px-8 text-[17px]' : 'h-10 px-5 text-[14px]';
  return (
    <button
      onClick={open}
      className={`inline-flex cursor-pointer items-center gap-2.5 rounded-full bg-ember font-bold text-bg shadow-[0_0_44px_rgba(255,107,71,0.28)] transition-all duration-200 hover:bg-ember-glow active:scale-[0.97] ${sizing} ${className}`}
    >
      <svg
        viewBox="0 0 384 512"
        className={size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'}
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
      </svg>
      {label}
    </button>
  );
}

export function SoonLink({ children }: { children: ReactNode }) {
  const open = useComingSoon();
  return (
    <button
      onClick={open}
      className="cursor-pointer transition-colors hover:text-fg"
    >
      {children}
    </button>
  );
}
