import { ReactNode, useRef } from 'react';
import { Animated as RNAnimated, Pressable, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, radius } from '@/theme/tokens';

export interface SwipeAction {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  /** background of this action's button — destructive actions use
   * colors.joker (the app's one "careful" tint; there's no red anywhere). */
  color: string;
  onPress: () => void;
}

/**
 * The one row whose actions are currently showing, app-wide.
 *
 * Two rows open at once is not a state iOS ever puts you in, and it was
 * reachable here: opening a second row left the first one sitting open
 * behind it, and tapping anywhere else on the screen left it open too
 * (saha testi bulgusu). A module-level reference is enough — there is only
 * ever one list on screen, and "the open row" is genuinely one thing.
 */
let openRow: { close: () => void } | null = null;

/** Closes whatever row is open. Screens call this from a background tap. */
export function closeOpenSwipeableRow(): void {
  openRow?.close();
  openRow = null;
}

/** Full button size on a card row, and on a one-line row. */
const SIZE = { full: 52, compact: 40 };
/** Gap between buttons, and from the screen edge. */
const GAP = 4;
/** Breathing room between the row itself and the first button. */
const LEAD = 8;
/**
 * How far past the open strip a drag has to go before letting go performs the
 * destructive action outright — the "swipe all the way to delete" every iOS
 * list has.
 *
 * Measured in the same units as `transX`, which is the finger's travel
 * divided by `friction`. It used to sit at a flat 220 with an extra 90 of
 * margin, numbers that could not be reached at all: `overshootFriction` was
 * 8, so every point past the strip's own width cost EIGHT points of finger
 * travel. Reaching 220 needed most of a metre. That is why the row "simply
 * stopped, open, however hard you pulled" even after overshoot was turned on.
 */
const FULL_SWIPE_MARGIN = 70;
/** How far the edge button stretches once the full swipe is armed. */
const FULL_SWIPE_GROWTH = 190;

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
  /** Stable identity for the registry above, so it survives re-renders. */
  const handle = useRef({ close: () => ref.current?.close() });
  /** Set while the drag is past FULL_SWIPE, read when the gesture ends. */
  const armed = useRef(false);
  /** renderRightActions runs on every render; the listener must not stack. */
  const watching = useRef(false);
  const size = compact ? SIZE.compact : SIZE.full;

  const renderRightActions = (
    _progress: RNAnimated.AnimatedInterpolation<number>,
    dragX: RNAnimated.AnimatedInterpolation<number>,
  ) => {
    // Measured from where the buttons END, so the threshold scales with how
    // many actions the row has instead of being a number that happens to
    // work for two.
    const fullSwipeAt = LEAD + actions.length * (size + GAP) + FULL_SWIPE_MARGIN;

    // Arm the full swipe from the same value the animation uses, so the
    // threshold and the visuals can never disagree.
    if (!watching.current) {
      watching.current = true;
      (dragX as unknown as RNAnimated.Value).addListener?.(({ value }) => {
        if (-value < fullSwipeAt || armed.current) return;
        // A latch, not a live reading. Letting go springs the row back to the
        // open position, which is BELOW the threshold — so writing the live
        // comparison here cleared the flag again before onSwipeableWillOpen
        // could read it, and the full swipe never fired even when it had
        // genuinely been reached. Cleared when the gesture is resolved, not
        // when the value dips.
        armed.current = true;
        // A tap on the shoulder at the moment letting go would fire the
        // action, which is the whole reason Apple's version feels safe to
        // pull into rather than something you fall off.
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => {});
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
          paddingLeft: LEAD,
          paddingRight: GAP,
          gap: GAP,
          // Nothing may be drawn outside the strip the drag has actually
          // opened — without this a half-scaled button still paints over the
          // row behind it.
          overflow: 'hidden',
        }}
      >
        {actions.map((action, i) => {
          // Reveal order counts back from the edge: the last action appears
          // first, the one before it next, and so on.
          const order = actions.length - 1 - i;
          // The one at the edge is also the one a full swipe fires, so past
          // the threshold it takes the strip over — growing into a pill while
          // the others fade out. Apple does this to say, before you let go,
          // which action is about to happen.
          const takesOver = i === actions.length - 1;
          // A button's entrance is tied to ITS OWN slot opening, not to a
          // fixed number of pixels. Keying it to distance meant a 64pt button
          // was already drawing at 10pt of drag, spilling over the row and
          // clipping at the screen edge (saha testi bulgusu). Now it starts
          // as a dot when its slot begins to open and is full size exactly
          // when the slot fits it — it can never be wider than the space it
          // has.
          const slot = size + GAP;
          const start = LEAD + order * slot;
          const end = start + slot;

          const scale = drag.interpolate({
            inputRange: [0, start, end],
            outputRange: [0.25, 0.25, 1],
            extrapolate: 'clamp',
          });
          const opacity = drag.interpolate({
            inputRange: [0, start, start + slot * 0.45, fullSwipeAt, fullSwipeAt + 50],
            outputRange: [0, 0, 1, 1, takesOver ? 1 : 0],
            extrapolate: 'clamp',
          });
          const width = takesOver
            ? drag.interpolate({
                inputRange: [0, fullSwipeAt, fullSwipeAt + 130],
                outputRange: [size, size, size + FULL_SWIPE_GROWTH],
                extrapolate: 'clamp',
              })
            : size;

          return (
            <RNAnimated.View key={action.label} style={{ transform: [{ scale }], opacity, width }}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                  ref.current?.close();
                  action.onPress();
                }}
                accessibilityLabel={action.label}
                style={{
                  width: '100%',
                  height: size,
                  // Round, like the controls Apple reveals on a swipe — and a
                  // circle is what makes the scale-up read as a button
                  // arriving rather than a rectangle stretching.
                  borderRadius: size / 2,
                  backgroundColor: action.color,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {/* Icon only, at both sizes. The label under the icon needed
                    9pt to fit inside a circle and read as cramped noise next
                    to the clean icon-only version (saha testi bulgusu). The
                    icon carries the meaning; the label lives on as the
                    accessibility name. */}
                <Feather name={action.icon} size={compact ? 16 : 22} color={colors.bgBase} />
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
      // Overshoot has to be ON. It was off to stop buttons drawing past their
      // strip — a job `overflow: hidden` on that strip already does — and the
      // side effect was that dragX could never exceed the width of the
      // buttons, which is well short of the full-swipe threshold. So the full
      // swipe was unreachable, and with it the growing button: the row simply
      // stopped, open, however hard you pulled.
      overshootRight
      // 1, not 8. Anything higher divides the overshoot by that factor, and
      // the full-swipe threshold lives entirely inside the overshoot — at 8
      // it was unreachable by any real gesture.
      overshootFriction={1}
      friction={1.6}
      // The strip should be considered "open" while the buttons are visible,
      // rather than only after a long pull.
      rightThreshold={40}
      onSwipeableWillOpen={() => {
        // Whoever is opening takes the slot; anyone else closes.
        if (openRow && openRow !== handle.current) openRow.close();
        openRow = handle.current;
        // Dragged all the way: do the last (destructive) action instead of
        // parking the row open, which is what every iOS list does.
        if (!armed.current) return;
        armed.current = false;
        const last = actions[actions.length - 1];
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        // One frame, and it is not a nicety. Swipeable's close() asks
        // `rowState` where the row is coming FROM, and it fires this callback
        // in the same tick as the setState that sets rowState — so closing
        // here read the row as still CLOSED, snapped it to its closed
        // position in a single frame, and then sprang from there to the same
        // place. The row shut with no motion whatsoever (saha testi bulgusu —
        // "kaydırma kapanışında animasyon yok, birden kapanıyor"). A frame
        // later the state is committed and the spring has somewhere to go.
        requestAnimationFrame(() => ref.current?.close());
        last?.onPress();
      }}
      onSwipeableClose={() => {
        armed.current = false;
        if (openRow === handle.current) openRow = null;
      }}
    >
      {children}
    </Swipeable>
  );
}
