import { useMemo, useState } from 'react';
import { Keyboard, Pressable, RefreshControl, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colors, fonts, hairline, radius, spacing, type } from '@/theme/tokens';
import {
  useChallenge,
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
import { AppText, AvatarStack, IconButton } from '@/components/ui';
import { ProgressRing } from '@/components/ProgressRing';
import { CheckInButton } from '@/components/CheckInButton';
import { StakeBadge } from '@/components/StakeBadge';
import { InviteShare } from '@/components/InviteShare';
import { ParticipantRow } from '@/components/ParticipantRow';
import { DayDivider, MessageBubble, SystemEvent } from '@/components/Chat';
import { MissedDaySheet, MomentumSheet } from '@/components/Sheets';

type Row =
  | { kind: 'participant'; p: Participant }
  | { kind: 'label'; id: string; text: string }
  | { kind: 'chatDay'; day: number }
  | { kind: 'message'; m: Message }
  | { kind: 'system'; id: string; text: string };

export default function DetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const challenge = useChallenge(id);
  const { checkIn, undo, meCheckedInToday, myOrder, myCheckinTime } = useCheckIn(id ?? '');
  const actions = useChallengeActions(id ?? '');
  const { momentumDemoId, close } = useMomentumDemo();
  const { refreshing, refresh } = useRefreshChallenges();
  useChallengeMessages(id);
  useRealtimeChallenge(id);
  const [draft, setDraft] = useState('');

  const rows = useMemo<Row[]>(() => {
    if (!challenge) return [];
    const out: Row[] = [];
    out.push({ kind: 'label', id: 'p', text: 'Katılımcılar' });
    challenge.participants.forEach((p) => out.push({ kind: 'participant', p }));
    if (challenge.messages.length > 0) {
      out.push({ kind: 'label', id: 'c', text: 'Sohbet' });
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
  }, [challenge]);

  if (!challenge) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgBase, alignItems: 'center', justifyContent: 'center' }}>
        <AppText color={colors.textSecondary}>Challenge bulunamadı.</AppText>
      </SafeAreaView>
    );
  }

  const done = completedCount(challenge);
  const total = challenge.participants.length;
  const doneAvatars = challenge.participants
    .filter((p) => p.checkedInToday)
    .map((p) => ({ id: p.id, initials: p.initials }));
  const showMissed = challenge.hasMissedYesterday && !challenge.missedAcknowledged;
  const showMomentum = momentumDemoId === challenge.id;

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
      <View style={{ width: 40 }} />
    </View>
  );

  const isUpcoming = challenge.status === 'upcoming';

  const header = (
    <View style={{ paddingBottom: 8 }}>
      {/* action + day */}
      <View style={{ alignItems: 'center', marginTop: 8 }}>
        <AppText variant="cardAction" style={{ fontSize: 22 }}>
          {challenge.dailyAction}
        </AppText>
        <AppText variant="meta" color={colors.textTertiary} tabular style={{ marginTop: 4 }}>
          {isUpcoming ? challenge.startsWhen : `Gün ${challenge.currentDay}/${challenge.totalDays}`}
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
                  Henüz başlamadı
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
            Sen {myOrder}. tamamlayansın
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
            Bugün {done}/{total}
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
            onNudge={() => actions.nudge(item.p.id)}
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
              placeholder="Bir not bırak..."
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
                const t = draft.trim();
                if (!t) return;
                setDraft('');
                const sent = await actions.sendMessage(t);
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
    </View>
  );
}
