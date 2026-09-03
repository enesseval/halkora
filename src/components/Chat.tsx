
import { Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colors, hairline, radius, type } from '@/theme/tokens';
import { Message } from '@/data/types';
import { REACTION_EMOJIS } from '@/hooks';
import { useT } from '@/i18n';
import { AppText } from './ui';

/** Centered "Gün 7" divider between chat days. */
export function DayDivider({ day }: { day: number }) {
  const { t } = useT();
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 14 }}
    >
      <View style={{ flex: 1, height: hairline, backgroundColor: colors.strokeSubtle }} />
      <AppText variant="meta" color={colors.textTertiary} tabular>
        {/* Messages sent before the ring starts are filed under day 0, and
            there is no such day — the divider read "Gün 0" (saha testi
            bulgusu). The group is already talking, they just haven't begun. */}
        {day > 0 ? t.chat.day(day) : t.chat.beforeStart}
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
  /** Guideline 1.2 — every piece of someone else's content needs a way to be
   * reported and its author blocked. Absent on my own messages: there is
   * nothing to report about myself. */
  onReport?: () => void;
  onBlock?: () => void;
  /** Only on my own messages. */
  onDelete?: () => void;
  /** Which bubble currently has its menu open, and how to change that. Held
   * by the list rather than each bubble: with a boolean per bubble, opening
   * a second menu left the first one open behind it (saha testi bulgusu —
   * "başka bir mesaja uzun bastığımda yine açılıyor ama önceki açık kalmaya
   * devam ediyor"). One value can only name one bubble. */
  openId: string | null;
  setOpenId: (id: string | null) => void;
}

export function MessageBubble({
  message,
  onReact,
  onReport,
  onBlock,
  onDelete,
  openId,
  setOpenId,
}: BubbleProps) {
  const { t } = useT();
  const showPicker = openId === message.id;
  const setShowPicker = (next: boolean | ((v: boolean) => boolean)) => {
    const value = typeof next === 'function' ? next(showPicker) : next;
    setOpenId(value ? message.id : null);
  };
  const mine = message.mine;
  const canModerate = !mine && (onReport || onBlock);
  const canDelete = !!mine && !!onDelete;

  return (
    <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', marginVertical: 5 }}>
      {!mine && message.authorName ? (
        <AppText variant="meta" color={colors.textTertiary} style={{ marginBottom: 3, marginLeft: 4 }}>
          {message.authorName}
        </AppText>
      ) : null}

      <Pressable
        // A plain tap on the bubble dismisses its own menu — the smallest
        // "somewhere else" there is, and it costs nothing when no menu is up.
        onPress={() => {
          if (showPicker) setShowPicker(false);
        }}
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
            // Floats over the conversation instead of sitting in it. Laid out
            // inline, opening the menu pushed every message below it down and
            // shoved the thread around under your finger.
            //
            // BELOW the bubble, not over it: anchored to the bubble's own
            // bottom edge it covered the message you had just long-pressed,
            // which is the one thing that has to stay readable (saha testi
            // bulgusu — "tam mesajın üzerinde açılıyor, mesaj gözükmüyor").
            // It still overlays whatever is under it rather than pushing.
            position: 'absolute',
            top: '100%',
            marginTop: 4,
            [mine ? 'right' : 'left']: 0,
            zIndex: 10,
            flexDirection: 'row',
            gap: 4,
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

          {/* Same long-press that reacts also reports — one gesture, so
              reporting is never harder to find than a thumbs-up. Divider and
              muted colour keep it from competing with the reactions. */}
          {canDelete ? (
            <>
              <View
                style={{
                  width: hairline,
                  alignSelf: 'stretch',
                  backgroundColor: colors.strokeSubtle,
                  marginHorizontal: 4,
                }}
              />
              <Pressable
                onPress={() => {
                  setShowPicker(false);
                  onDelete?.();
                }}
                style={{ paddingHorizontal: 6, justifyContent: 'center' }}
              >
                <AppText variant="meta" color={colors.joker}>
                  {t.chat.deleteMessage}
                </AppText>
              </Pressable>
            </>
          ) : null}

          {canModerate ? (
            <>
              <View
                style={{
                  width: hairline,
                  alignSelf: 'stretch',
                  backgroundColor: colors.strokeSubtle,
                  marginHorizontal: 4,
                }}
              />
              {onReport ? (
                <Pressable
                  onPress={() => {
                    setShowPicker(false);
                    onReport();
                  }}
                  style={{ paddingHorizontal: 6, justifyContent: 'center' }}
                >
                  <AppText variant="meta" color={colors.textSecondary}>
                    {t.moderation.report}
                  </AppText>
                </Pressable>
              ) : null}
              {onBlock ? (
                <Pressable
                  onPress={() => {
                    setShowPicker(false);
                    onBlock();
                  }}
                  style={{ paddingHorizontal: 6, justifyContent: 'center' }}
                >
                  <AppText variant="meta" color={colors.joker}>
                    {t.moderation.block}
                  </AppText>
                </Pressable>
              ) : null}
            </>
          ) : null}
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
  const { t } = useT();
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
          {t.common.percent(pct)} {selected ? '✓' : ''}
        </AppText>
      </View>
    </View>
  );
}
