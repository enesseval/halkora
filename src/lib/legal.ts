/**
 * The published legal pages. One place for them, because they appear in
 * onboarding, in Settings, and in the App Store Connect listing — three
 * copies of a URL is three chances for one of them to rot.
 *
 * These must be reachable and must actually exist: App Review opens them, and
 * a 404 on the privacy policy is a rejection on its own.
 */
export const TERMS_URL = 'https://halkora.app/terms';
export const PRIVACY_URL = 'https://halkora.app/privacy';
export const SUPPORT_URL = 'https://halkora.app/support';

/** Where reports and abuse complaints reach a human. Shown in the support
 * page and given to App Review as the moderation contact. */
export const SUPPORT_EMAIL = 'destek@halkora.app';
