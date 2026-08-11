import { ReactNode, useRef } from 'react';
import { Animated as RNAnimated, Pressable, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, fonts, radius } from '@/theme/tokens';
import { AppText } from './ui';

export interface SwipeAction {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  /** background of this action's button — destructive actions use
   * colors.joker (the app's one "careful" tint; there's no red anywhere). */
  color: string;
  onPress: () => void;
}

/** Full button size on a card row, and on a one-line row. */
const SIZE = { full: 64, compact: 40 };
/** Gap between buttons, and from the screen edge. */
const GAP = 8;
/**
 * How far the row has to travel before the NEXT button starts to appear.
 * Apple's own rows bring actions in one at a time as the drag grows rather
 * than sliding a finished strip into view, so each button gets its own
 * entrance a little further along the drag.
 */
const REVEAL_STEP = 22;
/** Where a button's growth starts, measured in drag pixels. */
const FIRST_REVEAL = 10;
/** Drag distance over which a button goes from a dot to full size. */
const GROW_OVER = 34;
/**
 * Past this, letting go performs the destructive action outright instead of
 * parking the row open — the "swipe all the way to delete" every iOS list has.
 * Deliberately far: it must not be reachable by an ordinary swipe that meant
 * to reveal the buttons.
 */
const FULL_SWIPE = 220;

/**
 * iOS-standard swipe-from-the-right row actions.
 *
 * The animation is driven by `dragX` (how far the finger has actually moved)
 * rather than by Swipeable's `progress` (0→1 across the whole action strip).
 * That difference is the whole point: progress makes every button appear
 * together and finish together, which is what made this feel wrong. Keying off
 * real distance lets each button start growing at its own threshold, the way
 * Messages and Mail do it.
 *
 * The order matters too — the button nearest the screen edge is the one a
 * short swipe reveals first, so the reveal order runs from the END of the
 * array backwards. Destructive actions live last, so a small swipe surfaces
 * exactly the one people are usually reaching for.
 */
export function SwipeableRow({
  children,
  actions,
  compact,
}: {
  children: ReactNode;
  actions: SwipeAction[];
  /**
   * The row is a single line of text rather than a card, so the buttons shrink
   * to match its height instead of towering over it.
   */
  compact?: boolean;
}) {
  const ref = useRef<Swipeable>(null);
  /** Set while the drag is past FULL_SWIPE, read when the gesture ends. */
  const armed = useRef(false);
  /** renderRightActions runs on every render; the listener must not stack. */
  const watching = useRef(false);
  const size = compact ? SIZE.compact : SIZE.full;

  const renderRightActions = (
    _progress: RNAnimated.AnimatedInterpolation<number>,
    dragX: RNAnimated.AnimatedInterpolation<number>,
  ) => {
    // Arm the full swipe from the same value the animation uses, so the
    // threshold and the visuals can never disagree.
    if (!watching.current) {
      watching.current = true;
      (dragX as unknown as RNAnimated.Value).addListener?.(({ value }) => {
        armed.current = -value >= FULL_SWIPE;
      });
    }

    // dragX is negative when swiping left; flip it so the thresholds below
    // read as plain distances.
    const drag = (dragX as unknown as RNAnimated.Value).interpolate({
      inputRange: [-500, 0],
      outputRange: [500, 0],
      extrapolate: 'clamp',
    });

    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingRight: GAP,
          gap: GAP,
        }}
      >
        {actions.map((action, i) => {
          // Reveal order counts back from the edge: the last action appears
          // first, the one before it next, and so on.
          const order = actions.length - 1 - i;
          const start = FIRST_REVEAL + order * REVEAL_STEP;
          const end = start + GROW_OVER;

          // A dot that grows into the button, exactly as a short swipe does in
          // Messages. Not a fade: the size change is what reads as "appearing".
          const scale = drag.interpolate({
            inputRange: [0, start, end],
            outputRange: [0.2, 0.2, 1],
            extrapolate: 'clamp',
          });
          const opacity = drag.interpolate({
            inputRange: [0, start, start + GROW_OVER * 0.6],
            outputRange: [0, 0, 1],
            extrapolate: 'clamp',
          });

          return (
            <RNAnimated.View key={action.label} style={{ transform: [{ scale }], opacity }}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                  ref.current?.close();
                  action.onPress();
                }}
                accessibilityLabel={action.label}
                style={{
                  width: size,
                  height: size,
                  // Round, like the controls Apple reveals on a swipe — and a
                  // circle is what makes the scale-up read as a button
                  // arriving rather than a rectangle stretching.
                  borderRadius: size / 2,
                  backgroundColor: action.color,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                }}
              >
                <Feather name={action.icon} size={compact ? 15 : 18} color={colors.bgBase} />
                {/* Only the full-size button has room for a label under the
                    icon; on a one-line row the icon carries it alone. */}
                {compact ? null : (
                  <AppText style={{ fontFamily: fonts.bodyMedium, fontSize: 9, color: colors.bgBase }}>
                    {action.label}
                  </AppText>
                )}
              </Pressable>
            </RNAnimated.View>
          );
        })}
      </View>
    );
  };

  return (
    <Swipeable
      ref={ref}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={1.6}
      // The strip should be considered "open" while the buttons are visible,
      // rather than only after a long pull.
      rightThreshold={40}
      onSwipeableWillOpen={() => {
        // Dragged all the way: do the last (destructive) action instead of
        // parking the row open, which is what every iOS list does.
        if (!armed.current) return;
        armed.current = false;
        const last = actions[actions.length - 1];
        ref.current?.close();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        last?.onPress();
      }}
      onSwipeableClose={() => {
        armed.current = false;
      }}
    >
      {children}
    </Swipeable>
  );
}
