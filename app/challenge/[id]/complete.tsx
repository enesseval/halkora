import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, fonts, hairline, radius, spacing, type } from '@/theme/tokens';
import { useChallenge, useChallengeActions, useChallengesQuery } from '@/hooks';
import { useAuth } from '@/hooks/useAuth';
import { friendlyErrorMessage, alertOnce } from '@/lib/errors';
import { AppText, Avatar, Button, Card, IconButton, Screen, SectionLabel } from '@/components/ui';
import { ProgressRing } from '@/components/ProgressRing';
import { RingScreenSkeleton } from '@/components/Skeleton';
import { ErrorState } from '@/components/ErrorState';
import { FeedbackSheet, FeedbackPromptSheet } from '@/components/Sheets';
import { isFeedbackPromptDone, markFeedbackPromptDone } from '@/lib/feedbackPrompt';
import { maybeAskForRating } from '@/lib/rateApp';
import { track, trackError } from '@/data/events';
import { useT } from '@/i18n';
import type { SegmentState } from '@/hooks';

function Stat({ value, label, tint }: { value: string; label: string; tint?: string }) {
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
      <AppText tabular style={{ fontFamily: fonts.displayBold, fontSize: 26, lineHeight: 32, color: tint ?? colors.textPrimary }}>
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
  const { isPro } = useAuth();
  const { loading, firstLoadError, error, refetch } = useChallengesQuery();
  const actions = useChallengeActions(id ?? '');
  const [settling, setSettling] = useState(false);
  const [showFeedbackPrompt, setShowFeedbackPrompt] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  // Aşağıdaki `stats` yükleme kontrollerinden SONRA tanımlı; efekt ise
  // bileşenin en üstünde çalışmak zorunda, o yüzden ihtiyacı olan iki değeri
  // burada ayrıca türetiyoruz. Halka henüz yüklenmediyse ikisi de boş kalır
  // ve efekt bağımlılıklarından yeniden çalışır.
  const challengeId = challenge?.id;
  const pct = challenge?.finishStats?.completionPct ?? null;

  // Geri bildirim isteği tam burada: kişi baştan sona bir halka yaşamış ve
  // söyleyecek somut bir şeyi var. "7 gündür kullanıyorsun" gibi zamana bağlı
  // bir tetik hiç check-in yapmamış birine de çıkardı.
  //
  // Bir kez. Geri gelen bir istek reklamdır (widgetHint.ts ile aynı gerekçe);
  // "şimdi değil" de bir cevaptır ve Ayarlar'daki buton her zaman yerinde.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!(await isFeedbackPromptDone())) {
        if (alive) setShowFeedbackPrompt(true);
        return;
      }
      // Geri bildirim zaten sorulmuş demek, bu ilk bitirilen halka değil.
      // Puan isteği ancak buradan sonra devreye giriyor ve ASLA geri bildirim
      // isteğiyle aynı ekranda çıkmıyor: üst üste iki dialog ikisini de
      // değersizleştirir.
      //
      // İlk halkada geri bildirim, sonrakilerde puan — sırası bilinçli. Erken
      // dönemde neyin bozuk olduğunu öğrenmek, bir puandan daha kıymetli.
      if (!challengeId || pct == null) return;
      await maybeAskForRating(challengeId, pct);
    })();
    return () => {
      alive = false;
    };
  }, [challengeId, pct]);

  // Derived here (not inside the JSX) so the settle button's visibility rule
  // stays readable: there's nothing to "mark as paid" when the stake was
  // already closed, when nobody fell short, or when this is a pre-v2 stake
  // whose outcome was never computed at all.
  const settled = !!challenge?.stake?.settled;
  const stakeLine = challenge?.stakeResult ?? (challenge?.stake ? t.complete.stakeResult(challenge.stake.text) : '');
  const outcome = challenge?.stakeOutcome;
  const someoneOwes =
    outcome?.kind === 'collective' ? outcome.collectiveHit === false : (outcome?.losers.length ?? 0) > 0;
  const canSettle = !!outcome && !settled && someoneOwes;

  // Cold-started here (a push, or the ring vanishing under you) there may be
  // nothing to go back TO, so Home is the floor.
  const goHome = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const doSettle = async () => {
    if (settling) return;
    setSettling(true);
    try {
      await actions.settleStake();
    } catch (e) {
      trackError('settle_stake', e);
      alertOnce(t.complete.settleFailed, friendlyErrorMessage(e));
    } finally {
      setSettling(false);
    }
  };

  if (!challenge) {
    return (
      <Screen edges={['top', 'bottom']}>
        {loading ? (
          <RingScreenSkeleton />
        ) : firstLoadError ? (
          <ErrorState message={t.complete.loadFailed} detail={friendlyErrorMessage(error)} onRetry={refetch} />
        ) : (
          <ErrorState message={t.complete.notFound} />
        )}
      </Screen>
    );
  }

  const stats = challenge.finishStats;
  const advanced = challenge.advancedStats;
  // Mini ring on the perfect-days card. It marks WHICH days everyone covered,
  // matching the big ring above it — filling the first N segments instead made
  // the two rings disagree about the same challenge, since a ring reads as a
  // calendar everywhere else in the app.
  const perfectSet = new Set(advanced?.perfectDayNumbers ?? []);
  const perfectRing: SegmentState[] = Array.from({ length: challenge.totalDays }, (_, i) =>
    perfectSet.has(i + 1) ? 'done' : 'empty',
  );
  const finishers = [...challenge.participants].sort(
    (a, b) => (b.completedDays ?? 0) - (a.completedDays ?? 0),
  );

  // Opens the 9:16 share-card preview (image share) instead of a bare text
  // share — the card is the thing people actually post. A real
  // transparentModal route (app/challenge/[id]/share.tsx), not inline state
  // — see that file for why.
  const share = () => router.push(`/challenge/${challenge.id}/share`);

  const openPaywall = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push('/paywall?reason=advancedStats');
  };

  return (
    <Screen edges={['top', 'bottom']}>
      {/* This screen had no way out at all. Reaching it because a ring you
          were in was deleted or closed left you on a dead end — back-swipe
          worked, but nothing on screen said so (saha testi bulgusu — "o
          ekranda da çarpı vs. falan yok"). */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 6 }}>
        <IconButton size={38} onPress={goHome}>
          <Feather name="x" size={18} color={colors.textPrimary} />
        </IconButton>
        <View style={{ flex: 1 }} />
        {/* The ring itself is still there, chat and all — the finish screen is
            a summary, not a replacement for it. */}
        <Pressable
          onPress={() => router.push(`/challenge/${challenge.id}?from=complete`)}
          style={({ pressed }) => ({ paddingHorizontal: 10, paddingVertical: 8, opacity: pressed ? 0.6 : 1 })}
        >
          <AppText variant="secondary" color={colors.ember}>
            {t.complete.openRing}
          </AppText>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.section }}>
        <View style={{ alignItems: 'center', marginTop: 8 }}>
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
            <Stat value={t.common.percent(stats.completionPct)} label={t.complete.statCompletion} tint={colors.ember} />
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

        {/* advanced stats — Halkora Pro. Free users see a locked teaser that
            opens the paywall; Pro users see perfect days + per-person streaks. */}
        {advanced ? (
          <View style={{ marginTop: spacing.section }}>
            <SectionLabel>{t.complete.storyTitle}</SectionLabel>

            {isPro ? (
              <View style={{ marginTop: 12, gap: 14 }}>
                {/* perfect days — big number + mini ring of that fill */}
                <Card>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <AppText tabular style={{ fontFamily: fonts.displayBold, fontSize: 34, lineHeight: 38, color: colors.ember }}>
                        {advanced.perfectDays}
                      </AppText>
                      <AppText variant="bodyMedium" style={{ marginTop: 2 }}>
                        {t.complete.advancedPerfectDays}
                      </AppText>
                      <AppText variant="meta" color={colors.textTertiary} style={{ marginTop: 2 }}>
                        {t.complete.advancedPerfectDaysSub}
                      </AppText>
                    </View>
                    <ProgressRing
                      totalDays={challenge.totalDays}
                      days={perfectRing}
                      size="M"
                      diameter={56}
                      strokeWidth={5}
                    />
                  </View>
                </Card>

                {/* per-person leaderboard with streaks */}
                <Card style={{ paddingVertical: 4 }}>
                  {advanced.leaderboard.map((p, i) => (
                    <View
                      key={`${p.name}-${i}`}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        paddingVertical: 12,
                        borderBottomWidth: i === advanced.leaderboard.length - 1 ? 0 : hairline,
                        borderBottomColor: colors.strokeSubtle,
                      }}
                    >
                      <Avatar initials={p.initials} size={34} />
                      <View style={{ flex: 1 }}>
                        <AppText variant="bodyMedium">{p.name}</AppText>
                        <AppText variant="meta" color={colors.textTertiary}>
                          {t.complete.advancedDaysFmt(p.completedDays, challenge.totalDays)} ·{' '}
                          {t.common.percent(p.completionPct)}
                        </AppText>
                      </View>
                      <AppText variant="secondary" tabular color={colors.textSecondary}>
                        🔥 {p.longestStreak}
                      </AppText>
                    </View>
                  ))}
                </Card>
              </View>
            ) : (
              <Pressable
                onPress={openPaywall}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  backgroundColor: colors.bgSurface,
                  borderRadius: radius.badge,
                  borderWidth: hairline,
                  borderColor: colors.strokeSubtle,
                  paddingVertical: 16,
                  paddingHorizontal: 18,
                  marginTop: 12,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    backgroundColor: colors.bgElevated,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Feather name="lock" size={15} color={colors.textSecondary} />
                </View>
                <AppText variant="secondary" style={{ flex: 1 }}>
                  {t.pro.sub.advancedStats}
                </AppText>
                <View style={{ backgroundColor: colors.ember, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 7 }}>
                  <AppText style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.bgBase }}>
                    {t.complete.advancedUnlockCta}
                  </AppText>
                </View>
              </Pressable>
            )}
          </View>
        ) : null}

        {/* Stake. Three states (docs/BAHIS-V2-VE-ROVANS.md §6):
             - settled -> muted, closed
             - computed result -> the outcome + a "mark as paid" action, but
               only when somebody actually owes something
             - pre-v2 stake with no threshold -> just its own text, as before */}
        {challenge.stakeResult || challenge.stake?.text ? (
          <View style={{ marginTop: 24, gap: 10 }}>
            <View
              style={{
                backgroundColor: settled ? 'transparent' : colors.emberSoft,
                borderRadius: radius.badge,
                borderWidth: settled ? hairline : 0,
                borderColor: colors.strokeSubtle,
                paddingVertical: 14,
                paddingHorizontal: 16,
                alignItems: 'center',
              }}
            >
              <AppText
                variant="bodyMedium"
                color={settled ? colors.textTertiary : colors.ember}
                style={{ textAlign: 'center' }}
              >
                {settled ? `${t.complete.settledLabel} · ${stakeLine}` : stakeLine}
              </AppText>
            </View>
            {canSettle ? (
              // One label for both kinds. The collective one used to read
              // "Kutlandı olarak işaretle" — but `canSettle` only lets this
              // button exist when someone actually OWES the stake, which for
              // a collective ring means the target was MISSED. So the only
              // time it was ever shown was the one time "celebrated" was the
              // wrong word (saha testi bulgusu — "kolektif altı halkada
              // kutlandı diye bir şey var, bu nereden çıktı").
              <Button
                label={settling ? t.common.continue : t.complete.settleCta}
                variant="secondary"
                onPress={doSettle}
                disabled={settling}
              />
            ) : null}
          </View>
        ) : null}

        {/* CTAs. "Rövanş" — a new ring pre-filled from this one, auto-inviting
            the old group — used to lead here. Removed on request: it was
            never asked for, and a finished ring's screen is for looking back,
            not for being sold the next one. Starting again is what the "+" on
            Home is. */}
        <View style={{ gap: 12, marginTop: spacing.section }}>
          <Button label={t.complete.shareResult} onPress={share} />
        </View>
      </ScrollView>

      {showFeedbackPrompt ? (
        <FeedbackPromptSheet
          onAccept={() => {
            track('feedback_prompt', { action: 'accept' });
            void markFeedbackPromptDone();
            setShowFeedbackPrompt(false);
            setShowFeedback(true);
          }}
          onDismiss={() => {
            track('feedback_prompt', { action: 'dismiss' });
            void markFeedbackPromptDone();
            setShowFeedbackPrompt(false);
          }}
        />
      ) : null}

      {showFeedback ? <FeedbackSheet onClose={() => setShowFeedback(false)} /> : null}
    </Screen>
  );
}
