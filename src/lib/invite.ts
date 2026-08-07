/**
 * Invite codes are exactly this long — `substr(md5(...), 1, 10)` on the
 * `challenges.invite_code` default. Accepting anything shorter meant the
 * "Katıl" button lit up after three characters and then failed against the
 * server (saha testi bulgusu), which reads as the app being broken rather
 * than the code being incomplete.
 */
export const INVITE_CODE_LENGTH = 10;

const CODE = `[A-Za-z0-9-]{${INVITE_CODE_LENGTH}}`;

/** Pull an invite code out of a link or raw code (used by /start and the Home quick-start sheet). */
export function extractCode(text: string | null | undefined): string | null {
  if (!text) return null;
  const t = text.trim();
  // In a link the code is followed by a boundary, so it can be matched even
  // when query strings or trailing slashes come after it.
  const m = t.match(new RegExp(`(?:/j/|/join/)(${CODE})(?![A-Za-z0-9-])`));
  if (m) return m[1];
  if (new RegExp(`^${CODE}$`).test(t)) return t;
  return null;
}
