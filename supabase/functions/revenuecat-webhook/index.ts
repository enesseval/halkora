// RevenueCat → profiles.is_pro
//
// This is the only thing allowed to decide who is Pro. The app never writes
// is_pro: a device can be modified, and a client-side boolean would make Pro
// free for anyone willing to look. RevenueCat verifies the receipt with Apple
// and calls this; this writes the answer down.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   REVENUECAT_AUTH — must equal, EXACTLY, the Authorization header value set
//                     in RevenueCat → Integrations → Webhooks. If you typed
//                     "Bearer xyz" there, the secret is "Bearer xyz" including
//                     the word Bearer.
//
// Deploy WITHOUT JWT verification — RevenueCat sends its own header, not a
// Supabase JWT:
//   supabase functions deploy revenuecat-webhook --no-verify-jwt
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Events that mean "this person should have Pro right now", and the ones that
 * mean they shouldn't.
 *
 * TRANSFER is handled separately below — it is the restore path, and its
 * payload has a different shape.
 *
 * CANCELLATION is deliberately NOT in the revoking list: cancelling stops the
 * renewal, it does not end the period already paid for. Someone who cancels on
 * day 2 of a month keeps Pro until day 30 — taking it away immediately would
 * be taking something they paid for. EXPIRATION is the event that actually
 * ends it.
 */
const GRANTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'NON_RENEWING_PURCHASE',
  'SUBSCRIPTION_EXTENDED',
  'PRODUCT_CHANGE',
]);
const REVOKES = new Set(['EXPIRATION', 'REFUND', 'SUBSCRIPTION_PAUSED']);

Deno.serve(async (req) => {
  // A wrong secret must not look like a bug on RevenueCat's side, so this
  // answers 401 rather than failing silently — RevenueCat surfaces it in its
  // own delivery log.
  const expected = Deno.env.get('REVENUECAT_AUTH');
  if (!expected) {
    console.error('revenuecat-webhook: REVENUECAT_AUTH not set');
    return new Response('not configured', { status: 500 });
  }
  if (req.headers.get('Authorization') !== expected) {
    return new Response('unauthorized', { status: 401 });
  }

  try {
    const payload = await req.json();
    const event = payload?.event ?? {};
    const type: string = event.type ?? '';

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // An anonymous RevenueCat id (starts with $RCAnonymousID) is not a
    // Supabase user and would fail the uuid cast; skip those rather than throw.
    const real = (ids: unknown): string[] =>
      (Array.isArray(ids) ? ids : [ids])
        .filter((v): v is string => typeof v === 'string' && v.length > 0)
        .filter((v) => !v.startsWith('$RCAnonymousID'));

    /** Writes one verdict and reports whether the DB accepted it. */
    const write = async (ids: string[], isPro: boolean): Promise<boolean> => {
      if (ids.length === 0) return true;
      const { error } = await admin.from('profiles').update({ is_pro: isPro }).in('id', ids);
      if (error) {
        console.error('revenuecat-webhook: update failed', error);
        return false;
      }
      console.log('revenuecat-webhook', type, ids.join(','), '→ is_pro', isPro);
      return true;
    };

    /**
     * TRANSFER is what "Satın alımları geri yükle" actually produces.
     *
     * When an Apple Account's receipt is already attached to some other
     * RevenueCat app user id — a reinstall, a deleted-and-recreated account,
     * a second account on the same phone — restoring moves it, and RevenueCat
     * reports the move as TRANSFER. That event carries `transferred_to` /
     * `transferred_from` arrays and NO `app_user_id`, so this function used to
     * log "no app_user_id" and write nothing: the person had a live
     * subscription, the app saw the entitlement, and profiles.is_pro stayed
     * false forever (buglar #4 / 14.7).
     */
    if (type === 'TRANSFER') {
      const to = real(event.transferred_to);
      const from = real(event.transferred_from).filter((id) => !to.includes(id));
      // The entitlement now belongs to `to`. Granting first means a mistake in
      // the other direction can never leave a paying person without Pro.
      const okTo = await write(to, true);
      const okFrom = await write(from, false);
      if (!okTo || !okFrom) return new Response('update failed', { status: 500 });
      if (to.length === 0 && from.length === 0) {
        console.log('revenuecat-webhook: TRANSFER with no usable ids');
      }
      return new Response('ok', { status: 200 });
    }

    // app_user_id is the Supabase user id, because that is what the app passes
    // to Purchases.configure(). If it ever isn't, there is nothing to update
    // and guessing would be worse than stopping.
    const userId: string | undefined = event.app_user_id;
    if (!userId) {
      console.error('revenuecat-webhook: no app_user_id', type);
      return new Response('ok', { status: 200 });
    }

    let isPro: boolean;
    if (GRANTS.has(type)) isPro = true;
    else if (REVOKES.has(type)) isPro = false;
    else {
      // BILLING_ISSUE, SUBSCRIBER_ALIAS and the rest carry no verdict on their
      // own. Acknowledged so RevenueCat stops retrying, ignored otherwise —
      // the next real event settles it.
      return new Response('ok', { status: 200 });
    }

    if (!await write(real(userId), isPro)) {
      // 500 on purpose: RevenueCat retries, and a database blip shouldn't cost
      // someone the Pro they paid for.
      return new Response('update failed', { status: 500 });
    }
    return new Response('ok', { status: 200 });
  } catch (e) {
    console.error('revenuecat-webhook', e);
    return new Response('bad request', { status: 400 });
  }
});
