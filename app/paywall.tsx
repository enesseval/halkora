import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { colors, fonts, hairline, radius, spacing, type } from '@/theme/tokens';
import { AppText, Button } from '@/components/ui';
import { ProgressRing } from '@/components/ProgressRing';
import { useT } from '@/i18n';
import type { SegmentState } from '@/data/types';

/**
 * Halkora Pro paywall (Faz 4). A bottom sheet over whatever screen opened it,
 * always with a `reason` so the headline is contextual — never a generic nag
 * (ROADMAP Faz 4: "limit anında bağlamsal gösterim"). Presented as a
 * transparentModal (app/_layout.tsx) so the screen behind stays dimmed.
 *
 * Faz A: the price block + plan selection are real UI, but the purchase
 * button is a placeholder (no RevenueCat yet — Faz B, docs "Ek R"). The
 * gating around it (limit trigger, is_pro read, advanced-stats unlock) is
 * real and testable via the DEV Pro toggle in Settings.
 */
type Reason = 'challengeLimit' | 'advancedStats' | 'generic';
type Plan = 'monthly' | 'annual';

// A decorative ~70%-complete ring — the app's core motif, reused as the
// paywall's hero so it reads as "your ring, bigger".
const HERO_DAYS: SegmentState[] = Array.from({ length: 12 }, (_, i) =>
  i < 8 ? 'done' : 'empty',
);

function reasonKey(raw: string | string[] | undefined): Reason {
  const r = Array.isArray(raw) ? raw[0] : raw;
  if (r === 'challengeLimit' || r === 'advancedStats') return r;
  return 'generic';
}

function FeatureRow({ label }: { label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: colors.emberSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Feather name="check" size={14} color={colors.ember} />
      </View>
      <AppText variant="bodyMedium">{label}</AppText>
    </View>
  );
}

function PlanCard({
  label,
  price,
  per,
  note,
  badge,
  selected,
  onPress,
}: {
  label: string;
  price: string;
  per: string;
  note: string;
  badge?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={{
        flex: 1,
        backgroundColor: selected ? colors.emberSoft : colors.bgSurface,
        borderRadius: radius.badge,
        borderWidth: selected ? 1.5 : hairline,
        borderColor: selected ? colors.ember : colors.strokeSubtle,
        padding: 14,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppText variant="meta" color={colors.textSecondary}>
          {label}
        </AppText>
        <View
          style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            borderWidth: 1.5,
            borderColor: selected ? colors.ember : colors.strokeSubtle,
            backgroundColor: selected ? colors.ember : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {selected ? <Feather name="check" size={11} color={colors.bgBase} /> : null}
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2, marginTop: 8 }}>
        <AppText tabular style={{ fontFamily: fonts.displayBold, fontSize: 22, color: colors.textPrimary }}>
          {price}
        </AppText>
        <AppText variant="meta" color={colors.textSecondary}>
          {per}
        </AppText>
      </View>
      <AppText variant="meta" color={colors.textTertiary} style={{ marginTop: 4 }}>
        {note}
      </AppText>
      {badge ? (
        <View
          style={{
            position: 'absolute',
            top: -9,
            right: 10,
            backgroundColor: colors.joker,
            borderRadius: 7,
            paddingHorizontal: 7,
            paddingVertical: 2,
          }}
        >
          <AppText style={{ fontFamily: fonts.bodyBold, fontSize: 10, color: colors.bgBase }}>
            {badge}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

export default function Paywall() {
  const { t } = useT();
  const router = useRouter();
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const key = reasonKey(reason);
  const [plan, setPlan] = useState<Plan>('annual');

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const notReady = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Alert.alert(t.pro.notReadyTitle, t.pro.notReadyBody);
  };

  return (
    <Animated.View entering={FadeIn.duration(180)} style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' }}>
      {/* tap outside to dismiss */}
      <Pressable style={{ flex: 1 }} onPress={close} />

      <Animated.View
        entering={SlideInDown.duration(280)}
        style={{
          backgroundColor: colors.bgElevated,
          borderTopLeftRadius: radius.sheet,
          borderTopRightRadius: radius.sheet,
          paddingHorizontal: 24,
          paddingTop: 12,
          paddingBottom: 40,
        }}
      >
        {/* grab handle */}
        <View style={{ alignItems: 'center', marginBottom: 8 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.strokeSubtle }} />
        </View>

        {/* close */}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <Pressable
            onPress={close}
            hitSlop={10}
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: colors.bgSurface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="x" size={17} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* hero ring */}
        <View style={{ alignItems: 'center', marginTop: 4 }}>
          <ProgressRing
            totalDays={12}
            days={HERO_DAYS}
            size="M"
            diameter={88}
            strokeWidth={7}
            centerContent={<Feather name="plus" size={24} color={colors.ember} />}
          />
        </View>

        {/* headline + sub */}
        <View style={{ alignItems: 'center', marginTop: 16, gap: 6 }}>
          <AppText style={[type.hero, { textAlign: 'center' }]}>{t.pro.headline[key]}</AppText>
          <AppText variant="secondary" style={{ textAlign: 'center' }}>
            {t.pro.sub[key]}
          </AppText>
        </View>

        {/* features */}
        <View style={{ gap: 12, marginTop: 22 }}>
          <FeatureRow label={t.pro.features.unlimited} />
          <FeatureRow label={t.pro.features.advancedStats} />
        </View>

        {/* plan selection */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 22 }}>
          <PlanCard
            label={t.pro.planMonthlyLabel}
            price={t.pro.monthlyPrice}
            per={t.pro.monthlyPer}
            note={t.pro.monthlyNote}
            selected={plan === 'monthly'}
            onPress={() => setPlan('monthly')}
          />
          <PlanCard
            label={t.pro.planAnnualLabel}
            price={t.pro.annualPrice}
            per={t.pro.annualPer}
            note={t.pro.annualNote}
            badge={t.pro.saveBadge}
            selected={plan === 'annual'}
            onPress={() => setPlan('annual')}
          />
        </View>

        {/* CTA */}
        <View style={{ marginTop: 22, gap: 12, alignItems: 'center' }}>
          <Button label={t.pro.cta} onPress={notReady} style={{ alignSelf: 'stretch' }} />
          <AppText variant="secondary" color={colors.textSecondary} onPress={notReady}>
            {t.pro.restore}
          </AppText>
          <AppText variant="meta" color={colors.textTertiary}>
            {t.pro.legal}
          </AppText>
        </View>
      </Animated.View>
    </Animated.View>
  );
}
