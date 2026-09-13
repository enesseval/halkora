
import { useRef, type ReactNode } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { colors, hairline, radius } from '@/theme/tokens';
import { Message } from '@/data/types';
import { REACTION_EMOJIS } from '@/hooks';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { useT } from '@/i18n';
import { AppText } from './ui';

/** How far the thread slides left to show the times beside it. */
export const TIME_REVEAL_W = 58;

/**
 * One row of the conversation, with its time parked off the right edge.
 *
 * Two rules, both learned the hard way:
 *
 *  - The time is INVISIBLE until you drag. It used to sit in a column that
 *    overlapped the screen's own padding, so its left edge peeked out at
 *    rest (saha testi bulgusu — "sağdaki saat her zaman gözüküyor ucundan").
 *    It fades in with the drag now, from nothing.
 *  - Only YOUR OWN messages move. Day dividers, system lines and everyone
 *    else's bubbles are left of the time column already — sliding the whole
 *    thread just shoved the entire conversation sideways for no reason
 *    ("içeriği komple kaydırıyor ama buna gerek yok"). A right-aligned
 *    bubble is the only thing the time column can collide with, so it is the
 *    only thing that gets out of the way.
 */
export function ChatRow({
  revealX,
  time,
  shift,
  children,
}: {
  revealX: SharedValue<number>;
  /** Absent for a day divider — a whole day has no single time. */
  time?: string;
  /** Move this row's content out of the time column's way. Own messages only. */
  shift?: boolean;
  children: ReactNode;
}) {
  const slide = useAnimatedStyle(() => ({
    transform: [{ translateX: shift ? revealX.value : 0 }],
  }));
  const clock = useAnimatedStyle(() => ({
    transform: [{ translateX: revealX.value }],
    opacity: Math.min(-revealX.value / (TIME_REVEAL_W * 0.6), 1),
  }));
  return (
    <View style={{ width: '100%' }}>
      <Animated.View style={slide}>{children}</Animated.View>
      {time ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              right: -TIME_REVEAL_W,
              top: 0,
              bottom: 0,
              width: TIME_REVEAL_W,
              alignItems: 'center',
              justifyContent: 'center',
            },
            clock,
          ]}
        >
          <AppText variant="meta" tabular color={colors.textTertiary}>
            {time}
          </AppText>
        </Animated.View>
      ) : null}
    </View>
  );
}

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

/** Where a bubble sits on screen, so its menu can be drawn over everything. */
export interface MenuAnchor {
  message: Message;
  x: number;
  y: number;
  width: number;
  height: number;
  mine: boolean;
}

interface BubbleProps {
  message: Message;
  /** Long-press hands up the bubble's position in WINDOW coordinates; the
   * screen draws the menu itself. See ChatMenu for why it cannot live here. */
  onOpenMenu: (anchor: MenuAnchor) => void;
  /** True while THIS bubble's menu is the open one — used only to let a plain
   * tap put it away again. */
  menuOpen: boolean;
  onCloseMenu: () => void;
}

export function MessageBubble({ message, onOpenMenu, menuOpen, onCloseMenu }: BubbleProps) {
  const mine = message.mine;
  const boxRef = useRef<View>(null);

  return (
    <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', marginVertical: 5 }}>
      {!mine && message.authorName ? (
        <AppText variant="meta" color={colors.textTertiary} style={{ marginBottom: 3, marginLeft: 4 }}>
          {message.authorName}
        </AppText>
      ) : null}

      <View ref={boxRef} collapsable={false}>
        <Pressable
          // A plain tap on the bubble dismisses its own menu — the smallest
          // "somewhere else" there is, and it costs nothing when no menu is up.
          onPress={() => {
            if (menuOpen) onCloseMenu();
          }}
          onLongPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            if (menuOpen) {
              onCloseMenu();
              return;
            }
            // Always opens — even while another bubble's menu is up. The
            // screen holds one anchor, so pointing it here replaces what was
            // there in a single press (saha testi bulgusu — "menü kapanıyor
            // ama diğer mesajın menüsü açılmıyor").
            //
            // measureInWindow, not onLayout: the menu is drawn OUTSIDE the
            // list, so it needs where this bubble is on the screen right now,
            // not where it sits inside its row.
            boxRef.current?.measureInWindow((x, y, width, height) => {
              onOpenMenu({ message, x, y, width, height, mine: !!mine });
            });
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
      </View>

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
    </View>
  );
}

/** Roughly how tall the menu is. Only used to decide above-or-below. */
const MENU_H = 52;
/** Breathing room from the bubble, and from the screen/keyboard edges. */
const MENU_GAP = 6;
const SCREEN_PAD = 12;

/**
 * The long-press menu, drawn over the whole screen rather than inside the
 * bubble.
 *
 * It used to be an absolutely-positioned child of the bubble. Inside a
 * FlashList that cannot work: every row is its own view, and a later row is
 * drawn ON TOP of an earlier one no matter what zIndex the menu carries —
 * so the menu came up underneath the messages below it and nothing in it
 * could be tapped. That is why reactions, delete, report and block all
 * looked broken at once (saha testi bulgusu — "menü diğer içeriklerin
 * altında kalıyor", "tepkiler çalışmıyor", "açılan menüdeki hiçbir özellik
 * çalışmıyor"). One overlay, above the list, fixes all of them together.
 *
 * It also decides above-or-below from the bubble's real position, so the
 * bottom-most message's menu no longer opens under the keyboard.
 */
export function ChatMenu({
  anchor,
  onClose,
  onReact,
  onReport,
  onBlock,
  onDelete,
}: {
  anchor: MenuAnchor;
  onClose: () => void;
  onReact: (emoji: string) => void;
  /** Guideline 1.2 — every piece of someone else's content needs a way to be
   * reported and its author blocked. Absent on my own messages. */
  onReport?: () => void;
  onBlock?: () => void;
  /** Only on my own messages. */
  onDelete?: () => void;
}) {
  const { t } = useT();
  const { height: screenH, width: screenW } = useWindowDimensions();
  const keyboardHeight = useKeyboardHeight();

  const canModerate = !anchor.mine && (onReport || onBlock);
  const canDelete = !!anchor.mine && !!onDelete;

  // Below the bubble when there is room, above it when there isn't. The
  // keyboard counts as the bottom of the screen — it is what was swallowing
  // the last message's menu.
  const floor = screenH - keyboardHeight - SCREEN_PAD;
  const below = anchor.y + anchor.height + MENU_GAP;
  const opensBelow = below + MENU_H <= floor;
  const top = opensBelow ? below : Math.max(SCREEN_PAD, anchor.y - MENU_H - MENU_GAP);

  // Anchored to the bubble's own side so it reads as belonging to it.
  const side = anchor.mine
    ? { right: Math.max(SCREEN_PAD, screenW - (anchor.x + anchor.width)) }
    : { left: Math.max(SCREEN_PAD, anchor.x) };

  const pick = (fn?: () => void) => () => {
    onClose();
    fn?.();
  };

  return (
    // box-none, and no scrim. A full-screen Pressable over the list caught
    // every touch first, so long-pressing a DIFFERENT message only dismissed
    // this menu and never reached that bubble. Touches pass straight through
    // now; the list's own conditional responder closes the menu when you tap
    // empty space, and each bubble handles its own press.
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 }}
    >
      <Animated.View
        entering={FadeIn.duration(150)}
        style={{
          position: 'absolute',
          top,
          ...side,
          maxWidth: screenW - SCREEN_PAD * 2,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          backgroundColor: colors.bgElevated,
          borderWidth: hairline,
          borderColor: colors.strokeSubtle,
          borderRadius: radius.pill,
          paddingHorizontal: 8,
          // Emoji glyphs sit taller than their font box, so 6pt of padding
          // clipped them top and bottom (saha testi bulgusu — "emojiler
          // açılan menü içerisine sığmıyor").
          paddingVertical: 9,
        }}
      >
        {REACTION_EMOJIS.map((e) => (
          <Pressable
            key={e}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onClose();
              onReact(e);
            }}
            style={({ pressed }) => ({
              paddingHorizontal: 5,
              transform: [{ scale: pressed ? 1.25 : 1 }],
            })}
          >
            {/* An explicit lineHeight: the default one for a 20pt font is
                shorter than the emoji actually draws. */}
            <AppText style={{ fontSize: 20, lineHeight: 26 }}>{e}</AppText>
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
            <Pressable onPress={pick(onDelete)} style={{ paddingHorizontal: 6, justifyContent: 'center' }}>
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
              <Pressable onPress={pick(onReport)} style={{ paddingHorizontal: 6, justifyContent: 'center' }}>
                <AppText variant="meta" color={colors.textSecondary}>
                  {t.moderation.report}
                </AppText>
              </Pressable>
            ) : null}
            {onBlock ? (
              <Pressable onPress={pick(onBlock)} style={{ paddingHorizontal: 6, justifyContent: 'center' }}>
                <AppText variant="meta" color={colors.joker}>
                  {t.moderation.block}
                </AppText>
              </Pressable>
            ) : null}
          </>
        ) : null}
      </Animated.View>
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
