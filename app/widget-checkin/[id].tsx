import { useEffect, useRef } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useChallenge, useChallengesQuery, useCheckIn } from '@/hooks';
import { BootSplash } from '@/components/BootSplash';

/**
 * Tapping the not-checked-in-yet state of the home-screen widget
 * (targets/widget/HalkoraWidget.swift's widgetURL) lands here instead of
 * straight on the challenge — this route's only job is to fire the check-in
 * the instant challenge data is available, then hand off to the real Detail
 * screen. A true no-app-open check-in needs an iOS 17 AppIntent calling
 * Supabase directly from Swift (auth token + network code in the widget
 * process) — saved for a later round (docs/ROADMAP.md); this "app opens for
 * an instant, checks in, lands on Detail" is the MVP version of "check-in
 * yapabileceğim" from the widget.
 */
export default function WidgetCheckIn() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { loading } = useChallengesQuery();
  const challenge = useChallenge(id);
  const { checkIn, meCheckedInToday } = useCheckIn(id ?? '');
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current || !id) return;
    if (loading) return; // wait for the shared challenges query to resolve
    if (!challenge) {
      // Not in the list (stale widget snapshot, left the challenge, etc.) —
      // nothing sane to check into, bail to Home instead of hanging here.
      router.replace('/');
      return;
    }
    fired.current = true;
    if (!meCheckedInToday) checkIn();
    router.replace(`/challenge/${id}`);
  }, [id, loading, challenge, meCheckedInToday, checkIn, router]);

  return <BootSplash />;
}
