import { Link } from '@/i18n/navigation';

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-5 px-6 text-center">
      <p className="font-display text-6xl font-bold tracking-[-0.02em] text-faint">
        404
      </p>
      <Link href="/" className="text-[15px] text-ember hover:text-ember-glow">
        halkora
      </Link>
    </div>
  );
}
