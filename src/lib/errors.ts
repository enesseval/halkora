import { FunctionsHttpError } from '@supabase/supabase-js';
import { getDict } from '@/i18n';

/**
 * RPCs (Postgres `raise exception`) and Edge Functions (`fail()`) return a
 * stable UPPER_SNAKE_CASE code as the error message instead of hardcoded
 * prose, so the client can show it in whatever language is active. A code
 * with no dictionary entry (or a message that was never a code to begin
 * with — a raw Postgres/network error, say) falls through unchanged, so
 * this never turns a real error into a blank/broken message.
 */
function localizeIfCode(raw: string): string {
  const codes = getDict().errors.codes as Record<string, string>;
  return codes[raw] ?? raw;
}

/**
 * Supabase errors (PostgrestError, AuthError, FunctionsHttpError) are plain
 * objects with a `.message` field — they are NOT `instanceof Error`. Using
 * `e instanceof Error ? e.message : String(e)` on one prints "[object
 * Object]" instead of the real reason. This checks for `.message` first.
 */
export function errMessage(e: unknown): string {
  if (e instanceof Error) return localizeIfCode(e.message);
  if (e && typeof e === 'object' && 'message' in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === 'string' && m) return localizeIfCode(m);
  }
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

/**
 * The raw (un-localized) message/code a Supabase error carries — the stable
 * UPPER_SNAKE_CASE string an RPC/trigger raised, before `errMessage` turns it
 * into localized prose. Use this to branch on a specific code (e.g. show the
 * paywall on CHALLENGE_LIMIT_REACHED instead of a generic alert).
 */
function rawMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object' && 'message' in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return '';
}

/** True when a Supabase error was raised with this exact stable code. */
export function isErrorCode(e: unknown, code: string): boolean {
  return rawMessage(e).includes(code);
}

/** Pull the real `{ error }` JSON body out of a failed Edge Function call. */
export async function edgeFunctionError(e: unknown): Promise<Error> {
  if (e instanceof FunctionsHttpError) {
    try {
      const body = await e.context.json();
      if (body?.error) return new Error(localizeIfCode(body.error as string));
    } catch {
      // fall through to the generic message below
    }
  }
  return e instanceof Error ? e : new Error(String(e));
}
