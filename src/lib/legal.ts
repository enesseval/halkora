/**
 * The published legal pages. One place for them, because they appear in
 * onboarding, on the paywall, and in the App Store Connect listing — three
 * copies of a URL is three chances for one of them to rot.
 *
 * These must be reachable and must stay reachable: App Review opens them, and
 * a 404 on the privacy policy is a rejection on its own.
 *
 * The host is the apex, without `www.`, because that is the direction the
 * published site actually redirects: www answers 307 to halkora.app, and the
 * site's own canonical/og tags all name the apex. Trailing slashes are kept
 * exactly as published, so no redirect sits between a reviewer's tap and the
 * page.
 */
export const PRIVACY_URL = 'https://halkora.app/gizlilik/';
export const TERMS_URL = 'https://halkora.app/kosullar/';
export const SUPPORT_URL = 'https://halkora.app/destek/';

/**
 * Apple asks for this one separately (App Store Connect → App Privacy →
 * Account Deletion URL) whenever an app creates accounts. It has to describe
 * the in-app route as well — Settings → Hesabı sil — not only offer a form.
 */
export const ACCOUNT_DELETION_URL = 'https://halkora.app/hesap-silme/';
