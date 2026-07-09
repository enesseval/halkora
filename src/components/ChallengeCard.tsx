import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, fonts, hairline, radius } from '@/theme/tokens';
import { Challenge } from '@/data/types';
import { completedCount } from '@/hooks';
import { ProgressRing } from './ProgressRing';
import { AvatarStack } from './ui';

interface Props {
  challenge: Challenge;
  onPress: () => void;
  onCheckIn: () => void;
}

/** E2 — big actionable card for a challenge still awaiting today's check-in. */
export function PendingCard({ challenge, onPress, onCheckIn }: Props) {
  const done = completedCount(challenge);
  const total = challenge.participants.length;
  const doneAvatars = challenge.participants
    .filter((p) => p.checkedInToday && !p.isMe)
    .map((p) => ({ id: p.id, initials: p.initials }));

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: colors.bgSurface,
        borderRadius: radius.card,
        borderWidth: hairline,
        borderColor: colors.strokeSubtle,
        padding: 20,
        opacity: pressed ? 0.96 : 1,
      })}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 18,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              fontFamily: fonts.bodyRegular,
              fontSize: 13,
              color: colors.textSecondary,
              marginBottom: 6,
            }}
          >
            {challenge.title}
          </Text>
          <Text
            style={{
              fontFamily: fonts.bodyMedium,
              fontSize: 20,
              lineHeight: 25,
              color: colors.textPrimary,
            }}
          >
            {challenge.dailyAction}
          </Text>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}
          >
            {doneAvatars.length > 0 ? (
              <AvatarStack
                people={doneAvatars}
                max={3}
                size={22}
                surface={colors.bgSurface}
                plain
              />
            ) : null}
            <Text
              style={{
                fontFamily: fonts.bodyRegular,
                fontSize: 15,
                color: colors.textSecondary,
                fontVariant: ['tabular-nums'],
              }}
            >
              {done}/{total} tamamladı
            </Text>
          </View>
        </View>

        <ProgressRing
          totalDays={challenge.totalDays}
          days={challenge.days}
          size="M"
          activeIndex={challenge.currentDay - 1}
          centerContent={
            <Text
              style={{
                fontFamily: fonts.displaySemibold,
                fontSize: 15,
                color: colors.textPrimary,
                fontVariant: ['tabular-nums'],
              }}
            >
              {challenge.currentDay}/{challenge.totalDays}
            </Text>
          }
        />
      </View>

      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          onCheckIn();
        }}
        style={({ pressed }) => ({
          height: 56,
          borderRadius: radius.pill,
          backgroundColor: colors.ember,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale: pressed ? 0.985 : 1 }],
        })}
      >
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 17, color: colors.bgBase }}>
          Check-in
        </Text>
      </Pressable>
    </Pressable>
  );
}

/** E2 — calm, shrunken card once today is done. No time shown (per spec). */
export function CompletedCard({
  challenge,
  onPress,
}: {
  challenge: Challenge;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        backgroundColor: colors.bgSurface,
        borderRadius: radius.card,
        borderWidth: hairline,
        borderColor: colors.strokeSubtle,
        paddingVertical: 16,
        paddingHorizontal: 20,
        opacity: pressed ? 0.7 : 0.8,
      })}
    >
      <View style={{ opacity: 0.75 }}>
        <ProgressRing
          totalDays={challenge.totalDays}
          days={challenge.days}
          size="S"
          diameter={44}
          strokeWidth={3.5}
        />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.textPrimary }}>
          {challenge.title}
        </Text>
        <Text
          style={{
            fontFamily: fonts.bodyRegular,
            fontSize: 13,
            color: colors.textSecondary,
            marginTop: 2,
            fontVariant: ['tabular-nums'],
          }}
        >
          <Text style={{ color: colors.ember }}>✓</Text> Tamamlandı · Gün{' '}
          {challenge.currentDay}/{challenge.totalDays}
        </Text>
      </View>
    </Pressable>
  );
}

/** E2 — faint "starts tomorrow" row. */
export function UpcomingRow({
  challenge,
  onPress,
}: {
  challenge: Challenge;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 6,
        opacity: pressed ? 0.4 : 0.55,
      })}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.waiting,
        }}
      />
      <Text style={{ fontFamily: fonts.bodyRegular, fontSize: 15, color: colors.textSecondary }}>
        {challenge.title}
        <Text style={{ fontSize: 13, color: colors.textTertiary }}>
          {'  ·  '}
          {challenge.startsWhen}
          {'  ·  '}
          {challenge.participants.length} kişi hazır
        </Text>
      </Text>
    </Pressable>
  );
}
