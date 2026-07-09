import { ReactNode } from 'react';
import {
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  TextProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors, fonts, hairline, radius, spacing, type } from '@/theme/tokens';

type TypeVariant = keyof typeof type;

interface AppTextProps extends TextProps {
  variant?: TypeVariant;
  color?: string;
  tabular?: boolean;
}

/** All text goes through here so nothing renders in the system font. */
export function AppText({
  variant = 'body',
  color,
  tabular,
  style,
  ...rest
}: AppTextProps) {
  return (
    <Text
      {...rest}
      style={[
        type[variant],
        color ? { color } : null,
        tabular ? { fontVariant: ['tabular-nums'] } : null,
        style,
      ]}
    />
  );
}

interface ScreenProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: Edge[];
  padded?: boolean;
}

export function Screen({ children, style, edges, padded = true }: ScreenProps) {
  return (
    <SafeAreaView
      edges={edges ?? ['top', 'bottom']}
      style={[
        { flex: 1, backgroundColor: colors.bgBase },
        padded ? { paddingHorizontal: spacing.screenX } : null,
        style,
      ]}
    >
      {children}
    </SafeAreaView>
  );
}

interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  elevated?: boolean;
}

/** Surface + 1px stroke = depth without shadows. */
export function Card({ children, style, elevated }: CardProps) {
  return (
    <View
      style={[
        {
          backgroundColor: elevated ? colors.bgElevated : colors.bgSurface,
          borderRadius: radius.card,
          borderWidth: hairline,
          borderColor: colors.strokeSubtle,
          padding: spacing.cardPad,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        fontFamily: fonts.displaySemibold,
        fontSize: 13,
        color: colors.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: 1.5,
      }}
    >
      {children}
    </Text>
  );
}

function haptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

interface ButtonProps extends Omit<PressableProps, 'style'> {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'amber';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  disabled?: boolean;
  icon?: ReactNode;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  style,
  textStyle,
  disabled,
  icon,
  ...rest
}: ButtonProps) {
  const isPrimary = variant === 'primary';
  const isAmber = variant === 'amber';
  const bg =
    variant === 'primary'
      ? colors.ember
      : variant === 'secondary'
        ? colors.bgElevated
        : 'transparent';
  const border =
    variant === 'secondary'
      ? colors.strokeSubtle
      : isAmber
        ? colors.joker
        : 'transparent';
  const txtColor = isPrimary
    ? colors.bgBase
    : isAmber
      ? colors.joker
      : colors.textPrimary;

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onPress={() => {
        if (disabled) return;
        haptic();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: bg,
          borderColor: border,
          borderWidth: variant === 'secondary' || isAmber ? hairline : 0,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        style,
      ]}
    >
      {icon}
      <Text
        style={[
          type.cardAction,
          { fontSize: 17, color: txtColor, fontFamily: type.bodyMedium.fontFamily },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

interface ChipProps {
  label: string;
  emoji?: string;
  selected?: boolean;
  onPress?: () => void;
  tint?: 'ember' | 'joker';
}

export function Chip({ label, emoji, selected, onPress, tint = 'ember' }: ChipProps) {
  const activeBorder = tint === 'joker' ? colors.joker : colors.ember;
  const activeBg = tint === 'joker' ? colors.jokerSoft : colors.emberSoft;
  return (
    <Pressable
      onPress={() => {
        haptic();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? activeBg : colors.bgElevated,
          borderColor: selected ? activeBorder : colors.strokeSubtle,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {emoji ? <Text style={{ fontSize: 15 }}>{emoji}</Text> : null}
      <Text
        style={{
          ...type.secondary,
          color: selected ? colors.textPrimary : colors.textSecondary,
          fontFamily: type.bodyMedium.fontFamily,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

interface AvatarProps {
  initials: string;
  size?: number;
  tint?: boolean; // ember tinted (for "you"/completed)
  muted?: boolean;
  /** ring/separator color — set to the surface the avatar sits on */
  borderColor?: string;
  borderWidth?: number;
}

export function Avatar({
  initials,
  size = 28,
  tint,
  muted,
  borderColor,
  borderWidth,
}: AvatarProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: tint ? colors.emberSoft : colors.bgElevated,
        borderWidth: borderWidth ?? hairline,
        borderColor: borderColor ?? (tint ? colors.ember : colors.strokeSubtle),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontFamily: fonts.displaySemibold,
          fontSize: size * 0.34,
          color: muted ? colors.textTertiary : tint ? colors.ember : colors.textSecondary,
        }}
      >
        {initials}
      </Text>
    </View>
  );
}

interface AvatarStackProps {
  people: { id: string; initials: string }[];
  max?: number;
  size?: number;
  /** surface color behind the stack (used as the 2px separator ring) */
  surface?: string;
  /** hide the ember "+N" overflow badge (E2 home cards) */
  plain?: boolean;
}

export function AvatarStack({
  people,
  max = 4,
  size = 26,
  surface = colors.bgBase,
  plain,
}: AvatarStackProps) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  const overlap = size * 0.28;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {shown.map((p, i) => (
        <View key={p.id} style={{ marginLeft: i === 0 ? 0 : -overlap }}>
          <Avatar initials={p.initials} size={size} borderColor={surface} borderWidth={2} />
        </View>
      ))}
      {extra > 0 && !plain ? (
        <View
          style={{
            marginLeft: -overlap,
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.emberSoft,
            borderWidth: 2,
            borderColor: surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              fontFamily: fonts.displaySemibold,
              fontSize: size * 0.32,
              color: colors.ember,
            }}
          >
            +{extra}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** Round elevated icon button (back, +, settings). */
export function IconButton({
  children,
  onPress,
  size = 40,
}: {
  children: ReactNode;
  onPress?: () => void;
  size?: number;
}) {
  return (
    <Pressable
      onPress={() => {
        haptic();
        onPress?.();
      }}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.bgSurface,
        borderWidth: hairline,
        borderColor: colors.strokeSubtle,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 54,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.badge,
    borderWidth: hairline,
  },
});
