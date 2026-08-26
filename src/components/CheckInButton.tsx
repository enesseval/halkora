import { useRef } from 'react';
import { Pressable } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import Animated, {
  cancelAnimation,
  FadeIn,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors, fonts, hairline, type } from '@/theme/tokens';
import { useT } from '@/i18n';
import { AppText } from './ui';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * How long undo has to be held.
 *
 * Longer than the 600ms this used to spend as a bare `onLongPress`, because
 * the hold is now visible: a ring closes around the button while you hold it.
 * A press-and-wait with nothing on screen is indistinguishable from a press
 * that did nothing, which is how undo came to be reported as missing and then
 * as broken — you let go before it fired and there was no way to know.
 */
const UNDO_HOLD_MS = 750;
const UNDO_RING_WIDTH = 3;

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
  const { t } = useT();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  /** 0 → 1 while the undo press is held. Drives both the ring and the fire. */
  const hold = useSharedValue(0);
  /** The hold completed and undo already ran — don't run it twice if the
   * finger stays down while the button swaps back to its check-in state. */
  const fired = useRef(false);

  const radius = size / 2 - UNDO_RING_WIDTH / 2;
  const circumference = 2 * Math.PI * radius;
  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - hold.value),
    opacity: hold.value > 0 ? 1 : 0,
  }));

  const press = () => {
    if (done) return;
    scale.value = withSpring(0.97, { damping: 12, stiffness: 260 }, () => {
      scale.value = withSpring(1, { damping: 12, stiffness: 260 });
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onCheckIn();
  };

  const fireUndo = () => {
    if (fired.current || !onUndo) return;
    fired.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onUndo();
  };

  const startHold = () => {
    if (!done || !onUndo) return;
    fired.current = false;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    hold.value = 0;
    hold.value = withTiming(1, { duration: UNDO_HOLD_MS, easing: Easing.linear }, (finished) => {
      if (finished) runOnJS(fireUndo)();
    });
  };

  const endHold = () => {
    cancelAnimation(hold);
    hold.value = withTiming(0, { duration: 160 });
  };

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={press}
        onPressIn={startHold}
        onPressOut={endHold}
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
        {/* The hold, drawn. Starts at 12 o'clock and closes clockwise, so
            "full circle" and "released" mean the same thing. */}
        {done && onUndo ? (
          <Svg
            width={size}
            height={size}
            style={{ position: 'absolute', top: 0, left: 0 }}
            pointerEvents="none"
          >
            <AnimatedCircle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={colors.ember}
              strokeWidth={UNDO_RING_WIDTH}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={circumference}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              animatedProps={ringProps}
            />
          </Svg>
        ) : null}

        {done ? (
          <Animated.View entering={FadeIn.duration(250)} style={{ alignItems: 'center' }}>
            <AppText style={{ fontSize: 24, color: colors.ember, marginBottom: 2 }}>✓</AppText>
            <AppText
              style={{ fontFamily: fonts.displaySemibold, fontSize: 17, color: colors.textPrimary }}
            >
              {t.common.completed}
            </AppText>
            <AppText variant="meta" color={colors.textTertiary} tabular style={{ marginTop: 2 }}>
              {t.chat.day(day)}{time ? ` · ${time}` : ''}
            </AppText>
            {onUndo ? (
              <AppText
                variant="meta"
                color={colors.textTertiary}
                style={{ marginTop: 6, opacity: 0.75, textAlign: 'center' }}
              >
                {t.detail.undoHint}
              </AppText>
            ) : null}
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn.duration(200)} style={{ alignItems: 'center' }}>
            <AppText
              style={{ fontFamily: fonts.displaySemibold, fontSize: 22, color: colors.bgBase }}
            >
              {t.common.checkIn}
            </AppText>
            <AppText tabular style={{ ...type.meta, color: colors.bgBase, opacity: 0.7, marginTop: 2 }}>
              {t.chat.day(day)}
            </AppText>
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
}
