import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colors, fonts } from '@/theme/tokens';
import { ProgressRing } from './ProgressRing';
import { AppText } from './ui';
import type { SegmentState } from '@/data/types';

const TOTAL = 8;
const STEP_MS = 260;

/**
 * The in-app boot screen shown after the native splash hides while auth/
 * locale/session restore run in the background (app/_layout.tsx's
 * `useMinBootDelay`, held open for a deliberate minimum so it always reads
 * as an intentional beat, never a random flash). Reuses the same
 * ProgressRing the rest of the app renders for real challenge progress —
 * a bespoke dashed-circle spinner here read as a completely unrelated
 * visual language (saha testi bulgusu). Segments chase around the ring
 * (today → done), pause once fully lit, then reset — purely decorative,
 * no real progress data involved.
 */
export function BootSplash() {
  const [days, setDays] = useState<SegmentState[]>(() => Array(TOTAL).fill('empty'));

  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i = (i + 1) % (TOTAL + 2);
      const next: SegmentState[] = Array(TOTAL).fill('empty');
      for (let d = 0; d < TOTAL; d++) {
        if (d < i - 1) next[d] = 'done';
        else if (d === i - 1) next[d] = 'today';
      }
      setDays(next);
    }, STEP_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgBase, alignItems: 'center', justifyContent: 'center' }}>
      <ProgressRing totalDays={TOTAL} days={days} size="L" />

      <Animated.View entering={FadeIn.delay(280).duration(700)} style={{ marginTop: 30 }}>
        <AppText
          style={{
            fontFamily: fonts.displaySemibold,
            fontSize: 14,
            letterSpacing: 6,
            color: colors.textSecondary,
          }}
        >
          HALKORA
        </AppText>
      </Animated.View>
    </View>
  );
}
