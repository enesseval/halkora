import { View } from 'react-native';
import { colors, hairline, radius } from '@/theme/tokens';
import { SkeletonBlock } from './Skeleton';

/** One static placeholder shaped like a PendingCard (title/action/ring/button); each
 * inner block pulses independently via SkeletonBlock. */
function PulseCard() {
  return (
    <View
      style={{
        backgroundColor: colors.bgSurface,
        borderRadius: radius.card,
        borderWidth: hairline,
        borderColor: colors.strokeSubtle,
        padding: 20,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <View style={{ flex: 1, gap: 10 }}>
          <SkeletonBlock style={{ width: '45%', height: 12, borderRadius: 6 }} />
          <SkeletonBlock style={{ width: '75%', height: 20, borderRadius: 10 }} />
          <SkeletonBlock style={{ width: '55%', height: 13, borderRadius: 6, marginTop: 2 }} />
        </View>
        <SkeletonBlock style={{ width: 72, height: 72, borderRadius: 36 }} />
      </View>
      <SkeletonBlock style={{ width: '100%', height: 56, borderRadius: radius.pill, marginTop: 16 }} />
    </View>
  );
}

/** Shown on Home while the first real Supabase fetch is in flight — replaces
 * the (otherwise momentarily-visible) Phase-1 mock seed data. */
export function HomeSkeleton() {
  return (
    <View style={{ gap: 12 }}>
      <PulseCard />
      <PulseCard />
    </View>
  );
}
