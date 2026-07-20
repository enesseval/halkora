import { useEffect, useRef, useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { colors, spacing } from '@/theme/tokens';
import { useTodayStatus, useCheckIn, useChallengeActions, useRefreshChallenges, useCompletedChallenges } from '@/hooks';
import type { Challenge, SegmentState } from '@/hooks';
import { errMessage } from '@/lib/errors';
import { AppText, Button, IconButton, Screen, SectionLabel } from '@/components/ui';
import { PendingCard, CompletedCard, UpcomingRow } from '@/components/ChallengeCard';
import { SwipeableRow, SwipeAction } from '@/components/SwipeableRow';
import { ProgressRing } from '@/components/ProgressRing';
import { QuickStartSheet } from '@/components/QuickStartSheet';
import { HomeSkeleton } from '@/components/HomeSkeleton';
import { ErrorState } from '@/components/ErrorState';
import { useT } from '@/i18n';

const EMPTY_RING_DAYS: SegmentState[] = Array(12).fill('empty');

/** Shown when the visitor has zero challenges at all (never created, never joined). */
function EmptyHome({ onStart }: { onStart: () => void }) {
  const { t } = useT();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 24 }}>
      <ProgressRing totalDays={12} days={EMPTY_RING_DAYS} size="L" />
      <View style={{ alignItems: 'center', gap: 8 }}>
        <AppText variant="hero" style={{ textAlign: 'center' }}>
          {t.home.emptyTitle}
        </AppText>
        <AppText variant="secondary" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 280 }}>
          {t.home.emptySubtitle}
        </AppText>
      </View>
      <View style={{ alignSelf: 'stretch' }}>
        <Button label={t.home.emptyCta} onPress={onStart} />
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

/**
 * Home's own swipe-to-delete/leave (saha testi bulgusu — "iOS'taki klasik
 * sağdan sola kaydırma"). Owner gets Düzenle (→ Detail with the owner
 * settings sheet auto-opened) + Sil; anyone else just gets Ayrıl. Both
 * destructive actions reuse the exact confirm copy already used inside
 * Detail (t.detail.delete/leaveChallenge*) so the two entry points read as
 * the same feature, not two different ones.
 */
function useRowSwipeActions(challenge: Challenge): SwipeAction[] {
  const { t } = useT();
  const router = useRouter();
  const actions = useChallengeActions(challenge.id);
  const busy = useRef(false);

  const confirmDelete = () => {
    if (busy.current) return;
    Alert.alert(t.detail.deleteChallengeConfirmTitle, t.detail.deleteChallengeConfirmBody, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.detail.deleteChallenge,
        style: 'destructive',
        onPress: async () => {
          busy.current = true;
          try {
            await actions.deleteChallenge();
          } catch (e) {
            Alert.alert(t.detail.deleteChallengeFailed, errMessage(e));
          } finally {
            busy.current = false;
          }
        },
      },
    ]);
  };

  const confirmLeave = () => {
    if (busy.current) return;
    Alert.alert(t.detail.leaveChallengeConfirmTitle, t.detail.leaveChallengeConfirmBody, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.detail.leaveChallenge,
        style: 'destructive',
        onPress: async () => {
          busy.current = true;
          try {
            await actions.leaveChallenge();
          } catch (e) {
            Alert.alert(t.detail.leaveChallengeFailed, errMessage(e));
          } finally {
            busy.current = false;
          }
        },
      },
    ]);
  };

  if (challenge.isOwner) {
    return [
      {
        label: t.common.edit,
        icon: 'edit-2',
        color: colors.ember,
        onPress: () => router.push(`/challenge/${challenge.id}?edit=1`),
      },
      { label: t.detail.deleteChallenge, icon: 'trash-2', color: colors.joker, onPress: confirmDelete },
    ];
  }
  return [{ label: t.detail.leaveChallenge, icon: 'log-out', color: colors.joker, onPress: confirmLeave }];
}

function SwipeablePendingCard({ challenge, onPress }: { challenge: Challenge; onPress: () => void }) {
  const rowActions = useRowSwipeActions(challenge);
  return (
    <SwipeableRow actions={rowActions}>
      <PendingCardWithCheckIn challenge={challenge} onPress={onPress} />
    </SwipeableRow>
  );
}

function SwipeableCompletedCard({ challenge, onPress }: { challenge: Challenge; onPress: () => void }) {
  const rowActions = useRowSwipeActions(challenge);
  return (
    <SwipeableRow actions={rowActions}>
      <CompletedCard challenge={challenge} onPress={onPress} />
    </SwipeableRow>
  );
}

function SwipeableUpcomingRow({ challenge, onPress }: { challenge: Challenge; onPress: () => void }) {
  const rowActions = useRowSwipeActions(challenge);
  return (
    <SwipeableRow actions={rowActions}>
      <UpcomingRow challenge={challenge} onPress={onPress} />
    </SwipeableRow>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useT();
  const { dateLabel, pending, done, upcoming, loading, firstLoadError, backgroundError, error, retry } =
    useTodayStatus();
  // Genuinely FINISHED challenges (status === 'completed') — distinct from
  // `done` above, which despite its section label really means "checked in
  // today" on a still-ongoing challenge. Without this, a challenge that
  // finishes has no section it belongs to on Home at all — it just quietly
  // stops appearing anywhere, even though its data/history is still there.
  const finished = useCompletedChallenges();
  const { refreshing, refresh } = useRefreshChallenges();
  const [showStart, setShowStart] = useState(false);

  const goDetail = (id: string) => router.push(`/challenge/${id}`);
  const goComplete = (id: string) => router.push(`/challenge/${id}/complete`);

  // A poll/pull-to-refresh failing after we already have real data shouldn't
  // blank the list — just say so once per failure streak (not every 5s poll).
  const alerted = useRef(false);
  useEffect(() => {
    if (backgroundError && !alerted.current) {
      alerted.current = true;
      Alert.alert(t.errors.updateFailed, errMessage(error) || t.errors.checkConnection);
    } else if (!backgroundError) {
      alerted.current = false;
    }
  }, [backgroundError, error, t]);

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
            <AppText variant="screenTitle">{t.home.title}</AppText>
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
          ) : firstLoadError ? (
            <ErrorState
              message={t.home.challengesLoadFailed}
              detail={errMessage(error)}
              onRetry={retry}
            />
          ) : pending.length === 0 && done.length === 0 && upcoming.length === 0 && finished.length === 0 ? (
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
                    <SwipeablePendingCard challenge={c} onPress={() => goDetail(c.id)} />
                  </Animated.View>
                ))}
              </View>

              {/* completed — calm */}
              {done.length > 0 ? (
                <View style={{ marginTop: 16 }}>
                  <SectionLabel>{t.home.completed}</SectionLabel>
                  <View style={{ gap: 10, marginTop: 12 }}>
                    {done.map((c) => (
                      <Animated.View key={c.id} layout={LinearTransition} entering={FadeIn}>
                        <SwipeableCompletedCard challenge={c} onPress={() => goDetail(c.id)} />
                      </Animated.View>
                    ))}
                  </View>
                </View>
              ) : null}

              {/* upcoming — faint */}
              {upcoming.length > 0 ? (
                <View style={{ marginTop: spacing.section }}>
                  <SectionLabel>{t.home.upcoming}</SectionLabel>
                  <View style={{ marginTop: 4 }}>
                    {upcoming.map((c) => (
                      <SwipeableUpcomingRow key={c.id} challenge={c} onPress={() => goDetail(c.id)} />
                    ))}
                  </View>
                </View>
              ) : null}

              {/* finished — history, links to the celebration/stats screen
                  rather than Detail (check-in/chat don't make sense anymore) */}
              {finished.length > 0 ? (
                <View style={{ marginTop: spacing.section }}>
                  <SectionLabel>{t.home.history}</SectionLabel>
                  <View style={{ gap: 10, marginTop: 12 }}>
                    {finished.map((c) => (
                      <Animated.View key={c.id} layout={LinearTransition} entering={FadeIn}>
                        <CompletedCard challenge={c} onPress={() => goComplete(c.id)} />
                      </Animated.View>
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
