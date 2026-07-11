import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * Universal Links use the short public path halkora.app/j/{code} (see
 * InviteShare.tsx + docs/ROADMAP.md Faz 3A-2), but the app's real join screen
 * lives at /join/{code}. This route exists only so a link tapped with the app
 * installed lands somewhere real instead of a 404 — it immediately forwards.
 */
export default function ShortJoinRedirect() {
  const { code } = useLocalSearchParams<{ code: string }>();
  if (!code) return null;
  return <Redirect href={`/join/${code}`} />;
}
