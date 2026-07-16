import { useState } from 'react';
import { KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { colors, fonts, hairline, radius, spacing, type } from '@/theme/tokens';
import { useJoinPreview, useJoin } from '@/hooks';
import { useAuth } from '@/hooks/useAuth';
import { errMessage } from '@/lib/errors';
import { AppText, AvatarStack, Button, IconButton, Screen } from '@/components/ui';
import { ProgressRing } from '@/components/ProgressRing';
import { StakeBadge } from '@/components/StakeBadge';
import { CardSkeleton } from '@/components/Skeleton';
import { ErrorState } from '@/components/ErrorState';
import { useT } from '@/i18n';

export default function JoinScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { t } = useT();
  const preview = useJoinPreview(code);
  const join = useJoin();
  const { configured, name: myName } = useAuth();
  // Real (Supabase) flow: the viewer already has an account + name from
  // onboarding — asking again here would be a redundant re-prompt. Only the
  // Phase-1 mock join (no backend) still needs a name typed on the spot.
  const [name, setName] = useState('');
  const [joining, setJoining] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // This screen can be reached with no back stack (cold-started deep link),
  // so router.back() alone can leave the user stranded — fall back to Home.
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const closeButton = (
    <View style={{ paddingTop: 6 }}>
      <IconButton size={38} onPress={goBack}>
        <Feather name="x" size={18} color={colors.textPrimary} />
      </IconButton>
    </View>
  );

  const people = preview.participants.map((p) => ({ id: p.id, initials: p.initials }));

  const submit = async () => {
    if (joining || preview.notFound || preview.joinClosed) return;
    setJoining(true);
    setErr(null);
    try {
      const id = await join(code ?? '', name.trim());
      router.replace(`/challenge/${id}`);
    } catch (e) {
      setErr(errMessage(e) || t.errors.messageFailedGeneric);
      setJoining(false);
    }
  };

  if (preview.loading) {
    return (
      <Screen edges={['top', 'bottom']}>
        {closeButton}
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <CardSkeleton />
        </View>
      </Screen>
    );
  }

  if (preview.isError) {
    return (
      <Screen edges={['top', 'bottom']}>
        {closeButton}
        <ErrorState
          message={t.join.loadFailed}
          detail={errMessage(preview.error)}
          onRetry={preview.retry}
        />
      </Screen>
    );
  }

  if (preview.notFound) {
    return (
      <Screen edges={['top', 'bottom']}>
        {closeButton}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <AppText variant="screenTitle" style={{ fontSize: 22, textAlign: 'center' }}>
            {t.join.notFoundTitle}
          </AppText>
          <AppText variant="secondary" color={colors.textSecondary} style={{ textAlign: 'center' }}>
            {t.join.notFoundSubtitle}
          </AppText>
        </View>
      </Screen>
    );
  }

  if (preview.joinClosed) {
    return (
      <Screen edges={['top', 'bottom']}>
        {closeButton}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <AppText variant="screenTitle" style={{ fontSize: 22, textAlign: 'center' }}>
            {t.join.closedTitle}
          </AppText>
          <AppText variant="secondary" color={colors.textSecondary} style={{ textAlign: 'center' }}>
            {t.join.closedSubtitle(preview.title)}
          </AppText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {closeButton}
      <AppText variant="meta" color={colors.textTertiary} style={{ textAlign: 'center', marginTop: 12 }}>
        {t.join.subtitle}
      </AppText>

      <View style={{ flex: 1, justifyContent: 'center' }}>
        {/* preview card */}
        <View
          style={{
            backgroundColor: colors.bgSurface,
            borderRadius: radius.card,
            borderWidth: hairline,
            borderColor: colors.strokeSubtle,
            padding: spacing.cardPad,
            alignItems: 'center',
            gap: 14,
          }}
        >
          <ProgressRing
            totalDays={preview.totalDays}
            days={[]}
            size="M"
            centerContent={
              <AppText tabular style={{ fontFamily: fonts.displaySemibold, fontSize: 15, color: colors.textPrimary }}>
                {preview.totalDays}
              </AppText>
            }
          />
          <AppText variant="screenTitle" style={{ fontSize: 24, textAlign: 'center' }}>
            {preview.title}
          </AppText>
          <AppText variant="secondary" style={{ textAlign: 'center' }}>
            {preview.scheduleSummary} · {preview.startsWhen}
          </AppText>
          {preview.stakeText ? <StakeBadge text={preview.stakeText} /> : null}
        </View>

        {/* social proof */}
        {people.length > 0 ? (
          <View style={{ alignItems: 'center', marginTop: 24, gap: 10 }}>
            <AvatarStack people={people} max={4} size={30} />
            <AppText variant="secondary" color={colors.textSecondary} tabular>
              {t.join.socialProof(
                preview.participants
                  .slice(0, 2)
                  .map((p) => p.name.split(' ')[0])
                  .join(', '),
                Math.max(preview.participants.length - 2, 0),
              )}
            </AppText>
          </View>
        ) : null}
      </View>

      {/* join */}
      <View style={{ gap: 12, paddingBottom: spacing.section }}>
        {configured ? (
          <AppText variant="secondary" color={colors.textSecondary} style={{ textAlign: 'center' }}>
            {t.join.joiningAs(myName ?? t.join.youFallback)}
          </AppText>
        ) : (
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t.join.namePlaceholder}
            placeholderTextColor={colors.textTertiary}
            style={{
              height: 54,
              backgroundColor: colors.bgSurface,
              borderRadius: radius.badge,
              borderWidth: hairline,
              borderColor: name ? colors.ember : colors.strokeSubtle,
              paddingHorizontal: 16,
              color: colors.textPrimary,
              fontFamily: type.bodyMedium.fontFamily,
              fontSize: 17,
              textAlign: 'center',
            }}
          />
        )}
        {err ? (
          <AppText variant="meta" color={colors.joker} style={{ textAlign: 'center' }}>
            {err}
          </AppText>
        ) : null}
        <Button label={joining ? t.join.joining : t.join.joinCta} onPress={submit} disabled={joining} />
      </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
