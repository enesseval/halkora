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
export function SwipeableRow({ children, actions }: { children: ReactNode; actions: SwipeAction[] }) {
  const ref = useRef<Swipeable>(null);

  const renderRightActions = (progress: RNAnimated.AnimatedInterpolation<number>) => (
    <View style={{ flexDirection: 'row', height: '100%' }}>
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
            style={{ transform: [{ scale }], marginLeft: i === 0 ? 8 : 0 }}
          >
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                ref.current?.close();
                action.onPress();
              }}
              style={{
                width: 72,
                height: '100%',
                backgroundColor: action.color,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                borderTopRightRadius: isLast ? radius.card : 0,
                borderBottomRightRadius: isLast ? radius.card : 0,
              }}
            >
              <Feather name={action.icon} size={17} color={colors.bgBase} />
              <AppText style={{ fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.bgBase }}>
                {action.label}
              </AppText>
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
