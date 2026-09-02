'use client';

import { useLocale } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';

export default function LocaleSwitch() {
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <div className="flex items-center rounded-full border border-line bg-surface p-1 text-[12.5px] font-medium">
      {(['tr', 'en'] as const).map((l) => (
        <Link
          key={l}
          href={pathname}
          locale={l}
          className={`rounded-full px-2.5 py-1 uppercase tracking-wide transition-colors ${
            locale === l
              ? 'bg-ember-soft text-ember'
              : 'text-faint hover:text-muted'
          }`}
        >
          {l}
        </Link>
      ))}
    </div>
  );
}
