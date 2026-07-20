import { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors, fonts } from '@/theme/tokens';
import { AppText } from './ui';

/**
 * The in-app boot screen shown after the native splash hides while auth/
 * locale/session restore in the background (app/_layout.tsx's
 * `useMinBootDelay`, held open for a deliberate minimum so it always reads
 * as an intentional beat, never a random flash). Three concentric dashed
 * rings spin at different speeds/directions — the app's segmented-ring
 * motif, purely decorative here, no real progress data involved.
 */
function RotatingRing({
  diameter,
  strokeWidth,
  color,
  dash,
  duration,
  reverse,
}: {
  diameter: number;
  strokeWidth: number;
  color: string;
  dash: string;
  duration: number;
  reverse?: boolean;
}) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(reverse ? -360 : 360, { duration, easing: Easing.linear }),
      -1,
      false,
    );
  }, [duration, reverse, rotation]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const r = diameter / 2 - strokeWidth / 2;

  return (
    <Animated.View
      style={[{ position: 'absolute', width: diameter, height: diameter }, style]}
    >
      <Svg width={diameter} height={diameter}>
        <Circle
          cx={diameter / 2}
          cy={diameter / 2}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={dash}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
}

export function BootSplash() {
  const pulse = useSharedValue(0.85);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1.15, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [pulse]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgBase, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 180, height: 180, alignItems: 'center', justifyContent: 'center' }}>
        <RotatingRing diameter={180} strokeWidth={2.5} color={colors.strokeSubtle} dash="1 15" duration={14000} />
        <RotatingRing diameter={140} strokeWidth={4} color={colors.waiting} dash="9 17" duration={9000} reverse />
        <RotatingRing diameter={96} strokeWidth={6} color={colors.ember} dash="17 21" duration={6000} />
        <Animated.View
          style={[
            {
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: colors.ember,
            },
            dotStyle,
          ]}
        />
      </View>

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
