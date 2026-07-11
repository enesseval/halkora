import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { colors, spacing } from '@/theme/tokens';
import { useTodayStatus, useCheckIn, useRefreshChallenges } from '@/hooks';
import type { Challenge, SegmentState } from '@/hooks';
import { AppText, Button, IconButton, Screen, SectionLabel } from '@/components/ui';
import { PendingCard, CompletedCard, UpcomingRow } from '@/components/ChallengeCard';
import { ProgressRing } from '@/components/ProgressRing';
import { QuickStartSheet } from '@/components/QuickStartSheet';
import { HomeSkeleton } from '@/components/HomeSkeleton';

const EMPTY_RING_DAYS: SegmentState[] = Array(12).fill('empty');

/** Shown when the visitor has zero challenges at all (never created, never joined). */
function EmptyHome({ onStart }: { onStart: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 24 }}>
      <ProgressRing totalDays={12} days={EMPTY_RING_DAYS} size="L" />
      <View style={{ alignItems: 'center', gap: 8 }}>
        <AppText variant="hero" style={{ textAlign: 'center' }}>
          Henüz bir halkan yok.
        </AppText>
        <AppText variant="secondary" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 280 }}>
          Bir challenge kur, grubunu çağır — ya da bir davetle katıl.
        </AppText>
      </View>
      <View style={{ alignSelf: 'stretch' }}>
        <Button label="İlk halkanı kur" onPress={onStart} />
      </View>
    </View>
  );
}

function PendingCardWithCheckIn({
  challenge,
  onPress,
}: {
  challenge: Challenge;
  onPress: () => void;
}) {
  const { checkIn } = useCheckIn(challenge.id);
  return <PendingCard challenge={challenge} onPress={onPress} onCheckIn={checkIn} />;
}

export default function HomeScreen() {
  const router = useRouter();
  const { dateLabel, pending, done, upcoming, loading } = useTodayStatus();
  const { refreshing, refresh } = useRefreshChallenges();
  const [showStart, setShowStart] = useState(false);

  const goDetail = (id: string) => router.push(`/challenge/${id}`);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgBase }}>
      <Screen>
        {/* header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            paddingTop: 12,
            paddingBottom: 14,
          }}
        >
          <View>
            <AppText variant="screenTitle">Bugün</AppText>
            <AppText variant="meta" color={colors.textTertiary} style={{ marginTop: 4 }}>
              {dateLabel}
            </AppText>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <IconButton onPress={() => setShowStart(true)}>
              <Feather name="plus" size={20} color={colors.textPrimary} />
            </IconButton>
            <IconButton onPress={() => router.push('/settings')}>
              <Feather name="settings" size={18} color={colors.textSecondary} />
            </IconButton>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 48 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.ember} />
          }
        >
          {loading ? (
            // First real Supabase fetch still in flight — show placeholders
            // instead of letting the Phase-1 mock seed data flash on screen.
            <HomeSkeleton />
          ) : pending.length === 0 && done.length === 0 && upcoming.length === 0 ? (
            <EmptyHome onStart={() => setShowStart(true)} />
          ) : (
            <>
              {/* pending — big cards */}
              <View style={{ gap: 12 }}>
                {pending.map((c) => (
                  <Animated.View
                    key={c.id}
                    layout={LinearTransition}
                    entering={FadeIn}
                    exiting={FadeOut.duration(200)}
                  >
                    <PendingCardWithCheckIn challenge={c} onPress={() => goDetail(c.id)} />
                  </Animated.View>
                ))}
              </View>

              {/* completed — calm */}
              {done.length > 0 ? (
                <View style={{ marginTop: 16 }}>
                  <SectionLabel>Tamamlandı</SectionLabel>
                  <View style={{ gap: 10, marginTop: 12 }}>
                    {done.map((c) => (
                      <Animated.View key={c.id} layout={LinearTransition} entering={FadeIn}>
                        <CompletedCard challenge={c} onPress={() => goDetail(c.id)} />
                      </Animated.View>
                    ))}
                  </View>
                </View>
              ) : null}

              {/* upcoming — faint */}
              {upcoming.length > 0 ? (
                <View style={{ marginTop: spacing.section }}>
                  <SectionLabel>Yakında</SectionLabel>
                  <View style={{ marginTop: 4 }}>
                    {upcoming.map((c) => (
                      <UpcomingRow key={c.id} challenge={c} onPress={() => goDetail(c.id)} />
                    ))}
                  </View>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      </Screen>

      <QuickStartSheet visible={showStart} onClose={() => setShowStart(false)} />
    </View>
  );
}
