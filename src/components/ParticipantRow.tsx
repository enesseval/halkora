import { Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, hairline, radius, type } from '@/theme/tokens';
import { Participant, SegmentState } from '@/data/types';
import { buildDays } from '@/lib/day';
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
  const silent = !participant.checkedInToday && (participant.silentDays ?? 0) >= 2;

  let status: string;
  if (participant.checkedInToday) {
    status = participant.isMe && participant.checkinTime
      ? `✓ Bugün · ${participant.checkinTime}`
      : '✓ Bugün';
  } else if (silent) {
    status = `${participant.silentDays} gündür sessiz`;
  } else {
    status = 'Bekliyor';
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
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

      {silent ? (
        <Pressable
          disabled={participant.nudged}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            onNudge();
          }}
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
            {participant.nudged ? 'Sallandı ✓' : 'El salla 👋'}
          </AppText>
        </Pressable>
      ) : null}

      <ProgressRing
        totalDays={totalDays}
        days={personalDays(participant, totalDays, currentDay)}
        size="S"
      />
    </View>
  );
}
