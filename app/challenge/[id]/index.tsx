import { useEffect, useMemo, useState } from 'react';
import { Alert, Keyboard, Pressable, RefreshControl, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { FlashList } from '@shopify/flash-list';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { colors, fonts, hairline, radius, spacing, type } from '@/theme/tokens';
import {
  useChallenge,
  useChallengesQuery,
  useCheckIn,
  useChallengeActions,
  useMomentumDemo,
  useRefreshChallenges,
  useChallengeMessages,
  useRealtimeChallenge,
  completedCount,
  waitingLine,
} from '@/hooks';
import type { Message, Participant } from '@/hooks';
import { friendlyErrorMessage } from '@/lib/errors';
import { AppText, AvatarStack, Button, IconButton } from '@/components/ui';
import { ProgressRing } from '@/components/ProgressRing';
import { CheckInButton } from '@/components/CheckInButton';
import { StakeBadge } from '@/components/StakeBadge';
import { InviteShare } from '@/components/InviteShare';
import { ParticipantRow } from '@/components/ParticipantRow';
import { DayDivider, MessageBubble, SystemEvent } from '@/components/Chat';
import { MissedDaySheet, MomentumSheet, OwnerSettingsSheet, NudgeMessageSheet } from '@/components/Sheets';
import { RingScreenSkeleton } from '@/components/Skeleton';
import { ErrorState } from '@/components/ErrorState';
import { useT } from '@/i18n';

type Row =
  | { kind: 'participant'; p: Participant }
  | { kind: 'label'; id: string; text: string }
  | { kind: 'chatError' }
  | { kind: 'chatDay'; day: number }
  | { kind: 'message'; m: Message }
  | { kind: 'system'; id: string; text: string };

/** Small "fact about this challenge" pill — same visual language as
 * StakeBadge (emoji-in-circle + text), used for joker allowance/remaining
 * and the join-window policy (saha testi bulgusu: both existed on the
 * Challenge object already but were never actually shown anywhere in
 * Detail). */
function InfoChip({ emoji, label }: { emoji: string; label: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: colors.bgElevated,
        borderColor: colors.strokeSubtle,
        borderWidth: hairline,
        borderRadius: radius.pill,
        paddingVertical: 9,
        paddingHorizontal: 14,
      }}
    >
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: 9,
          backgroundColor: colors.emberSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AppText style={{ fontSize: 11 }}>{emoji}</AppText>
      </View>
      <AppText variant="secondary" color={colors.textSecondary}>
        {label}
      </AppText>
    </View>
  );
}

export default function DetailScreen() {
  const { id, edit } = useLocalSearchParams<{ id: string; edit?: string }>();
  const router = useRouter();
  const { t } = useT();
  const challenge = useChallenge(id);
  const { loading, firstLoadError, error, refetch } = useChallengesQuery();
  const { checkIn, undo, meCheckedInToday, myOrder, myCheckinTime } = useCheckIn(id ?? '');
  const actions = useChallengeActions(id ?? '');
  const { momentumDemoId, close } = useMomentumDemo();
  const { refreshing, refresh } = useRefreshChallenges();
  const { firstLoadError: chatError, error: chatErrorDetail, retry: retryChat } = useChallengeMessages(id);
  useRealtimeChallenge(id);
  const [draft, setDraft] = useState('');
  const [showOwnerSettings, setShowOwnerSettings] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [nudgeTarget, setNudgeTarget] = useState<Participant | null>(null);

  // Home's swipe-to-edit action (saha testi bulgusu) lands here with
  // ?edit=1 to jump straight to the owner settings sheet instead of making
  // the owner tap the gear icon a second time.
  useEffect(() => {
    if (edit === '1' && challenge?.isOwner) setShowOwnerSettings(true);
  }, [edit, challenge?.isOwner]);
  const [starting, setStarting] = useState(false);
  const [showLobbyDatePicker, setShowLobbyDatePicker] = useState(false);
  const [lobbyDate, setLobbyDate] = useState<Date | null>(null);

  const rows = useMemo<Row[]>(() => {
    if (!challenge) return [];
    const out: Row[] = [];
    out.push({ kind: 'label', id: 'p', text: t.detail.participants });
    challenge.participants.forEach((p) => out.push({ kind: 'participant', p }));
    if (chatError || challenge.messages.length > 0) {
      out.push({ kind: 'label', id: 'c', text: t.detail.chat });
      if (chatError) out.push({ kind: 'chatError' });
      let lastDay = -1;
      challenge.messages.forEach((m) => {
        if (m.dayNumber !== lastDay) {
          out.push({ kind: 'chatDay', day: m.dayNumber });
          lastDay = m.dayNumber;
        }
        if (m.kind === 'system') {
          out.push({ kind: 'system', id: m.id, text: m.text });
        } else {
          out.push({ kind: 'message', m });
        }
      });
    }
    return out;
  }, [challenge, chatError, t]);

  // Auto-finish: once everyone's checked in on the LAST day, there's no
  // reason to sit around waiting for the calendar date to roll over —
  // close it out now instead of the challenge just quietly flipping to
  // 'completed' overnight. The actual navigation away happens in the
  // status-watching effect below, not here.
  const isLastDayFullyDone =
    !!challenge &&
    challenge.status === 'active' &&
    challenge.currentDay === challenge.totalDays &&
    challenge.participants.length > 0 &&
    completedCount(challenge) === challenge.participants.length;
  useEffect(() => {
    if (!isLastDayFullyDone) return;
    actions.endEarly();
    // Deliberately only watches isLastDayFullyDone — actions is stable enough
    // here and re-running this on every challenge poll tick would just
    // re-fire the (idempotent) endEarly call.
  }, [isLastDayFullyDone]);

  // Leave Detail for the celebration screen the moment the challenge is
  // 'completed' — whether that's the instant-finish above, or simply because
  // the calendar day rolled past the last one while this screen happened to
  // be open (mapRow recomputes status from today's date on every poll, no
  // check-in required). This used to only ever get picked up on the NEXT
  // mount, so a Detail screen left open past the challenge's actual end kept
  // showing a stale "waiting for tomorrow" view until backing out and back in
  // (saha testi bulgusu).
  useEffect(() => {
    if (challenge?.status === 'completed') {
      router.replace(`/challenge/${challenge.id}/complete`);
    }
  }, [challenge?.status]);

  if (!challenge) {
    // Not in the store yet — tell "still loading" and "genuinely failed" apart
    // from an actual 404, instead of always showing the same blunt message
    // (this matters most for a deep link straight into Detail, before any
    // screen has fetched the challenge list yet).
    const backButton = (
      <View style={{ paddingTop: 6, paddingHorizontal: spacing.screenX }}>
        <IconButton size={38} onPress={() => router.back()}>
          <Feather name="chevron-left" size={20} color={colors.textPrimary} />
        </IconButton>
      </View>
    );
    if (loading) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgBase }} edges={['top']}>
          {backButton}
          <View style={{ paddingHorizontal: spacing.screenX }}>
            <RingScreenSkeleton withList />
          </View>
        </SafeAreaView>
      );
    }
    if (firstLoadError) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgBase }} edges={['top']}>
          {backButton}
          <ErrorState
            message={t.detail.loadFailed}
            detail={friendlyErrorMessage(error)}
            onRetry={refetch}
          />
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgBase, alignItems: 'center', justifyContent: 'center' }}>
        <AppText color={colors.textSecondary}>{t.detail.notFound}</AppText>
      </SafeAreaView>
    );
  }

  const done = completedCount(challenge);
  const total = challenge.participants.length;
  const doneAvatars = challenge.participants
    .filter((p) => p.checkedInToday)
    .map((p) => ({ id: p.id, initials: p.initials }));
  // `missedAcknowledged` isn't persisted server-side (mapRow never sets it
  // for real challenges — see src/data/challenges.ts) so it resets to falsy
  // on every poll-driven refetch; without the meCheckedInToday check this
  // gate kept reappearing on every visit even after actually checking in
  // for today, which makes no sense — there's nothing left to acknowledge
  // once today is done.
  const showMissed = challenge.hasMissedYesterday && !challenge.missedAcknowledged && !meCheckedInToday;
  const showMomentum = momentumDemoId === challenge.id;

  const goHomeAfterExit = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const confirmLeave = () => {
    if (leaving) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Alert.alert(t.detail.leaveChallengeConfirmTitle, t.detail.leaveChallengeConfirmBody, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.detail.leaveChallenge,
        style: 'destructive',
        onPress: async () => {
          setLeaving(true);
          try {
            await actions.leaveChallenge();
            goHomeAfterExit();
          } catch (e) {
            Alert.alert(t.detail.leaveChallengeFailed, friendlyErrorMessage(e));
            setLeaving(false);
          }
        },
      },
    ]);
  };

  const doDeleteChallenge = async () => {
    await actions.deleteChallenge();
    setShowOwnerSettings(false);
    goHomeAfterExit();
  };

  const topBar = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.screenX,
        paddingTop: 6,
        paddingBottom: 16,
      }}
    >
      <IconButton size={40} onPress={() => router.back()}>
        <Feather name="chevron-left" size={20} color={colors.textPrimary} />
      </IconButton>
      <AppText
        numberOfLines={1}
        style={{
          flex: 1,
          textAlign: 'center',
          fontFamily: fonts.displaySemibold,
          fontSize: 17,
          color: colors.textPrimary,
        }}
      >
        {challenge.title}
      </AppText>
      {challenge.isOwner ? (
        <IconButton size={40} onPress={() => setShowOwnerSettings(true)}>
          <Feather name="settings" size={18} color={colors.textSecondary} />
        </IconButton>
      ) : (
        <IconButton size={40} onPress={confirmLeave}>
          <Feather name="log-out" size={18} color={colors.textSecondary} />
        </IconButton>
      )}
    </View>
  );

  const isUpcoming = challenge.status === 'upcoming';
  const isLobby = challenge.status === 'lobby';

  const startNow = async () => {
    if (starting) return;
    setStarting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      await actions.startChallenge();
    } catch (e) {
      Alert.alert(t.detail.lobbyStartFailed, friendlyErrorMessage(e));
    } finally {
      setStarting(false);
    }
  };

  const onChangeLobbyDate = async (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowLobbyDatePicker(false);
    if (event.type !== 'set' || !date) return;
    setLobbyDate(date);
    if (starting) return;
    setStarting(true);
    try {
      const pad = (n: number) => String(n).padStart(2, '0');
      const iso = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
      await actions.startChallenge(iso);
      setShowLobbyDatePicker(false);
    } catch (e) {
      Alert.alert(t.detail.lobbyStartFailed, friendlyErrorMessage(e));
    } finally {
      setStarting(false);
    }
  };

  const lobbyHeader = (
    <View style={{ paddingBottom: 8, alignItems: 'center', marginTop: 24 }}>
      <View
        style={{
          width: 88,
          height: 88,
          borderRadius: 44,
          backgroundColor: colors.bgSurface,
          borderWidth: hairline,
          borderColor: colors.strokeSubtle,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Feather name="users" size={30} color={colors.textSecondary} />
      </View>
      <AppText variant="screenTitle" style={{ fontSize: 20, marginTop: 16, textAlign: 'center' }}>
        {t.detail.lobbyTitle}
      </AppText>
      <AppText variant="secondary" color={colors.textSecondary} style={{ marginTop: 6, textAlign: 'center' }}>
        {t.detail.lobbySubtitle(challenge.participants.length)}
      </AppText>

      {challenge.stake ? (
        <View style={{ marginTop: 18 }}>
          <StakeBadge text={challenge.stake.text} align="center" />
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 14 }}>
        <InfoChip emoji="🃏" label={t.detail.jokerInfo(challenge.jokerRemaining, challenge.jokerAllowance)} />
        {challenge.firstDayJoinOnly ? <InfoChip emoji="⏱️" label={t.create.joinFirstDayOnly} /> : null}
      </View>

      <View style={{ marginTop: 24, alignSelf: 'stretch' }}>
        <InviteShare inviteCode={challenge.inviteCode} title={challenge.title} />
      </View>

      {challenge.isOwner ? (
        <View style={{ marginTop: 24, alignSelf: 'stretch', gap: 10 }}>
          <Button
            label={starting ? t.detail.lobbyStarting : t.detail.lobbyStartNow}
            onPress={startNow}
            disabled={starting}
          />
          <Button
            label={t.detail.lobbyPickDate}
            variant="secondary"
            onPress={() => setShowLobbyDatePicker((v) => !v)}
            disabled={starting}
          />
          {showLobbyDatePicker ? (
            <View
              style={{
                backgroundColor: colors.bgSurface,
                borderRadius: radius.card,
                borderWidth: hairline,
                borderColor: colors.strokeSubtle,
                padding: Platform.OS === 'ios' ? 8 : 16,
                alignItems: 'center',
              }}
            >
              <DateTimePicker
                value={lobbyDate ?? new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                minimumDate={new Date()}
                onChange={onChangeLobbyDate}
                themeVariant="dark"
                accentColor={colors.ember}
                textColor={colors.textPrimary}
              />
            </View>
          ) : null}
        </View>
      ) : (
        <AppText variant="meta" color={colors.textTertiary} style={{ marginTop: 20 }}>
          {t.detail.lobbyWaitingForOwner}
        </AppText>
      )}
    </View>
  );

  const header = isLobby ? lobbyHeader : (
    <View style={{ paddingBottom: 8 }}>
      {/* action + day */}
      <View style={{ alignItems: 'center', marginTop: 8 }}>
        <AppText variant="cardAction" style={{ fontSize: 22 }}>
          {challenge.dailyAction}
        </AppText>
        <AppText variant="meta" color={colors.textTertiary} tabular style={{ marginTop: 4 }}>
          {isUpcoming ? challenge.startsWhen : t.common.dayOf(challenge.currentDay, challenge.totalDays)}
        </AppText>
      </View>

      {/* the ring + central check-in (upcoming: no check-in yet — nothing to do) */}
      <View style={{ alignItems: 'center', marginTop: 20 }}>
        <ProgressRing
          totalDays={challenge.totalDays}
          days={challenge.days}
          size="L"
          activeIndex={challenge.currentDay - 1}
          centerContent={
            isUpcoming ? (
              <View style={{ alignItems: 'center' }}>
                <AppText style={{ fontFamily: fonts.displaySemibold, fontSize: 17, color: colors.textSecondary }}>
                  {t.detail.upcomingRing}
                </AppText>
                <AppText variant="meta" color={colors.textTertiary} style={{ marginTop: 4 }}>
                  {challenge.startsWhen}
                </AppText>
              </View>
            ) : (
              <CheckInButton
                day={challenge.currentDay}
                done={meCheckedInToday}
                time={myCheckinTime}
                onCheckIn={checkIn}
                onUndo={undo}
              />
            )
          }
        />
      </View>

      {/* post check-in social proof */}
      {!isUpcoming && meCheckedInToday && myOrder ? (
        <Animated.View entering={FadeIn.duration(250)} style={{ alignItems: 'center', marginTop: 18 }}>
          <AppText variant="bodyMedium" tabular>
            {t.detail.completedRank(myOrder)}
          </AppText>
          <AppText variant="meta" color={colors.textTertiary} style={{ marginTop: 2 }}>
            {waitingLine(challenge)}
          </AppText>
        </Animated.View>
      ) : null}

      {/* stake */}
      {challenge.stake ? (
        <View style={{ alignItems: 'center', marginTop: 20 }}>
          <StakeBadge text={challenge.stake.text} align="center" />
        </View>
      ) : null}

      {/* challenge facts — joker allowance/remaining + join-window policy;
          existed on the Challenge object already but were never shown
          anywhere in Detail (saha testi bulgusu). */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 14 }}>
        <InfoChip emoji="🃏" label={t.detail.jokerInfo(challenge.jokerRemaining, challenge.jokerAllowance)} />
        {challenge.firstDayJoinOnly ? <InfoChip emoji="⏱️" label={t.create.joinFirstDayOnly} /> : null}
      </View>

      {/* upcoming: invite is still open — let the owner pull people in later too */}
      {isUpcoming ? (
        <View style={{ marginTop: 24 }}>
          <InviteShare inviteCode={challenge.inviteCode} title={challenge.title} />
        </View>
      ) : null}

      {/* today count — meaningless before the challenge has actually started */}
      {!isUpcoming ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: spacing.section,
          }}
        >
          <AppText variant="bodyMedium" tabular>
            {t.detail.todayCount(done, total)}
          </AppText>
          {doneAvatars.length > 0 ? <AvatarStack people={doneAvatars} max={5} size={26} /> : null}
        </View>
      ) : null}
    </View>
  );

  const renderItem = ({ item }: { item: Row }) => {
    switch (item.kind) {
      case 'label':
        return (
          <AppText
            variant="meta"
            color={colors.textTertiary}
            style={{ textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 20, marginBottom: 6 }}
          >
            {item.text}
          </AppText>
        );
      case 'participant':
        return (
          <ParticipantRow
            participant={item.p}
            totalDays={challenge.totalDays}
            currentDay={challenge.currentDay}
            onNudge={() => setNudgeTarget(item.p)}
          />
        );
      case 'chatDay':
        return <DayDivider day={item.day} />;
      case 'system':
        return <SystemEvent text={item.text} />;
      case 'message':
        return (
          <MessageBubble
            message={item.m}
            onReact={(emoji) => actions.react(item.m.id, emoji)}
          />
        );
      case 'chatError':
        return (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              paddingVertical: 10,
            }}
          >
            <AppText variant="meta" color={colors.textTertiary} style={{ flex: 1 }}>
              {t.detail.chatLoadFailed}{chatErrorDetail ? `: ${friendlyErrorMessage(chatErrorDetail)}` : '.'}
            </AppText>
            <AppText variant="meta" color={colors.ember} onPress={() => retryChat()}>
              {t.common.retry}
            </AppText>
          </View>
        );
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgBase }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {topBar}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <FlashList
            data={rows}
            renderItem={renderItem}
            keyExtractor={(item, i) =>
              item.kind === 'participant'
                ? `p-${item.p.id}`
                : item.kind === 'message'
                  ? `m-${item.m.id}`
                  : `${item.kind}-${i}`
            }
            ListHeaderComponent={header}
            contentContainerStyle={{ paddingHorizontal: spacing.screenX, paddingBottom: 16 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.ember} />
            }
          />

          {/* note / chat input */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingHorizontal: spacing.screenX,
              paddingTop: 8,
              paddingBottom: 8,
              borderTopWidth: hairline,
              borderTopColor: colors.strokeSubtle,
              backgroundColor: colors.bgBase,
            }}
          >
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={t.detail.composerPlaceholder}
              placeholderTextColor={colors.textTertiary}
              style={{
                flex: 1,
                height: 44,
                backgroundColor: colors.bgElevated,
                borderRadius: radius.pill,
                borderWidth: hairline,
                borderColor: colors.strokeSubtle,
                paddingHorizontal: 16,
                color: colors.textPrimary,
                fontFamily: type.body.fontFamily,
                fontSize: 15,
              }}
            />
            <Pressable
              onPress={async () => {
                const text = draft.trim();
                if (!text) return;
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setDraft('');
                const sent = await actions.sendMessage(text);
                if (sent) Keyboard.dismiss();
              }}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: draft.trim() ? colors.ember : colors.bgElevated,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Feather
                name="arrow-right"
                size={20}
                color={draft.trim() ? colors.bgBase : colors.textTertiary}
              />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* E8 gate */}
      {showMissed ? (
        <MissedDaySheet
          challenge={challenge}
          onUseJoker={actions.useJoker}
          onDismiss={actions.ackMissed}
        />
      ) : null}

      {/* E10 momentum */}
      {showMomentum && challenge.momentum ? (
        <MomentumSheet
          momentum={challenge.momentum}
          onRestart={() => {
            actions.restart();
            close();
          }}
          onEndEarly={() => {
            actions.endEarly();
            close();
            router.replace(`/challenge/${challenge.id}/complete`);
          }}
          onClose={close}
        />
      ) : null}

      {/* Faz 3C madde 3 — owner-only settings */}
      {showOwnerSettings ? (
        <OwnerSettingsSheet
          visible={showOwnerSettings}
          challenge={challenge}
          onClose={() => setShowOwnerSettings(false)}
          onSave={actions.updateDetails}
          onDelete={doDeleteChallenge}
        />
      ) : null}

      {/* El sallama artık tek genel mesaj değil, birkaç anlamlı seçenekten
          biri (saha testi bulgusu) */}
      {nudgeTarget ? (
        <NudgeMessageSheet
          participantName={nudgeTarget.name}
          onSend={(message) => {
            actions.nudge(nudgeTarget.id, nudgeTarget.name, message);
            setNudgeTarget(null);
          }}
          onClose={() => setNudgeTarget(null)}
        />
      ) : null}
    </View>
  );
}
