import { Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { colors, hairline, radius, type } from '@/theme/tokens';
import { Participant, SegmentState } from '@/data/types';
import { buildDays } from '@/lib/day';
import { useT } from '@/i18n';
import { ProgressRing } from './ProgressRing';
import { AppText, Avatar } from './ui';

interface Props {
  participant: Participant;
  totalDays: number;
  currentDay: number;
  onNudge: () => void;
}

/** Build a plausible personal ring so each row reads individually. */
function personalDays(p: Participant, total: number, currentDay: number): SegmentState[] {
  const filled = p.checkedInToday ? currentDay : Math.max(currentDay - 1, 0);
  const explicit: SegmentState[] = [];
  for (let i = 0; i < filled; i++) explicit.push('done');
  if (!p.checkedInToday && currentDay - 1 < total) explicit[currentDay - 1] = 'today';
  return buildDays(total, explicit);
}

export function ParticipantRow({ participant, totalDays, currentDay, onNudge }: Props) {
  const { t } = useT();
  // The nudge button used to only appear once someone had been silent 2+
  // days — showed up so rarely it read as broken (saha testi bulgusu: "1-2
  // kere gördüm öylece kaldı"). Now it's available for anyone who simply
  // hasn't checked in yet today; the "X gündür sessiz" status line is its
  // own, stricter condition below (that escalation is still worth calling
  // out specifically, separately from whether the button shows).
  // Never on your own row — nudging yourself makes no sense (saha testi
  // bulgusu: "kendime de atabiliyorum saçma"), and the old 2-day gate
  // happened to hide this because you're never "silent" relative to
  // yourself the same way, but removing that gate exposed it.
  const canNudge = !participant.isMe && !participant.checkedInToday;
  const reallySilent = canNudge && (participant.silentDays ?? 0) >= 2;
  const shakeX = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));

  const onPressNudge = () => {
    if (participant.nudged) {
      // Already nudged today (server-truth — participant.nudged now reflects
      // the DB's real one-per-day state, docs/PHASE2-SUPABASE.md "Ek K") —
      // a silent no-op here would look like the tap didn't register at all.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      shakeX.value = withSequence(
        withTiming(-6, { duration: 45 }),
        withTiming(6, { duration: 45 }),
        withTiming(-4, { duration: 45 }),
        withTiming(4, { duration: 45 }),
        withTiming(0, { duration: 45 }),
      );
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onNudge();
  };

  let status: string;
  if (participant.checkedInToday) {
    status = participant.isMe && participant.checkinTime
      ? t.participant.checkedInTodayAt(participant.checkinTime)
      : t.participant.checkedInToday;
  } else if (reallySilent) {
    status = t.participant.silentDays(participant.silentDays ?? 0);
  } else {
    status = t.participant.waiting;
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        // A raised card-within-the-list for "you" — a neutral highlight (not
        // the ember accent, which already means "checked in" elsewhere) so
        // your own row reads at a glance without implying a status.
        paddingHorizontal: participant.isMe ? 10 : 0,
        marginHorizontal: participant.isMe ? -10 : 0,
        borderRadius: participant.isMe ? radius.card : 0,
        backgroundColor: participant.isMe ? colors.bgElevated : 'transparent',
      }}
    >
      <Avatar
        initials={participant.initials}
        size={34}
        tint={participant.checkedInToday}
      />
      <View style={{ flex: 1 }}>
        <AppText variant="bodyMedium" style={{ fontSize: 16 }}>
          {participant.name}
          {participant.isMe ? (
            <AppText variant="meta" color={colors.textTertiary}>
              {' '}{t.participant.you}
            </AppText>
          ) : null}
        </AppText>
        <AppText
          variant="meta"
          tabular
          color={participant.checkedInToday ? colors.ember : colors.textTertiary}
          style={{ marginTop: 1 }}
        >
          {status}
        </AppText>
      </View>

      {canNudge ? (
        <Animated.View style={shakeStyle}>
          <Pressable
            onPress={onPressNudge}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: radius.pill,
              borderWidth: hairline,
              borderColor: colors.strokeSubtle,
              backgroundColor: colors.bgElevated,
              marginRight: 4,
            }}
          >
            <AppText
              style={{
                fontFamily: type.bodyMedium.fontFamily,
                fontSize: 13,
                color: participant.nudged ? colors.textTertiary : colors.textSecondary,
              }}
            >
              {participant.nudged ? t.participant.nudged : t.participant.nudge}
            </AppText>
          </Pressable>
        </Animated.View>
      ) : null}

      <ProgressRing
        totalDays={totalDays}
        days={personalDays(participant, totalDays, currentDay)}
        size="S"
      />
    </View>
  );
}
