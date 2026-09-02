'use client';

import { useTranslations } from 'next-intl';
import { RingMark } from './Ring';

const LEGAL_BASE = 'https://halkora.app';

/**
 * Legal/support pages already live on halkora.app (gizlilik, koşullar,
 * destek, hesap-silme) — the footer links straight to them.
 */
export default function Footer() {
  const t = useTranslations('footer');

  const links: { key: string; href: string }[] = [
    { key: 'privacy', href: `${LEGAL_BASE}/gizlilik/` },
    { key: 'terms', href: `${LEGAL_BASE}/kosullar/` },
    { key: 'support', href: `${LEGAL_BASE}/destek/` },
    { key: 'delete', href: `${LEGAL_BASE}/hesap-silme/` },
  ];

  return (
    <footer className="border-t border-line px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <RingMark size={26} />
          <div>
            <p className="font-display text-[15px] font-semibold tracking-[-0.01em]">
              halkora
            </p>
            <p className="text-[13px] text-faint">{t('tagline')}</p>
          </div>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-3 text-[14px] text-muted">
          {links.map((l) => (
            <a
              key={l.key}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-fg"
            >
              {t(l.key as 'privacy')}
            </a>
          ))}
        </nav>
      </div>
      <div className="mx-auto mt-10 flex max-w-6xl flex-col gap-3 text-[13px] text-faint sm:flex-row sm:items-center sm:justify-between">
        <p>{t('rights')}</p>
        <div className="flex gap-5">
          <a
            href="https://instagram.com/halkora.app"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-fg"
          >
            {t('instagram')}
          </a>
          <a
            href="mailto:support@halkora.app"
            className="transition-colors hover:text-fg"
          >
            {t('email')}
          </a>
        </div>
      </div>
    </footer>
  );
}
