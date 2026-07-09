import { useState } from 'react';
import { Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colors, hairline, radius, type } from '@/theme/tokens';
import { Message } from '@/data/types';
import { REACTION_EMOJIS } from '@/hooks';
import { AppText } from './ui';

/** Centered "Gün 7" divider between chat days. */
export function DayDivider({ day }: { day: number }) {
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 14 }}
    >
      <View style={{ flex: 1, height: hairline, backgroundColor: colors.strokeSubtle }} />
      <AppText variant="meta" color={colors.textTertiary} tabular>
        Gün {day}
      </AppText>
      <View style={{ flex: 1, height: hairline, backgroundColor: colors.strokeSubtle }} />
    </View>
  );
}

/** Inline centered system event ("Enes tamamladı ✓"). */
export function SystemEvent({ text }: { text: string }) {
  return (
    <AppText
      variant="meta"
      color={colors.textTertiary}
      style={{ textAlign: 'center', marginVertical: 8 }}
    >
      {text}
    </AppText>
  );
}

interface BubbleProps {
  message: Message;
  onReact: (emoji: string) => void;
}

export function MessageBubble({ message, onReact }: BubbleProps) {
  const [showPicker, setShowPicker] = useState(false);
  const mine = message.mine;

  return (
    <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', marginVertical: 5 }}>
      {!mine && message.authorName ? (
        <AppText variant="meta" color={colors.textTertiary} style={{ marginBottom: 3, marginLeft: 4 }}>
          {message.authorName}
        </AppText>
      ) : null}

      <Pressable
        onLongPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          setShowPicker((v) => !v);
        }}
        style={{
          maxWidth: '82%',
          backgroundColor: mine ? colors.emberSoft : colors.bgElevated,
          borderWidth: hairline,
          borderColor: mine ? 'transparent' : colors.strokeSubtle,
          borderRadius: radius.card,
          borderBottomRightRadius: mine ? 6 : radius.card,
          borderBottomLeftRadius: mine ? radius.card : 6,
          paddingVertical: 10,
          paddingHorizontal: 14,
        }}
      >
        <AppText variant="body" style={{ fontSize: 16 }}>
          {message.text}
        </AppText>
      </Pressable>

      {message.reactions.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 5 }}>
          {message.reactions.map((r) => (
            <View
              key={r.emoji}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: colors.bgElevated,
                borderWidth: hairline,
                borderColor: colors.strokeSubtle,
                borderRadius: radius.pill,
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}
            >
              <AppText style={{ fontSize: 13 }}>{r.emoji}</AppText>
              <AppText variant="meta" color={colors.textSecondary} tabular>
                {r.count}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}

      {showPicker ? (
        <Animated.View
          entering={FadeIn.duration(150)}
          style={{
            flexDirection: 'row',
            gap: 4,
            marginTop: 6,
            backgroundColor: colors.bgElevated,
            borderWidth: hairline,
            borderColor: colors.strokeSubtle,
            borderRadius: radius.pill,
            paddingHorizontal: 8,
            paddingVertical: 6,
          }}
        >
          {REACTION_EMOJIS.map((e) => (
            <Pressable
              key={e}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onReact(e);
                setShowPicker(false);
              }}
              style={({ pressed }) => ({
                paddingHorizontal: 5,
                transform: [{ scale: pressed ? 1.25 : 1 }],
              })}
            >
              <AppText style={{ fontSize: 20 }}>{e}</AppText>
            </Pressable>
          ))}
        </Animated.View>
      ) : null}
    </View>
  );
}

/** E3 step-4 / detail vote option row with a filled progress track. */
export function VoteOption({
  label,
  pct,
  selected,
}: {
  label: string;
  pct: number;
  selected?: boolean;
}) {
  return (
    <View
      style={{
        height: 48,
        borderRadius: radius.badge,
        borderWidth: hairline,
        borderColor: selected ? colors.ember : colors.strokeSubtle,
        backgroundColor: colors.bgElevated,
        overflow: 'hidden',
        justifyContent: 'center',
        marginVertical: 4,
      }}
    >
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: `${pct}%`,
          backgroundColor: selected ? colors.emberSoft : colors.strokeSubtle,
        }}
      />
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 14,
        }}
      >
        <AppText variant="bodyMedium" style={{ fontSize: 15 }} color={selected ? colors.ember : colors.textPrimary}>
          {label}
        </AppText>
        <AppText variant="secondary" tabular color={selected ? colors.ember : colors.textSecondary}>
          %{pct} {selected ? '✓' : ''}
        </AppText>
      </View>
    </View>
  );
}
