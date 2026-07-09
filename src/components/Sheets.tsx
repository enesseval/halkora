import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { colors, fonts, hairline, radius, spacing, type } from '@/theme/tokens';
import { Challenge, Momentum } from '@/data/types';
import { ProgressRing } from './ProgressRing';
import { AppText, Button } from './ui';

/* ------------------------------------------------------------------ */
/* E8 — Missed Day / Return (full-screen gate on detail entry)         */
/* ------------------------------------------------------------------ */
export function MissedDaySheet({
  challenge,
  onUseJoker,
  onDismiss,
}: {
  challenge: Challenge;
  onUseJoker: () => void;
  onDismiss: () => void;
}) {
  const [usedJoker, setUsedJoker] = useState(false);

  useEffect(() => {
    if (!usedJoker) return;
    const t = setTimeout(onDismiss, 950);
    return () => clearTimeout(t);
  }, [usedJoker, onDismiss]);

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: colors.bgBase,
        paddingHorizontal: spacing.screenX,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 20,
      }}
    >
      <AppText variant="screenTitle" style={{ textAlign: 'center' }}>
        Dün olmadı.{'\n'}Bugün buradasın.
      </AppText>
      <AppText variant="secondary" tabular style={{ marginTop: 8, marginBottom: 36 }}>
        {challenge.title} · Gün {challenge.currentDay}/{challenge.totalDays}
      </AppText>

      <ProgressRing
        totalDays={challenge.totalDays}
        days={challenge.days}
        size="L"
        activeIndex={challenge.currentDay - 1}
        centerContent={
          <AppText tabular style={{ ...type.hero, color: colors.textPrimary }}>
            {challenge.currentDay}/{challenge.totalDays}
          </AppText>
        }
      />

      <View style={{ height: 40 }} />

      <View style={{ width: '100%', gap: 12 }}>
        <Button label="Bugünün check-in'i" onPress={onDismiss} />
        {challenge.jokerRemaining > 0 && !usedJoker ? (
          <Button
            label={`Dün için joker kullan · ${challenge.jokerRemaining} hakkın var`}
            variant="amber"
            onPress={() => {
              onUseJoker();
              setUsedJoker(true);
            }}
          />
        ) : null}
      </View>
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/* E10 — Momentum bottom sheet (scrim + slide up)                       */
/* ------------------------------------------------------------------ */
export function MomentumSheet({
  momentum,
  onRestart,
  onEndEarly,
  onClose,
}: {
  momentum: Momentum;
  onRestart: () => void;
  onEndEarly: () => void;
  onClose: () => void;
}) {
  const startDay = momentum.daysTogether - momentum.last3.length + 1;
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: colors.scrim,
        justifyContent: 'flex-end',
        zIndex: 30,
      }}
    >
      <Pressable style={{ flex: 1 }} onPress={onClose} />
      <Animated.View
        entering={SlideInDown.duration(280)}
        style={{
          backgroundColor: colors.bgSurface,
          borderTopLeftRadius: radius.sheet,
          borderTopRightRadius: radius.sheet,
          borderWidth: hairline,
          borderColor: colors.strokeSubtle,
          paddingHorizontal: spacing.screenX,
          paddingTop: 12,
          paddingBottom: 36,
        }}
      >
        <View
          style={{
            alignSelf: 'center',
            width: 40,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.strokeSubtle,
            marginBottom: 20,
          }}
        />
        <AppText variant="screenTitle" style={{ fontSize: 24 }}>
          Grubun temposu düştü.
        </AppText>
        <AppText variant="secondary" style={{ marginTop: 8 }}>
          Son 3 günde check-in'ler azaldı. Nasıl devam etmek istersin?
        </AppText>

        <View
          style={{
            flexDirection: 'row',
            marginTop: 20,
            backgroundColor: colors.bgElevated,
            borderRadius: radius.card,
            borderWidth: hairline,
            borderColor: colors.strokeSubtle,
            padding: 16,
            gap: 12,
            alignItems: 'center',
          }}
        >
          {momentum.last3.map((n, i) => (
            <View key={i} style={{ alignItems: 'center', flex: 1 }}>
              <AppText variant="meta" color={colors.textTertiary} tabular>
                Gün {startDay + i}
              </AppText>
              <AppText
                tabular
                style={{ fontFamily: fonts.displayBold, fontSize: 22, color: colors.textPrimary, marginTop: 4 }}
              >
                {n}
              </AppText>
              <AppText variant="meta" color={colors.textTertiary} tabular>
                / {momentum.total} kişi
              </AppText>
            </View>
          ))}
          <View style={{ flex: 1.4, paddingLeft: 8 }}>
            <AppText variant="secondary" color={colors.textSecondary}>
              Halka yine de duruyor. Karar grubun.
            </AppText>
          </View>
        </View>

        <View style={{ gap: 12, marginTop: 20 }}>
          <Button label="Yeniden başlat" onPress={onRestart} />
          <Button label="Erken bitir" variant="secondary" onPress={onEndEarly} />
        </View>

        <AppText
          variant="meta"
          color={colors.textTertiary}
          tabular
          style={{ textAlign: 'center', marginTop: 18 }}
        >
          {momentum.daysTogether} gün birlikte devam ettiniz.
        </AppText>
      </Animated.View>
    </Animated.View>
  );
}
