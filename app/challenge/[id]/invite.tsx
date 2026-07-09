import { useEffect, useState } from 'react';
import { Pressable, Share, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colors, fonts, hairline, radius, spacing, type } from '@/theme/tokens';
import { useChallenge, INVITE_JOINERS } from '@/hooks';
import { AppText, Avatar, Button, IconButton, Screen } from '@/components/ui';
import { ProgressRing } from '@/components/ProgressRing';
import { StakeBadge } from '@/components/StakeBadge';

export default function InviteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const challenge = useChallenge(id);
  const [joined, setJoined] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (joined >= INVITE_JOINERS.length) return;
    const t = setTimeout(() => setJoined((n) => n + 1), 3000);
    return () => clearTimeout(t);
  }, [joined]);

  if (!challenge) return null;
  const link = `thechallenge.app/j/${challenge.inviteCode}`;

  const share = () => {
    Share.share({ message: `"${challenge.title}" challenge'ına katıl: ${link}` }).catch(() => {});
  };

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
        Challenge {challenge.startsWhen}'da başlıyor.
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
        <Button label="Daveti paylaş" onPress={share} icon={<Feather name="share" size={18} color={colors.bgBase} />} />
      </View>

      {/* copy row */}
      <Pressable
        onPress={() => setCopied(true)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: colors.bgSurface,
          borderRadius: radius.badge,
          borderWidth: hairline,
          borderColor: colors.strokeSubtle,
          paddingHorizontal: 16,
          height: 50,
          marginTop: 12,
        }}
      >
        <AppText variant="secondary" color={colors.textSecondary}>
          {link}
        </AppText>
        <AppText variant="secondary" color={colors.ember} style={{ fontFamily: type.bodyMedium.fontFamily }}>
          {copied ? 'Kopyalandı ✓' : 'Kopyala'}
        </AppText>
      </Pressable>

      {/* live joiners */}
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
    </Screen>
  );
}
