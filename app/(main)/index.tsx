import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { colors, spacing } from '@/theme/tokens';
import { useTodayStatus, useCheckIn, useRefreshChallenges } from '@/hooks';
import type { Challenge } from '@/hooks';
import { AppText, IconButton, Screen, SectionLabel } from '@/components/ui';
import { PendingCard, CompletedCard, UpcomingRow } from '@/components/ChallengeCard';
import { QuickStartSheet } from '@/components/QuickStartSheet';

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
  const { dateLabel, pending, done, upcoming } = useTodayStatus();
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
              <SectionLabel>Yarın Başlıyor</SectionLabel>
              <View style={{ marginTop: 4 }}>
                {upcoming.map((c) => (
                  <UpcomingRow key={c.id} challenge={c} onPress={() => goDetail(c.id)} />
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      </Screen>

      <QuickStartSheet visible={showStart} onClose={() => setShowStart(false)} />
    </View>
  );
}
