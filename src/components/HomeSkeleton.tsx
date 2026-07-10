import { useEffect } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors, hairline, radius } from '@/theme/tokens';

function Bar({
  width,
  height,
  style,
}: {
  width: number | `${number}%`;
  height: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        { width, height, borderRadius: height / 2, backgroundColor: colors.bgElevated },
        style,
      ]}
    />
  );
}

/** One pulsing placeholder shaped like a PendingCard (title/action/ring/button). */
function PulseCard() {
  const opacity = useSharedValue(0.55);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.55, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, [opacity]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          backgroundColor: colors.bgSurface,
          borderRadius: radius.card,
          borderWidth: hairline,
          borderColor: colors.strokeSubtle,
          padding: 20,
        },
        animStyle,
      ]}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <View style={{ flex: 1, gap: 10 }}>
          <Bar width="45%" height={12} />
          <Bar width="75%" height={20} />
          <Bar width="55%" height={13} style={{ marginTop: 2 }} />
        </View>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.bgElevated }} />
      </View>
      <Bar width="100%" height={56} style={{ marginTop: 16, borderRadius: radius.pill }} />
    </Animated.View>
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
