import { useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Platform, Pressable, Share, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
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
 * The finish-line share preview — swipe between the 4 templates
 * (src/components/ShareCard.tsx), then share or dismiss.
 *
 * This is a real route presented as a `transparentModal` (app/_layout.tsx),
 * the exact same mechanism app/paywall.tsx uses — NOT a component rendered
 * inline as a sibling of a screen's ScrollView. That was the earlier design
 * (a manually `position: 'absolute'`-fill overlay embedded inside
 * complete.tsx's own Screen/ScrollView tree) and it came out visibly broken
 * on a real device (buttons pushed off screen, the card not actually
 * centered) — a plain sibling overlay is at the mercy of its parent's own
 * padding, safe-area handling and stacking order, none of which apply to it
 * the way they do to normal content. A dedicated transparentModal route is
 * its own top-level screen: react-native-screens gives it the true full
 * device viewport and guarantees it paints above everything else, so none
 * of that class of bug is possible here (saha testi bulgusu).
 */

const CARD_PREVIEW_SCALE = 0.64;
const PREVIEW_W = CARD_W * CARD_PREVIEW_SCALE;
const PREVIEW_H = CARD_H * CARD_PREVIEW_SCALE;
const TEMPLATE_IDS: ShareTemplateId[] = ['classic', 'bold', 'mono', 'stats'];

export default function ShareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useT();
  const challenge = useChallenge(id);
  const insets = useSafeAreaInsets();
  const shotRefs = useRef<Array<ViewShot | null>>([]);
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

  const onPageChange = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / PREVIEW_W);
    if (idx !== activeIndex && idx >= 0 && idx < TEMPLATE_IDS.length) {
      Haptics.selectionAsync().catch(() => {});
      setActiveIndex(idx);
    }
  };

  const shareText = () =>
    Share.share({ message: t.complete.shareMessage(challenge.title, challenge.totalDays) }).catch(() => {});

  const share = async () => {
    if (sharing) return;
    setSharing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      const capture = shotRefs.current[activeIndex]?.capture;
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

  // Preview at a smaller true pixel size (not a CSS-style transform on the
  // scroll view) — a `transform: scale` applied to a horizontal, paging
  // ScrollView rendered visibly wrong on real iOS even though it looked fine
  // in the web preview. Each page is instead a fixed PREVIEW_W×PREVIEW_H box
  // that clips its content (overflow: hidden), with the actual 360×640 card
  // scaled down *inside* it via a plain (non-scrolling) View's transform,
  // anchored to the top-left corner so it exactly fills the smaller box with
  // nothing left to leak outside it. ViewShot still captures the full-size,
  // unscaled card.
  return (
    <Animated.View entering={FadeIn.duration(160)} style={{ flex: 1, backgroundColor: colors.scrim }}>
      <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={close} />

      <View pointerEvents="box-none" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View entering={SlideInDown.duration(280)} style={{ alignItems: 'center', gap: 12 }}>
          <Animated.ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onPageChange}
            style={{ width: PREVIEW_W, height: PREVIEW_H }}
          >
            {TEMPLATE_IDS.map((id, i) => (
              <View
                key={id}
                style={{
                  width: PREVIEW_W,
                  height: PREVIEW_H,
                  borderRadius: radius.card,
                  overflow: 'hidden',
                  borderWidth: hairline,
                  borderColor: colors.strokeSubtle,
                }}
              >
                <View
                  style={{
                    width: CARD_W,
                    height: CARD_H,
                    transform: [{ scale: CARD_PREVIEW_SCALE }],
                    transformOrigin: 'top left',
                  }}
                >
                  <ViewShot ref={(r) => { shotRefs.current[i] = r; }} options={{ format: 'png', quality: 1 }}>
                    <ShareCard challenge={challenge} variant={id} />
                  </ViewShot>
                </View>
              </View>
            ))}
          </Animated.ScrollView>

          <AppText variant="meta" color={colors.textTertiary} style={{ textAlign: 'center' }}>
            {t.complete.shareTemplateHint}
          </AppText>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {TEMPLATE_IDS.map((id, i) => (
              <View
                key={id}
                style={{
                  width: i === activeIndex ? 16 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: i === activeIndex ? colors.ember : colors.strokeSubtle,
                }}
              />
            ))}
            <AppText
              variant="meta"
              color={colors.textSecondary}
              style={{ marginLeft: 6, fontFamily: fonts.bodyMedium }}
            >
              {templateLabel[TEMPLATE_IDS[activeIndex]]}
            </AppText>
          </View>
        </Animated.View>
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
