/** Pull an invite code out of a link or raw code (used by /start and the Home quick-start sheet). */
export function extractCode(text: string | null | undefined): string | null {
  if (!text) return null;
  const t = text.trim();
  const m = t.match(/(?:\/j\/|\/join\/)([A-Za-z0-9-]{3,32})/);
  if (m) return m[1];
  if (/^[A-Za-z0-9-]{3,32}$/.test(t)) return t;
  return null;
}
