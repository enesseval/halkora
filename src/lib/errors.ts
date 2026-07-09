/**
 * Supabase errors (PostgrestError, AuthError, FunctionsHttpError) are plain
 * objects with a `.message` field — they are NOT `instanceof Error`. Using
 * `e instanceof Error ? e.message : String(e)` on one prints "[object
 * Object]" instead of the real reason. This checks for `.message` first.
 */
export function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object' && 'message' in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === 'string' && m) return m;
  }
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
