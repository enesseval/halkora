import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, type PurchasesPackage } from 'react-native-purchases';

/**
 * RevenueCat — the paywall's store side.
 *
 * The app never decides who is Pro. A purchase tells RevenueCat, RevenueCat
 * verifies it with Apple and calls our webhook, and the webhook writes
 * `profiles.is_pro`. The app only reads that. Trusting the device instead
 * would make Pro a client-side boolean anyone could flip.
 */

// Public SDK key — safe to ship by RevenueCat's own design (it can only read
// offerings and start purchases; the secret key is what can grant
// entitlements, and it never leaves the server). Read from the environment
// anyway so the repo carries no keys at all.
const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';

/** Matches the entitlement configured in RevenueCat. */
export const PRO_ENTITLEMENT = 'pro';
/** The offering the paywall reads its packages from. */
export const DEFAULT_OFFERING = 'default';

export const isPurchasesConfigured = Boolean(IOS_KEY) && Platform.OS === 'ios';

let configured = false;
/** Why configure() failed, kept for purchasesDiagnostics — swallowing this is
 * what made "no packages" impossible to tell apart from "no key". */
let configureError: string | null = null;

/**
 * Call once the Supabase user id is known — NOT at app start.
 *
 * `appUserID` has to be the Supabase user id: it is the only thing the
 * webhook receives that identifies which row in `profiles` to mark as Pro.
 * Letting RevenueCat generate an anonymous id instead would leave purchases
 * attached to a device rather than an account, and they would not survive a
 * reinstall or follow the person to a new phone.
 */
export function configurePurchases(supabaseUserId: string): void {
  if (!isPurchasesConfigured || !supabaseUserId) return;
  try {
    if (configured) {
      // Signing in as someone else on the same device: point RevenueCat at
      // the new account rather than leaving the previous one's entitlements
      // attached.
      Purchases.logIn(supabaseUserId).catch(() => {});
      return;
    }
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.WARN);
    Purchases.configure({ apiKey: IOS_KEY, appUserID: supabaseUserId });
    configured = true;
    configureError = null;
  } catch (e) {
    // A paywall that can't reach the store is a degraded screen, never a
    // crash on launch — but the reason is recorded rather than lost.
    configureError = e instanceof Error ? e.message : String(e);
  }
}

/**
 * DEV-only readback, same idea as widgetDiagnostics: every failure in this
 * chain is silent by design, so a dead paywall is indistinguishable from a
 * missing key, an unlinked native module, an inactive Paid Applications
 * agreement, or an offering with no packages attached. This says which.
 *
 * The key is never printed — only its prefix and length, which is enough to
 * tell "missing" from "present but wrong shape".
 */
export async function purchasesDiagnostics(): Promise<string> {
  if (Platform.OS !== 'ios') return 'iOS değil';

  const keyShape = IOS_KEY
    ? `${IOS_KEY.slice(0, 5)}…(${IOS_KEY.length})`
    : 'YOK — .env içindeki EXPO_PUBLIC_REVENUECAT_IOS_KEY build alınırken okunmamış';
  if (!IOS_KEY) return `anahtar ${keyShape}`;
  if (!IOS_KEY.startsWith('appl_')) return `anahtar biçimi yanlış: ${keyShape} (appl_ ile başlamalı)`;

  // The JS package can be installed while its native side isn't in the binary
  // — that's a pod install/rebuild problem, and it looks exactly like a
  // network failure from the outside.
  if (!configured) {
    return configureError
      ? `configure başarısız: ${configureError}`
      : `configure hiç çalışmadı (oturum yok?) · anahtar ${keyShape}`;
  }

  try {
    const offerings = await Purchases.getOfferings();
    const names = Object.keys(offerings.all);
    const offering = offerings.all[DEFAULT_OFFERING] ?? offerings.current;
    if (!offering) {
      return `bağlandı ama offering yok · görünen: ${names.join(',') || 'hiç'} — RevenueCat'te "${DEFAULT_OFFERING}" Current mı?`;
    }
    const pkgs = offering.availablePackages.length;
    if (pkgs === 0) {
      return `offering "${offering.identifier}" var ama 0 paket — ürünler App Store Connect'te "Ready to Submit" mi, Paid Applications sözleşmesi aktif mi?`;
    }
    return `OK · offering "${offering.identifier}" · ${pkgs} paket · aylık:${
      offering.monthly ? offering.monthly.product.priceString : 'yok'
    } yıllık:${offering.annual ? offering.annual.product.priceString : 'yok'}`;
  } catch (e) {
    return `getOfferings hatası: ${e instanceof Error ? e.message : String(e)}`;
  }
}

export interface PlanOption {
  pkg: PurchasesPackage;
  /** Localized, store-formatted price ("₺59,99") — Apple requires the real
   * price for the viewer's storefront, not a hard-coded one. */
  price: string;
}

export interface Plans {
  monthly?: PlanOption;
  annual?: PlanOption;
}

/** The current offering's monthly/annual packages with their real prices. */
export async function fetchPlans(): Promise<Plans> {
  if (!isPurchasesConfigured) return {};
  const offerings = await Purchases.getOfferings();
  const offering = offerings.all[DEFAULT_OFFERING] ?? offerings.current;
  if (!offering) return {};
  const pick = (p?: PurchasesPackage | null): PlanOption | undefined =>
    p ? { pkg: p, price: p.product.priceString } : undefined;
  return {
    monthly: pick(offering.monthly),
    annual: pick(offering.annual),
  };
}

/** True when the purchase went through and the entitlement is active. */
export async function purchase(pkg: PurchasesPackage): Promise<boolean> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return Boolean(customerInfo.entitlements.active[PRO_ENTITLEMENT]);
}

/**
 * Required by Apple — someone on a new phone has to be able to get their
 * subscription back, and an app without this button is rejected for it.
 */
export async function restore(): Promise<boolean> {
  const customerInfo = await Purchases.restorePurchases();
  return Boolean(customerInfo.entitlements.active[PRO_ENTITLEMENT]);
}

/**
 * Did the person cancel the App Store sheet? That is not a failure and must
 * not raise an error dialog — the flag RevenueCat sets is the only way to
 * tell it apart from a real problem.
 */
export function isCancelled(e: unknown): boolean {
  return Boolean(e && typeof e === 'object' && (e as { userCancelled?: boolean }).userCancelled);
}
