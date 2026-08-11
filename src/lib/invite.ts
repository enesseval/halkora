/**
 * Invite codes are ten characters — `substr(md5(...), 1, 10)` on the
 * `challenges.invite_code` default.
 *
 * The accepted range is deliberately wider than that. A client-side length
 * rule can only ever do harm here: if it's too strict it blocks a code that
 * would have worked, silently and with no explanation, and the person is left
 * staring at a dead button (which is exactly what happened). The server
 * already validates the code properly, so this only has to be tight enough to
 * avoid firing on a half-typed one.
 */
export const INVITE_CODE_LENGTH = 10;

const MIN = 6;
const MAX = 16;
const CODE = `[A-Za-z0-9-]{${MIN},${MAX}}`;

/** Pull an invite code out of a link or raw code (used by /start and the Home quick-start sheet). */
export function extractCode(text: string | null | undefined): string | null {
  if (!text) return null;

  // The link is looked for in the RAW text, before any whitespace is touched.
  // Stripping first was a real bug: a shared message with anything after the
  // link ("halkora.app/j/abc123 harika bir uygulama") had the code welded to
  // the next word, so the code was 10+N characters long and matched nothing.
  // The clipboard is full of links sitting inside sentences, and every one of
  // them silently produced no code at all (saha testi bulgusu).
  const inLink = text.match(new RegExp(`(?:/j/|/join/)(${CODE})(?![A-Za-z0-9-])`));
  if (inLink) return inLink[1];

  // Only now collapse whitespace, and only for the bare-code case: people type
  // a ten-character code in groups ("a1b2 c3d4 e5"), and a trailing space
  // arrives from more keyboards than you'd think.
  const t = text.replace(/\s+/g, '');
  const inStripped = t.match(new RegExp(`(?:/j/|/join/)(${CODE})(?![A-Za-z0-9-])`));
  if (inStripped) return inStripped[1];
  if (new RegExp(`^${CODE}$`).test(t)) return t;
  return null;
}

/** Why the current input isn't usable yet — `null` once it is. Shown under
 * the field so a dead button always explains itself. */
export function codeProblem(text: string): 'short' | 'long' | 'invalid' | null {
  const t = text.replace(/\s+/g, '');
  if (!t) return null;
  if (extractCode(t)) return null;
  if (/^[A-Za-z0-9-]+$/.test(t)) return t.length < MIN ? 'short' : t.length > MAX ? 'long' : 'invalid';
  return 'invalid';
}
