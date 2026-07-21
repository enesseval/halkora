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

/**
 * True for a genuine network failure — the request never reached the server
 * at all (device offline, DNS down, timeout). React Native's and the web's
 * fetch both throw a bare TypeError for this ("Network request failed" /
 * "Failed to fetch"), with none of the structure a real Postgrest/Auth/Edge
 * Function error always has. Used to show a calm "check your connection"
 * instead of a raw TypeError or a scary/meaningless dev diagnostic — the
 * user is offline, not looking at a broken backend.
 */
export function isNetworkError(e: unknown): boolean {
  if (e instanceof TypeError) return true;
  if (e && typeof e === 'object' && 'message' in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === 'string') return /network request failed|failed to fetch|network error/i.test(m);
  }
  return false;
}

/**
 * True for a raw Postgres/PostgREST permission failure — an RLS policy
 * rejected the request (SQLSTATE 42501, or the literal "row-level security
 * policy" wording Postgres always uses for it). This is NOT one of our own
 * RPC/Edge Function codes (those `raise`/`fail` with a stable UPPER_SNAKE_CASE
 * string we map via `errors.codes`) — it's Postgres's own internal error text,
 * which `errMessage` has no code to localize, so it used to fall through to
 * the user completely raw (e.g. `new row violates row-level security policy
 * for table "messages"`). Collapses to the same calm generic line as any
 * other unexpected failure instead.
 */
export function isPermissionError(e: unknown): boolean {
  if (e && typeof e === 'object' && 'code' in e) {
    const c = (e as { code?: unknown }).code;
    if (c === '42501') return true;
  }
  return /row-level security policy/i.test(rawMessage(e));
}

/**
 * `errMessage()`, but a genuine offline/network failure ALWAYS collapses to
 * the localized "check your connection" line, never the raw TypeError (or,
 * at any call site that used to pair it with a dev-only diagnostic, never
 * that either), and a raw Postgres/RLS permission failure collapses to the
 * generic "something went wrong" line rather than leaking Postgres's own
 * internal wording. Prefer this over `errMessage()` at every place an error
 * reaches the user directly (an Alert, an inline error line) — reserve the
 * plain `errMessage()` for places that specifically need the raw/localized
 * server code (e.g. deciding which UI to show).
 */
export function friendlyErrorMessage(e: unknown): string {
  if (isNetworkError(e)) return getDict().errors.checkConnection;
  if (isPermissionError(e)) return getDict().errors.generic;
  return errMessage(e);
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
