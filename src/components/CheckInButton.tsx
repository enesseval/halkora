import { useEffect, useRef, useState } from 'react';
import { Pressable } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  cancelAnimation,
  FadeIn,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors, fonts, hairline, type } from '@/theme/tokens';
import { useT } from '@/i18n';
import { AppText, FixedType } from './ui';

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
/**
 * 5, not 3. At three points the hold ring was a hairline you had to go
 * looking for — the feedback existed and still read as "nothing is
 * happening" (saha testi bulgusu — "telefonda da çok ince bir nokta var
 * orayı yakalamak gerekiyor").
 */
const UNDO_RING_WIDTH = 5;

/**
 * How long the button stays closed after an action, showing what happened.
 *
 * Both check-in and undo used to change the button's contents the instant
 * they were tapped, while the write was still in flight — nothing said the
 * app had heard you, and nothing stopped a second tap landing on a button
 * that was already busy. The circle now fills, a mark lands in it, and the
 * whole thing is inert until it clears.
 */
const CONFIRM_MS = 1100;

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

  /**
   * The confirmation overlay. `confirm` is what it says — a tick for a
   * check-in, a turned-back arrow for an undo — and `fill` drives the circle
   * that grows behind it. While either is set the button takes no input.
   */
  const [confirm, setConfirm] = useState<'done' | 'undone' | null>(null);
  /**
   * One timeline for the whole confirmation, 0 → 1 → 0. The circle and the
   * mark are both read off it rather than animated separately, so they can
   * never drift out of step with each other.
   */
  const confirmT = useSharedValue(0);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Circle first, over the opening 60% of the timeline.
  const fillStyle = useAnimatedStyle(() => {
    const v = Math.min(confirmT.value / 0.6, 1);
    return { transform: [{ scale: v }], opacity: v > 0 ? 1 : 0 };
  });
  // Mark second, landing in the circle once it's most of the way open.
  const markStyle = useAnimatedStyle(() => {
    const v = Math.max((confirmT.value - 0.45) / 0.55, 0);
    return { transform: [{ scale: v }], opacity: v };
  });

  const runConfirm = (kind: 'done' | 'undone') => {
    setConfirm(kind);
    // Zero-length step back to 0 first, so a second run can't inherit where
    // the last one stopped.
    confirmT.value = withSequence(
      withTiming(0, { duration: 0 }),
      withTiming(1, { duration: 560, easing: Easing.out(Easing.cubic) }),
      withDelay(CONFIRM_MS - 560, withTiming(0, { duration: 220 })),
    );
    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => setConfirm(null), CONFIRM_MS + 220);
  };

  useEffect(
    () => () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
    },
    [],
  );

  const press = () => {
    if (done || confirm) return;
    scale.value = withSpring(0.97, { damping: 12, stiffness: 260 }, () => {
      scale.value = withSpring(1, { damping: 12, stiffness: 260 });
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    runConfirm('done');
    onCheckIn();
  };

  const fireUndo = () => {
    if (fired.current || !onUndo) return;
    fired.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    runConfirm('undone');
    onUndo();
  };

  const startHold = () => {
    if (!done || !onUndo || confirm) return;
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
    <FixedType>
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

        {/* A circle of a fixed radius: text inside it cannot reflow its way
            out of trouble, it just spills past the edge. So the type here
            neither follows the system size setting nor runs wider than the
            circle's own usable chord. */}
        {/* The confirmation. Sits over whatever the button's contents happen
            to be, so it doesn't matter that `done` has already flipped
            underneath it — the circle fills, the mark lands, and the button
            is inert until both clear. */}
        {confirm ? (
          <>
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: 'absolute',
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  backgroundColor: confirm === 'done' ? colors.ember : colors.bgElevated,
                  borderWidth: confirm === 'done' ? 0 : hairline,
                  borderColor: colors.strokeSubtle,
                },
                fillStyle,
              ]}
            />
            <Animated.View pointerEvents="none" style={[{ position: 'absolute' }, markStyle]}>
              <Feather
                name={confirm === 'done' ? 'check' : 'rotate-ccw'}
                size={Math.round(size * 0.34)}
                color={confirm === 'done' ? colors.bgBase : colors.textSecondary}
              />
            </Animated.View>
          </>
        ) : null}

        {done ? (
          <Animated.View
            entering={FadeIn.duration(250)}
            style={{ alignItems: 'center', maxWidth: size * 0.78 }}
          >
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
                numberOfLines={2}
                style={{ marginTop: 6, opacity: 0.75, textAlign: 'center' }}
              >
                {t.detail.undoHint}
              </AppText>
            ) : null}
          </Animated.View>
        ) : (
          <Animated.View
            entering={FadeIn.duration(200)}
            style={{ alignItems: 'center', maxWidth: size * 0.78 }}
          >
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
    </FixedType>
  );
}
