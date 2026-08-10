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

/**
 * iOS-standard swipe-from-the-right row actions (Home's challenge list —
 * saha testi bulgusu). A thin wrapper over react-native-gesture-handler's
 * Swipeable: renders `actions` as fixed-width buttons that slide in from the
 * right, closes itself once an action fires.
 */
export function SwipeableRow({
  children,
  actions,
  compact,
}: {
  children: ReactNode;
  actions: SwipeAction[];
  /**
   * The row is a single line of text rather than a card. These buttons are
   * sized for a card — 72pt wide with the label stacked under the icon — and
   * in a ~30pt row that collapses into unreadable coloured pills (saha testi
   * bulgusu on the "Yakında" list). Compact drops the label and narrows the
   * button so the icon alone carries it, which is what fits at that height.
   */
  compact?: boolean;
}) {
  const ref = useRef<Swipeable>(null);

  const renderRightActions = (progress: RNAnimated.AnimatedInterpolation<number>) => (
    <View
      style={{
        flexDirection: 'row',
        height: '100%',
        alignItems: 'center',
        paddingVertical: compact ? 0 : 8,
      }}
    >
      {actions.map((action, i) => {
        const isLast = i === actions.length - 1;
        // Each button's own [0,1] progress so they fan in slightly staggered
        // instead of all snapping to full width at once.
        const scale = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.7, 1],
          extrapolate: 'clamp',
        });
        return (
          <RNAnimated.View
            key={action.label}
            style={{
              transform: [{ scale }],
              marginLeft: i === 0 ? 8 : 6,
              marginRight: isLast ? 8 : 0,
              height: '100%',
            }}
          >
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                ref.current?.close();
                action.onPress();
              }}
              // A label needs the height to sit under the icon; without it the
              // button just needs to be tappable, so it stays 44pt — Apple's
              // minimum target — even though the row it belongs to is shorter.
              accessibilityLabel={compact ? action.label : undefined}
              style={{
                width: compact ? 44 : 72,
                height: compact ? 44 : '100%',
                backgroundColor: action.color,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                borderRadius: radius.badge,
              }}
            >
              <Feather name={action.icon} size={17} color={colors.bgBase} />
              {compact ? null : (
                <AppText style={{ fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.bgBase }}>
                  {action.label}
                </AppText>
              )}
            </Pressable>
          </RNAnimated.View>
        );
      })}
    </View>
  );

  return (
    <Swipeable ref={ref} renderRightActions={renderRightActions} overshootRight={false} friction={2}>
      {children}
    </Swipeable>
  );
}
