import { Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { colors, fonts, hairline, type } from '@/theme/tokens';
import { AppText } from './ui';

interface Props {
  size?: number;
  day: number;
  done: boolean;
  time?: string;
  onCheckIn: () => void;
  onUndo?: () => void;
}

/** The central circular check-in target inside the L ring (E6 / E7). */
export function CheckInButton({
  size = 132,
  day,
  done,
  time,
  onCheckIn,
  onUndo,
}: Props) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const press = () => {
    if (done) return;
    scale.value = withSpring(0.97, { damping: 12, stiffness: 260 }, () => {
      scale.value = withSpring(1, { damping: 12, stiffness: 260 });
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onCheckIn();
  };

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={press}
        onLongPress={done ? onUndo : undefined}
        delayLongPress={600}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: done ? colors.bgElevated : colors.ember,
          borderWidth: done ? hairline : 0,
          borderColor: colors.strokeSubtle,
        }}
      >
        {done ? (
          <Animated.View entering={FadeIn.duration(250)} style={{ alignItems: 'center' }}>
            <AppText style={{ fontSize: 24, color: colors.ember, marginBottom: 2 }}>✓</AppText>
            <AppText
              style={{ fontFamily: fonts.displaySemibold, fontSize: 17, color: colors.textPrimary }}
            >
              Tamamlandı
            </AppText>
            <AppText variant="meta" color={colors.textTertiary} tabular style={{ marginTop: 2 }}>
              Gün {day}{time ? ` · ${time}` : ''}
            </AppText>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn.duration(200)} style={{ alignItems: 'center' }}>
            <AppText
              style={{ fontFamily: fonts.displaySemibold, fontSize: 22, color: colors.bgBase }}
            >
              Check-in
            </AppText>
            <AppText tabular style={{ ...type.meta, color: colors.bgBase, opacity: 0.7, marginTop: 2 }}>
              Gün {day}
            </AppText>
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
}
