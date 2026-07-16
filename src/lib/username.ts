/** Turkish characters that don't survive a plain lowercase + diacritic strip. */
const TR_MAP: Record<string, string> = {
  ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u',
};

/**
 * "Enes Seval" -> "enesseval". Mirrors the server's format CHECK
 * (`^[a-z0-9_]{3,20}$`, docs/db-username.sql) so a client-generated
 * candidate is never rejected on shape -- only on being taken/reserved.
 */
// Combining-diacritical-marks block (U+0300-U+036F) left behind by NFD
// normalization, e.g. "é" -> "e" + this mark. Built from char codes rather
// than a literal escape so the source file never has to carry a raw
// combining character (those are invisible and easy to mis-copy/corrupt).
const COMBINING_MARKS = new RegExp(`[\\u0300-\\u036f]`, 'g');

export function slugifyUsername(name: string): string {
  const mapped = name
    .toLowerCase()
    .replace(/[çğıöşü]/g, (c) => TR_MAP[c] ?? c);
  const cleaned = mapped
    .normalize('NFD')
    .replace(COMBINING_MARKS, '') // strip remaining accents (é, â, ...)
    .replace(/[^a-z0-9]/g, '');
  let base = cleaned.slice(0, 15);
  if (base.length === 0) base = 'kullanici';
  while (base.length < 3) base += Math.floor(Math.random() * 10);
  return base;
}

/** base, base2, base3, ... -- tried in order until one isn't taken. */
export function usernameCandidates(base: string, count = 20): string[] {
  const out = [base];
  for (let i = 2; i <= count; i++) out.push(`${base}${i}`.slice(0, 20));
  return out;
}
