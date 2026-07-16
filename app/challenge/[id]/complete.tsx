import { ScrollView, Share, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, fonts, hairline, radius, spacing, type } from '@/theme/tokens';
import { useChallenge, useChallengesQuery } from '@/hooks';
import { errMessage } from '@/lib/errors';
import { AppText, Avatar, Button, Screen } from '@/components/ui';
import { ProgressRing } from '@/components/ProgressRing';
import { RingScreenSkeleton } from '@/components/Skeleton';
import { ErrorState } from '@/components/ErrorState';
import { useT } from '@/i18n';

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bgSurface,
        borderRadius: radius.badge,
        borderWidth: hairline,
        borderColor: colors.strokeSubtle,
        paddingVertical: 16,
        alignItems: 'center',
      }}
    >
      <AppText tabular style={{ fontFamily: fonts.displayBold, fontSize: 26, lineHeight: 32, color: colors.textPrimary }}>
        {value}
      </AppText>
      <AppText variant="meta" color={colors.textTertiary} style={{ marginTop: 4 }}>
        {label}
      </AppText>
    </View>
  );
}

export default function CompleteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useT();
  const challenge = useChallenge(id);
  const { loading, firstLoadError, error, refetch } = useChallengesQuery();

  if (!challenge) {
    return (
      <Screen edges={['top', 'bottom']}>
        {loading ? (
          <RingScreenSkeleton />
        ) : firstLoadError ? (
          <ErrorState message={t.complete.loadFailed} detail={errMessage(error)} onRetry={refetch} />
        ) : (
          <ErrorState message={t.complete.notFound} />
        )}
      </Screen>
    );
  }

  const stats = challenge.finishStats;
  const finishers = [...challenge.participants].sort(
    (a, b) => (b.completedDays ?? 0) - (a.completedDays ?? 0),
  );

  const share = () => {
    Share.share({
      message: t.complete.shareMessage(challenge.title, challenge.totalDays),
    }).catch(() => {});
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.section }}>
        <View style={{ alignItems: 'center', marginTop: 24 }}>
          <ProgressRing
            totalDays={challenge.totalDays}
            days={challenge.days}
            size="L"
            centerContent={
              <AppText tabular style={{ fontFamily: type.hero.fontFamily, fontSize: 40, lineHeight: 46, color: colors.textPrimary }}>
                {challenge.totalDays}
              </AppText>
            }
          />
          <AppText variant="screenTitle" style={{ marginTop: 28 }}>
            {t.complete.title(challenge.totalDays)}
          </AppText>
          <AppText variant="secondary" style={{ marginTop: 6 }}>
            {t.complete.subtitle(challenge.title)}
          </AppText>
        </View>

        {stats ? (
          <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.section }}>
            <Stat value={`${stats.people}`} label={t.complete.statPeople} />
            <Stat value={`${stats.checkins}`} label={t.complete.statCheckins} />
            <Stat value={t.common.percent(stats.completionPct)} label={t.complete.statCompletion} />
          </View>
        ) : null}

        {/* finishers */}
        <View style={{ marginTop: spacing.section }}>
          {finishers.map((p) => {
            const full = (p.completedDays ?? 0) >= challenge.totalDays;
            return (
              <View
                key={p.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 11,
                  borderBottomWidth: hairline,
                  borderBottomColor: colors.strokeSubtle,
                }}
              >
                <Avatar initials={p.initials} size={32} tint={full} />
                <AppText variant="bodyMedium" style={{ flex: 1 }}>
                  {p.name}
                </AppText>
                <AppText
                  variant="secondary"
                  tabular
                  color={full ? colors.ember : colors.textTertiary}
                  style={{ fontFamily: type.bodyMedium.fontFamily }}
                >
                  {p.completedDays ?? 0}/{challenge.totalDays}
                </AppText>
              </View>
            );
          })}
        </View>

        {/* stake — a computed "who lost" result when we have one (mock demo),
            otherwise just the stake's own text so real challenges aren't blank */}
        {challenge.stakeResult || challenge.stake?.text ? (
          <View
            style={{
              marginTop: 24,
              backgroundColor: colors.emberSoft,
              borderRadius: radius.badge,
              paddingVertical: 14,
              paddingHorizontal: 16,
              alignItems: 'center',
            }}
          >
            <AppText variant="bodyMedium" color={colors.ember}>
              {challenge.stakeResult ?? t.complete.stakeResult(challenge.stake!.text)}
            </AppText>
          </View>
        ) : null}

        {/* CTAs */}
        <View style={{ gap: 12, marginTop: spacing.section }}>
          <Button label={t.complete.rematch} onPress={() => router.replace('/create')} />
          <Button label={t.complete.shareResult} variant="secondary" onPress={share} />
        </View>
      </ScrollView>
    </Screen>
  );
}
