# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# i18n is mandatory for every new user-facing string

This app is fully localized (Turkish + English) via a custom lightweight system in `src/i18n/` — `tr.ts` (canonical), `en.ts` (typed as `Dictionary = typeof tr` for compile-time parity), and `index.ts` (`useT()` for components/hooks, `getDict()`/`getLocale()` for plain functions, stores, and non-hook code).

Whenever you add ANY new user-facing text — a new screen, component, alert, toast, error message, empty state, push notification copy, etc. — you MUST:
- Add the string to both `src/i18n/tr.ts` and `src/i18n/en.ts` under an appropriately named namespace/key. Never hardcode a literal string in a component, hook, or data/store file.
- Use `useT()` inside React components/hooks (`const { t } = useT()`), and `getDict()` inside plain async functions, zustand store actions, or other non-hook code.
- For server-side text (Supabase RPCs, Edge Functions): RPCs/Edge Functions that surface errors to the client must `raise`/`fail` with a stable UPPER_SNAKE_CASE code (not prose), and the client maps the code to localized text via `t.errors.codes` in `src/lib/errors.ts`. Edge Functions that compose push notification copy server-side (they run in Deno and can't import `src/i18n/*`) keep their own small hand-maintained `COPY` dict (tr/en) kept in sync by hand with the client dictionaries, and look up the recipient's locale from `profiles.locale`.
- Never leave a string only in one language "for now" — both `tr.ts` and `en.ts` must be updated in the same change, and `en.ts`'s `Dictionary` typing will fail `tsc` if they drift out of shape.

This is a standing instruction, not a one-time task — it applies to every future feature, however small.
