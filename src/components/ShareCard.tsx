import { useRef, useState } from 'react';
import { Platform, Pressable, Share, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { colors, fonts, hairline, radius } from '@/theme/tokens';
import { AppText, Avatar, Button } from '@/components/ui';
import { ProgressRing } from '@/components/ProgressRing';
import { useT } from '@/i18n';
import type { Challenge } from '@/data/types';

/**
 * The finish-line share card — a 9:16 "artifact" the group actually wants to
 * post (Instagram stories etc.). Rendered at 360×640 logical px and captured
 * with the device's pixel ratio (3x phones → 1080×1920 PNG, natively sharp).
 *
 * Design: the app's own dark/ember system, pushed toward a timeless
 * certificate feel — hairline inner frame, the segmented ring as the single
 * hero, tabular numbers, letterspaced caps. No photos, no gradients outside
 * the token palette, never red.
 */

const CARD_W = 360;
const CARD_H = 640;

function Wordmark() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View
        style={{
          width: 14,
          height: 14,
          borderRadius: 7,
          borderWidth: 2.5,
          borderColor: colors.ember,
        }}
      />
      <AppText
        style={{
          fontFamily: fonts.displaySemibold,
          fontSize: 13,
          letterSpacing: 4,
          color: colors.textSecondary,
        }}
      >
        HALKORA
      </AppText>
    </View>
  );
}

function StatCol({ value, label, tint }: { value: string; label: string; tint?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <AppText
        tabular
        style={{ fontFamily: fonts.displayBold, fontSize: 22, lineHeight: 26, color: tint ?? colors.textPrimary }}
      >
        {value}
      </AppText>
      <AppText
        style={{
          fontFamily: fonts.bodyRegular,
          fontSize: 10,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          color: colors.textTertiary,
        }}
      >
        {label}
      </AppText>
    </View>
  );
}

export function ShareCard({ challenge }: { challenge: Challenge }) {
  const { t } = useT();
  const stats = challenge.finishStats;
  const perfectDays = challenge.advancedStats?.perfectDays ?? 0;
  const shown = challenge.participants.slice(0, 6);
  const extra = challenge.participants.length - shown.length;

  return (
    <View
      style={{
        width: CARD_W,
        height: CARD_H,
        backgroundColor: colors.bgBase,
        overflow: 'hidden',
      }}
    >
      {/* off-canvas decorative rings — depth without leaving the palette */}
      <View
        style={{
          position: 'absolute',
          top: -140,
          right: -140,
          width: 320,
          height: 320,
          borderRadius: 160,
          borderWidth: 1,
          borderColor: colors.strokeSubtle,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: -170,
          left: -170,
          width: 380,
          height: 380,
          borderRadius: 190,
          borderWidth: 1,
          borderColor: colors.emberSoft,
        }}
      />

      {/* hairline inner frame — the "certificate" edge */}
      <View
        style={{
          position: 'absolute',
          top: 14,
          left: 14,
          right: 14,
          bottom: 14,
          borderRadius: radius.card,
          borderWidth: hairline,
          borderColor: colors.strokeSubtle,
        }}
      />

      <View style={{ flex: 1, alignItems: 'center', paddingTop: 44, paddingBottom: 36, paddingHorizontal: 32 }}>
        <Wordmark />

        {/* hero ring — soft ember halo behind, personal honest segments */}
        <View style={{ marginTop: 40, alignItems: 'center', justifyContent: 'center' }}>
          <View
            style={{
              position: 'absolute',
              width: 264,
              height: 264,
              borderRadius: 132,
              backgroundColor: colors.emberSoft,
            }}
          />
          <ProgressRing
            totalDays={challenge.totalDays}
            days={challenge.days}
            size="L"
            diameter={208}
            strokeWidth={13}
            centerContent={
              <View style={{ alignItems: 'center' }}>
                <AppText
                  tabular
                  style={{ fontFamily: fonts.displayBold, fontSize: 56, lineHeight: 62, color: colors.textPrimary }}
                >
                  {challenge.totalDays}
                </AppText>
                <AppText
                  style={{
                    fontFamily: fonts.bodyRegular,
                    fontSize: 11,
                    letterSpacing: 3,
                    textTransform: 'uppercase',
                    color: colors.textSecondary,
                  }}
                >
                  {t.complete.shareCardDays}
                </AppText>
              </View>
            }
          />
        </View>

        {/* title */}
        <View style={{ marginTop: 36, alignItems: 'center', gap: 6 }}>
          <AppText
            numberOfLines={2}
            style={{
              fontFamily: fonts.displaySemibold,
              fontSize: 24,
              lineHeight: 30,
              letterSpacing: -0.4,
              color: colors.textPrimary,
              textAlign: 'center',
            }}
          >
            {challenge.title}
          </AppText>
          <AppText
            style={{
              fontFamily: fonts.bodyRegular,
              fontSize: 12,
              letterSpacing: 2,
              textTransform: 'uppercase',
              color: colors.ember,
            }}
          >
            {t.complete.shareCardCompleted}
          </AppText>
        </View>

        <View style={{ flex: 1 }} />

        {/* stats band */}
        {stats ? (
          <View
            style={{
              flexDirection: 'row',
              alignSelf: 'stretch',
              paddingVertical: 14,
              borderTopWidth: hairline,
              borderBottomWidth: hairline,
              borderColor: colors.strokeSubtle,
            }}
          >
            <StatCol value={`${stats.people}`} label={t.complete.statPeople} />
            <StatCol value={`${stats.checkins}`} label={t.complete.statCheckins} />
            <StatCol value={t.common.percent(stats.completionPct)} label={t.complete.statCompletion} tint={colors.ember} />
          </View>
        ) : null}

        {/* perfect days — small gold-free ember chip, only when earned */}
        {perfectDays > 0 ? (
          <View
            style={{
              marginTop: 14,
              backgroundColor: colors.emberSoft,
              borderRadius: radius.pill,
              paddingHorizontal: 14,
              paddingVertical: 6,
            }}
          >
            <AppText style={{ fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.ember }}>
              {t.complete.shareCardPerfect(perfectDays)}
            </AppText>
          </View>
        ) : null}

        {/* the ring's people */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 18 }}>
          {shown.map((p, i) => (
            <View key={p.id} style={{ marginLeft: i === 0 ? 0 : -8 }}>
              <Avatar initials={p.initials} size={30} borderColor={colors.bgBase} borderWidth={2} />
            </View>
          ))}
          {extra > 0 ? (
            <AppText
              style={{ marginLeft: 8, fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textSecondary }}
            >
              +{extra}
            </AppText>
          ) : null}
        </View>

        <AppText
          style={{
            marginTop: 18,
            fontFamily: fonts.bodyRegular,
            fontSize: 11,
            letterSpacing: 1.5,
            color: colors.textTertiary,
          }}
        >
          halkora.app
        </AppText>
      </View>
    </View>
  );
}

/**
 * Full-screen preview + share flow. Native: captures the card as a PNG and
 * opens the system share sheet (Instagram/WhatsApp/etc. as targets). Web
 * (and any capture failure): falls back to the plain text share so the
 * button never dead-ends.
 */
export function ShareCardSheet({
  challenge,
  visible,
  onClose,
}: {
  challenge: Challenge;
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useT();
  const shotRef = useRef<ViewShot>(null);
  const [sharing, setSharing] = useState(false);

  if (!visible) return null;

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

  // Scale the fixed 360×640 card down to fit smaller screens; ViewShot still
  // captures the card at its own (unscaled) layout size, so output stays sharp.
  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: colors.scrim,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={onClose} />

      <Animated.View entering={SlideInDown.springify().damping(20)} style={{ alignItems: 'center', gap: 16 }}>
        <View style={{ transform: [{ scale: 0.72 }], marginVertical: -CARD_H * 0.14 }}>
          <View
            style={{
              borderRadius: radius.card,
              overflow: 'hidden',
              borderWidth: hairline,
              borderColor: colors.strokeSubtle,
            }}
          >
            <ViewShot ref={shotRef} options={{ format: 'png', quality: 1 }}>
              <ShareCard challenge={challenge} />
            </ViewShot>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <Pressable
            onPress={onClose}
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
      </Animated.View>
    </Animated.View>
  );
}
