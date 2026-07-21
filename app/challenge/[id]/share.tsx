import { useRef, useState } from 'react';
import { Platform, Pressable, Share, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, runOnJS } from 'react-native-reanimated';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { colors, fonts, hairline, radius } from '@/theme/tokens';
import { AppText, Button } from '@/components/ui';
import { ShareCard, CARD_W, CARD_H, type ShareTemplateId } from '@/components/ShareCard';
import { useChallenge } from '@/hooks';
import { useT } from '@/i18n';

/**
 * The finish-line share preview — swipe (or tap a dot) to switch between the
 * 4 templates (src/components/ShareCard.tsx), then share or dismiss.
 *
 * This is a real route presented as a `transparentModal` (app/_layout.tsx),
 * the same mechanism app/paywall.tsx uses — its own top-level screen, so it
 * always gets the true full device viewport and paints above everything
 * else (an earlier version rendered this inline as a sibling of a screen's
 * ScrollView and came out visibly broken on a real device).
 *
 * The template switcher itself is deliberately NOT a horizontal ScrollView:
 * a `transform: scale` on a paging ScrollView rendered stretched/broken on
 * real iOS in an earlier version. Only ONE template is ever mounted at a
 * time here — a plain View sized to the true (already-scaled) preview
 * dimensions, swapped via a Pan gesture or a dot tap, with a plain opacity
 * fade on change. No ScrollView, no scale-on-a-scrollable-thing, nothing
 * left to leak or stretch outside its box (saha testi bulgusu — two earlier
 * rounds of this same bug class).
 */

const CARD_PREVIEW_SCALE = 0.64;
const PREVIEW_W = CARD_W * CARD_PREVIEW_SCALE;
const PREVIEW_H = CARD_H * CARD_PREVIEW_SCALE;
const TEMPLATE_IDS: ShareTemplateId[] = ['classic', 'bold', 'mono', 'stats'];
const SWIPE_THRESHOLD = 50;

export default function ShareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useT();
  const challenge = useChallenge(id);
  const insets = useSafeAreaInsets();
  const shotRef = useRef<ViewShot>(null);
  const [sharing, setSharing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace(`/challenge/${id}`);
  };

  // Only reachable from the Complete screen's own "share" button, which
  // already has the challenge loaded — this is just a defensive fallback
  // (e.g. a cold deep link straight into this route) rather than a real
  // user-facing path, so a bare close-and-return is enough.
  if (!challenge) {
    close();
    return null;
  }

  const templateLabel: Record<ShareTemplateId, string> = {
    classic: t.complete.shareTemplateClassic,
    bold: t.complete.shareTemplateBold,
    mono: t.complete.shareTemplateMono,
    stats: t.complete.shareTemplateStats,
  };

  const goTo = (next: number) => {
    if (next < 0 || next >= TEMPLATE_IDS.length || next === activeIndex) return;
    Haptics.selectionAsync().catch(() => {});
    setActiveIndex(next);
  };

  const swipe = Gesture.Pan().onEnd((e) => {
    if (e.translationX < -SWIPE_THRESHOLD) runOnJS(goTo)(activeIndex + 1);
    else if (e.translationX > SWIPE_THRESHOLD) runOnJS(goTo)(activeIndex - 1);
  });

  const shareText = () =>
    Share.share({ message: t.complete.shareMessage(challenge.title, challenge.totalDays) }).catch(() => {});

  const share = async () => {
    if (sharing) return;
    setSharing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      const capture = shotRef.current?.capture;
      if (Platform.OS === 'web' || !capture || !(await Sharing.isAvailableAsync())) {
        await shareText();
        return;
      }
      const uri = await capture();
      await Sharing.shareAsync(uri, { mimeType: 'image/png' });
    } catch {
      await shareText();
    } finally {
      setSharing(false);
    }
  };

  const activeId = TEMPLATE_IDS[activeIndex];

  return (
    <Animated.View entering={FadeIn.duration(160)} style={{ flex: 1, backgroundColor: colors.scrim }}>
      <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={close} />

      <View pointerEvents="box-none" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ alignItems: 'center', gap: 12 }}>
          <GestureDetector gesture={swipe}>
            <View
              style={{
                width: PREVIEW_W,
                height: PREVIEW_H,
                borderRadius: radius.card,
                overflow: 'hidden',
                borderWidth: hairline,
                borderColor: colors.strokeSubtle,
              }}
            >
              <Animated.View
                key={activeId}
                entering={FadeIn.duration(180)}
                style={{
                  width: CARD_W,
                  height: CARD_H,
                  transform: [{ scale: CARD_PREVIEW_SCALE }],
                  transformOrigin: 'top left',
                }}
              >
                <ViewShot ref={shotRef} options={{ format: 'png', quality: 1 }}>
                  <ShareCard challenge={challenge} variant={activeId} />
                </ViewShot>
              </Animated.View>
            </View>
          </GestureDetector>

          <AppText variant="meta" color={colors.textTertiary} style={{ textAlign: 'center' }}>
            {t.complete.shareTemplateHint}
          </AppText>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {TEMPLATE_IDS.map((tid, i) => (
              <Pressable key={tid} onPress={() => goTo(i)} hitSlop={8}>
                <View
                  style={{
                    width: i === activeIndex ? 16 : 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: i === activeIndex ? colors.ember : colors.strokeSubtle,
                  }}
                />
              </Pressable>
            ))}
            <AppText
              variant="meta"
              color={colors.textSecondary}
              style={{ marginLeft: 6, fontFamily: fonts.bodyMedium }}
            >
              {templateLabel[activeId]}
            </AppText>
          </View>
        </View>
      </View>

      <View
        pointerEvents="box-none"
        style={{ alignItems: 'center', paddingTop: 12, paddingBottom: insets.bottom + 20 }}
      >
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <Pressable
            onPress={close}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: colors.bgElevated,
              borderWidth: hairline,
              borderColor: colors.strokeSubtle,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="x" size={18} color={colors.textSecondary} />
          </Pressable>
          <Button
            label={sharing ? t.complete.sharePreparing : t.complete.shareResult}
            onPress={share}
            style={{ paddingHorizontal: 36 }}
          />
        </View>
      </View>
    </Animated.View>
  );
}
