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

/** One pulsing placeholder block — the shared building block for every skeleton in the app. */
export function SkeletonBlock({ style }: { style?: StyleProp<ViewStyle> }) {
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

  return <Animated.View style={[{ backgroundColor: colors.bgElevated }, style, animStyle]} />;
}

/** Skeleton for screens built around a big progress ring + title (Detail/Invite/Complete). */
export function RingScreenSkeleton({ withList = false }: { withList?: boolean }) {
  return (
    <View style={{ alignItems: 'center', paddingTop: 40, gap: 16 }}>
      <SkeletonBlock style={{ width: 180, height: 180, borderRadius: 90 }} />
      <SkeletonBlock style={{ width: 220, height: 22, borderRadius: 8, marginTop: 8 }} />
      <SkeletonBlock style={{ width: 140, height: 16, borderRadius: 8 }} />
      {withList ? (
        <View style={{ alignSelf: 'stretch', marginTop: 24, gap: 12 }}>
          <SkeletonBlock style={{ height: 56, borderRadius: radius.badge }} />
          <SkeletonBlock style={{ height: 56, borderRadius: radius.badge }} />
          <SkeletonBlock style={{ height: 56, borderRadius: radius.badge, opacity: 0.6 }} />
        </View>
      ) : null}
    </View>
  );
}

/** Skeleton for a small preview card (Join screen). */
export function CardSkeleton() {
  return (
    <View
      style={{
        backgroundColor: colors.bgSurface,
        borderRadius: radius.card,
        borderWidth: hairline,
        borderColor: colors.strokeSubtle,
        padding: 20,
        alignItems: 'center',
        gap: 14,
      }}
    >
      <SkeletonBlock style={{ width: 72, height: 72, borderRadius: 36 }} />
      <SkeletonBlock style={{ width: '70%', height: 22, borderRadius: 8 }} />
      <SkeletonBlock style={{ width: '50%', height: 15, borderRadius: 6 }} />
    </View>
  );
}
