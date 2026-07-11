import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colors, fonts, hairline, radius, spacing } from '@/theme/tokens';
import { useChallenge, useChallengesQuery, INVITE_JOINERS } from '@/hooks';
import type { Participant } from '@/hooks';
import { isSupabaseConfigured } from '@/lib/supabase';
import { errMessage } from '@/lib/errors';
import { AppText, Avatar, IconButton, Screen } from '@/components/ui';
import { ProgressRing } from '@/components/ProgressRing';
import { StakeBadge } from '@/components/StakeBadge';
import { InviteShare } from '@/components/InviteShare';
import { RingScreenSkeleton } from '@/components/Skeleton';
import { ErrorState } from '@/components/ErrorState';

export default function InviteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const challenge = useChallenge(id);
  const { loading, firstLoadError, error, refetch } = useChallengesQuery();
  // The animated INVITE_JOINERS list is a Phase-1 demo-only flourish — a real
  // challenge shows its actual participants (already polled in by
  // useChallengesQuery above), never fake people "joining" live.
  const [joined, setJoined] = useState(0);

  useEffect(() => {
    if (isSupabaseConfigured || joined >= INVITE_JOINERS.length) return;
    const t = setTimeout(() => setJoined((n) => n + 1), 3000);
    return () => clearTimeout(t);
  }, [joined]);

  if (!challenge) {
    // Normally already cached from the create flow that landed here — this
    // only matters for a stale/deep link opened before that data exists.
    return (
      <Screen edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', paddingVertical: 8 }}>
          <IconButton size={38} onPress={() => router.replace('/')}>
            <Feather name="x" size={18} color={colors.textPrimary} />
          </IconButton>
        </View>
        {loading ? (
          <RingScreenSkeleton />
        ) : firstLoadError ? (
          <ErrorState message="Challenge yüklenemedi." detail={errMessage(error)} onRetry={refetch} />
        ) : (
          <ErrorState message="Challenge bulunamadı." />
        )}
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', paddingVertical: 8 }}>
        <IconButton size={38} onPress={() => router.replace('/')}>
          <Feather name="x" size={18} color={colors.textPrimary} />
        </IconButton>
      </View>

      <AppText variant="screenTitle" style={{ marginTop: 8 }}>
        Hazır. Şimdi grubunu çağır.
      </AppText>
      <AppText variant="secondary" style={{ marginTop: 8 }}>
        Challenge {challenge.startsWhen}.
      </AppText>

      {/* summary card */}
      <Pressable
        onPress={() => router.replace(`/challenge/${challenge.id}`)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          backgroundColor: colors.bgSurface,
          borderRadius: radius.card,
          borderWidth: hairline,
          borderColor: colors.strokeSubtle,
          padding: 16,
          marginTop: 24,
        }}
      >
        <ProgressRing
          totalDays={challenge.totalDays}
          days={challenge.days}
          size="M"
          centerContent={
            <AppText tabular style={{ fontFamily: fonts.displaySemibold, fontSize: 15, color: colors.textPrimary }}>
              {challenge.totalDays}
            </AppText>
          }
        />
        <View style={{ flex: 1, gap: 6 }}>
          <AppText variant="bodyMedium">{challenge.title}</AppText>
          <AppText variant="meta" color={colors.textTertiary}>
            {challenge.scheduleSummary}
          </AppText>
          {challenge.stake ? <StakeBadge text={challenge.stake.text} /> : null}
        </View>
      </Pressable>

      <View style={{ marginTop: 24 }}>
        <InviteShare inviteCode={challenge.inviteCode} title={challenge.title} />
      </View>

      {/* live joiners */}
      {isSupabaseConfigured ? (
        <RealJoiners participants={challenge.participants} />
      ) : (
        <MockJoiners joined={joined} />
      )}
    </Screen>
  );
}

/** Real mode: the challenge's actual participants (excluding the owner/self),
 * kept live by useChallengesQuery's polling — never fake people. */
function RealJoiners({ participants }: { participants: Participant[] }) {
  const others = participants.filter((p) => !p.isMe);
  return (
    <>
      <AppText
        variant="meta"
        color={colors.textTertiary}
        tabular
        style={{ textTransform: 'uppercase', letterSpacing: 1.2, marginTop: spacing.section, marginBottom: 8 }}
      >
        Katılanlar · {others.length}
      </AppText>
      <View>
        {others.map((p) => (
          <View
            key={p.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 10,
              borderBottomWidth: hairline,
              borderBottomColor: colors.strokeSubtle,
            }}
          >
            <Avatar initials={p.initials} size={32} tint />
            <AppText variant="bodyMedium" style={{ flex: 1 }}>
              {p.name} <AppText color={colors.ember}>✓</AppText>
            </AppText>
          </View>
        ))}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              borderWidth: hairline,
              borderColor: colors.strokeSubtle,
            }}
          />
          <AppText variant="secondary" color={colors.textTertiary}>
            Davet linki açık...
          </AppText>
        </View>
      </View>
    </>
  );
}

/** Phase-1 demo-only: animates in a few fake names so the empty screen isn't blank. */
function MockJoiners({ joined }: { joined: number }) {
  return (
    <>
      <AppText
        variant="meta"
        color={colors.textTertiary}
        tabular
        style={{ textTransform: 'uppercase', letterSpacing: 1.2, marginTop: spacing.section, marginBottom: 8 }}
      >
        Katılanlar · {joined}
      </AppText>
      <View>
        {INVITE_JOINERS.slice(0, joined).map((j, i) => (
          <Animated.View
            key={j.id}
            entering={FadeIn.duration(300)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 10,
              borderBottomWidth: hairline,
              borderBottomColor: colors.strokeSubtle,
            }}
          >
            <Avatar initials={j.initials} size={32} tint />
            <AppText variant="bodyMedium" style={{ flex: 1 }}>
              {j.name} <AppText color={colors.ember}>✓</AppText>
            </AppText>
            <AppText variant="meta" color={colors.textTertiary}>
              {i === 0 ? 'az önce' : `${i * 2} dk`}
            </AppText>
          </Animated.View>
        ))}
        {joined < INVITE_JOINERS.length ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                borderWidth: hairline,
                borderColor: colors.strokeSubtle,
              }}
            />
            <AppText variant="secondary" color={colors.textTertiary}>
              Davet linki açık...
            </AppText>
          </View>
        ) : null}
      </View>
    </>
  );
}
