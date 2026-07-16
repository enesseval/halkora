import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colors, fonts, hairline, radius, spacing } from '@/theme/tokens';
import { useChallenge, useChallengesQuery, INVITE_JOINERS } from '@/hooks';
import type { Challenge, Participant } from '@/hooks';
import { isSupabaseConfigured } from '@/lib/supabase';
import { errMessage } from '@/lib/errors';
import { useAuth } from '@/hooks/useAuth';
import { findUserByUsername, sendInvite, isDuplicateInviteError } from '@/data/invites';
import { AppText, Avatar, Button, IconButton, Screen } from '@/components/ui';
import { ProgressRing } from '@/components/ProgressRing';
import { StakeBadge } from '@/components/StakeBadge';
import { InviteShare } from '@/components/InviteShare';
import { RingScreenSkeleton } from '@/components/Skeleton';
import { ErrorState } from '@/components/ErrorState';
import { useT } from '@/i18n';

export default function InviteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useT();
  const challenge = useChallenge(id);
  const { loading, firstLoadError, error, refetch } = useChallengesQuery();
  // The animated INVITE_JOINERS list is a Phase-1 demo-only flourish — a real
  // challenge shows its actual participants (already polled in by
  // useChallengesQuery above), never fake people "joining" live.
  const [joined, setJoined] = useState(0);

  useEffect(() => {
    if (isSupabaseConfigured || joined >= INVITE_JOINERS().length) return;
    const timer = setTimeout(() => setJoined((n) => n + 1), 3000);
    return () => clearTimeout(timer);
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
          <ErrorState message={t.detail.loadFailed} detail={errMessage(error)} onRetry={refetch} />
        ) : (
          <ErrorState message={t.detail.notFound} />
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
        {t.invite.heading}
      </AppText>
      <AppText variant="secondary" style={{ marginTop: 8 }}>
        {t.invite.startsWhen(challenge.startsWhen)}
      </AppText>

      {/* summary card */}
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          router.replace(`/challenge/${challenge.id}`);
        }}
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
        {challenge.joinClosed ? (
          <AppText variant="secondary" color={colors.textTertiary} style={{ textAlign: 'center' }}>
            {t.invite.joinClosed}
          </AppText>
        ) : (
          <>
            <InviteShare inviteCode={challenge.inviteCode} title={challenge.title} />
            {/* Real-mode only: no username system in mock mode (Ek O). Same
                reason it's hidden when joinClosed — sending one would only
                point the recipient at a join flow that's about to reject
                them. */}
            {isSupabaseConfigured ? <InviteByHandle challenge={challenge} /> : null}
          </>
        )}
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

/** Real-mode only (Ek O) — resolve an exact @handle and send an invite row;
 * the recipient still goes through the normal join_challenge_by_code flow
 * themselves (via the notification's deep link), so this can never bypass
 * the join window or add someone without their own action. */
function InviteByHandle({ challenge }: { challenge: Challenge }) {
  const { t } = useT();
  const { session } = useAuth();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const submit = async () => {
    const handle = input.trim().toLowerCase();
    if (!handle || sending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSending(true);
    setStatus(null);
    try {
      const found = await findUserByUsername(handle);
      if (!found) {
        setStatus({ kind: 'error', text: t.invite.handleNotFound });
        return;
      }
      if (found.id === session?.user.id) {
        setStatus({ kind: 'error', text: t.invite.handleIsYou });
        return;
      }
      if (challenge.participants.some((p) => p.id === found.id)) {
        setStatus({ kind: 'error', text: t.invite.handleAlreadyMember });
        return;
      }
      await sendInvite(challenge.id, found.id);
      setStatus({ kind: 'success', text: t.invite.byHandleSent(found.name ?? `@${found.username}`) });
      setInput('');
    } catch (e) {
      setStatus({
        kind: 'error',
        text: isDuplicateInviteError(e) ? t.invite.handleAlreadyInvited : errMessage(e),
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={{ marginTop: 16 }}>
      <AppText variant="meta" color={colors.textTertiary} style={{ marginBottom: 8 }}>
        {t.invite.byHandleTitle}
      </AppText>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          backgroundColor: colors.bgElevated,
          borderRadius: radius.pill,
          borderWidth: hairline,
          borderColor: status?.kind === 'error' ? colors.joker : colors.strokeSubtle,
          paddingHorizontal: 16,
          height: 52,
        }}
      >
        <AppText style={{ fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.textTertiary }}>
          @
        </AppText>
        <TextInput
          value={input}
          onChangeText={(raw) => setInput(raw.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))}
          placeholder={t.invite.byHandlePlaceholder}
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="send"
          onSubmitEditing={submit}
          style={{ flex: 1, color: colors.textPrimary, fontFamily: fonts.bodyMedium, fontSize: 15 }}
        />
      </View>
      <View style={{ marginTop: 10 }}>
        <Button
          label={sending ? t.invite.byHandleSending : t.invite.byHandleSend}
          variant="secondary"
          onPress={submit}
          disabled={!input.trim() || sending}
        />
      </View>
      {status ? (
        <AppText
          variant="meta"
          color={status.kind === 'error' ? colors.joker : colors.ember}
          style={{ marginTop: 8, textAlign: 'center' }}
        >
          {status.text}
        </AppText>
      ) : null}
    </View>
  );
}

/** Real mode: the challenge's actual participants (excluding the owner/self),
 * kept live by useChallengesQuery's polling — never fake people. */
function RealJoiners({ participants }: { participants: Participant[] }) {
  const { t } = useT();
  const others = participants.filter((p) => !p.isMe);
  return (
    <>
      <AppText
        variant="meta"
        color={colors.textTertiary}
        tabular
        style={{ textTransform: 'uppercase', letterSpacing: 1.2, marginTop: spacing.section, marginBottom: 8 }}
      >
        {t.invite.participantsCount(others.length)}
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
            {t.invite.linkOpen}
          </AppText>
        </View>
      </View>
    </>
  );
}

/** Phase-1 demo-only: animates in a few fake names so the empty screen isn't blank. */
function MockJoiners({ joined }: { joined: number }) {
  const { t } = useT();
  const joiners = INVITE_JOINERS();
  return (
    <>
      <AppText
        variant="meta"
        color={colors.textTertiary}
        tabular
        style={{ textTransform: 'uppercase', letterSpacing: 1.2, marginTop: spacing.section, marginBottom: 8 }}
      >
        {t.invite.participantsCount(joined)}
      </AppText>
      <View>
        {joiners.slice(0, joined).map((j, i) => (
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
              {i === 0 ? t.invite.justNow : t.invite.minutesAgo(i * 2)}
            </AppText>
          </Animated.View>
        ))}
        {joined < joiners.length ? (
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
              {t.invite.linkOpen}
            </AppText>
          </View>
        ) : null}
      </View>
    </>
  );
}
