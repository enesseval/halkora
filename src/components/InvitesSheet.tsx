import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Modal, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { colors, fonts, hairline, radius, spacing } from '@/theme/tokens';
import { useLayout } from '@/theme/layout';
import { isSupabaseConfigured } from '@/lib/supabase';
import { dismissInvite, fetchReceivedInvites, type ReceivedInvite } from '@/data/invites';
import { friendlyErrorMessage } from '@/lib/errors';
import { useT } from '@/i18n';
import { AppText } from './ui';

/**
 * Invites waiting for you.
 *
 * This exists because a push was the only way anyone learned they'd been
 * invited, and a push is a single fragile channel — permission off, phone
 * offline, notification swiped away, or the webhook never wired up, and the
 * invite was gone with no trace anywhere in the app. Now the notification is
 * the nudge and this is the record.
 */
export const RECEIVED_INVITES_KEY = ['invites', 'received'] as const;

export function useReceivedInvites(): { invites: ReceivedInvite[]; reload: () => void } {
  const queryClient = useQueryClient();
  // Fetched once on mount before this, which meant a push could land, be
  // tapped, be dismissed — and the bell still wouldn't be there until the app
  // was killed and reopened. It also meant an invite you'd just accepted kept
  // its place in the list. The same poll and the same focus behaviour the
  // challenge list already gets fixes both without inventing a mechanism.
  const { data } = useQuery({
    queryKey: RECEIVED_INVITES_KEY,
    queryFn: fetchReceivedInvites,
    enabled: isSupabaseConfigured,
    refetchInterval: isSupabaseConfigured ? 60_000 : false,
    // An unreachable invite list must never interrupt Home; the bell simply
    // doesn't appear, and the next poll tries again.
    retry: 1,
  });

  const reload = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: RECEIVED_INVITES_KEY });
  }, [queryClient]);

  return { invites: data ?? [], reload };
}

export function InvitesSheet({
  invites,
  onClose,
  onChanged,
}: {
  invites: ReceivedInvite[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useT();
  const { sideGutter } = useLayout();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const open = (invite: ReceivedInvite) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onClose();
    // The join preview, the same screen a link lands on — one place decides
    // whether someone can actually join, rather than two.
    router.push(`/join/${invite.inviteCode}`);
  };

  const decline = async (invite: ReceivedInvite) => {
    setBusy(invite.id);
    try {
      await dismissInvite(invite.id);
      onChanged();
    } catch (e) {
      Alert.alert(t.invites.declineFailed, friendlyErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(180)} style={{ flex: 1, backgroundColor: colors.scrim }}>
        <View style={[{ flex: 1, justifyContent: 'flex-end' }, sideGutter > 0 ? { paddingHorizontal: sideGutter } : null]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} />

          <Animated.View
            entering={SlideInDown.duration(260)}
            style={{
              backgroundColor: colors.bgSurface,
              borderTopLeftRadius: radius.sheet,
              borderTopRightRadius: radius.sheet,
              borderWidth: hairline,
              borderColor: colors.strokeSubtle,
              paddingHorizontal: spacing.screenX,
              paddingTop: 12,
              paddingBottom: 36,
              maxHeight: '75%',
            }}
          >
            <View
              style={{
                alignSelf: 'center',
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.strokeSubtle,
                marginBottom: 20,
              }}
            />
            <AppText variant="screenTitle" style={{ fontSize: 22 }}>
              {t.invites.title}
            </AppText>

            {invites.length === 0 ? (
              <AppText variant="meta" color={colors.textTertiary} style={{ marginTop: 14 }}>
                {t.invites.empty}
              </AppText>
            ) : null}

            <ScrollView style={{ marginTop: 14 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 10 }}>
                {invites.map((invite) => (
                  <Pressable
                    key={invite.id}
                    onPress={() => open(invite)}
                    style={({ pressed }) => ({
                      backgroundColor: colors.bgElevated,
                      borderRadius: radius.card,
                      borderWidth: hairline,
                      borderColor: colors.strokeSubtle,
                      padding: 16,
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <AppText variant="meta" color={colors.ember}>
                      {invite.kind === 'rematch'
                        ? t.invites.rematchFrom(invite.fromName)
                        : t.invites.inviteFrom(invite.fromName)}
                    </AppText>
                    <AppText
                      numberOfLines={1}
                      style={{
                        fontFamily: fonts.displaySemibold,
                        fontSize: 17,
                        color: colors.textPrimary,
                        marginTop: 4,
                      }}
                    >
                      {invite.title}
                    </AppText>
                    <AppText variant="meta" color={colors.textTertiary} style={{ marginTop: 2 }}>
                      {invite.dailyAction} · {t.shareCard.dayCount(invite.totalDays)}
                    </AppText>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 }}>
                      <AppText variant="bodyMedium" color={colors.ember} onPress={() => open(invite)}>
                        {t.invites.view}
                      </AppText>
                      <AppText
                        variant="meta"
                        color={colors.textTertiary}
                        onPress={() => decline(invite)}
                        style={{ opacity: busy === invite.id ? 0.5 : 1 }}
                      >
                        {t.invites.decline}
                      </AppText>
                    </View>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      </Animated.View>
    </Modal>
  );
}

/** The header bell, with a count. Renders nothing when there's nothing to
 * show — an always-present empty bell is furniture, not information. */
export function InvitesBell({ count, onPress }: { count: number; onPress: () => void }) {
  if (count <= 0) return null;
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.bgSurface,
        borderWidth: hairline,
        borderColor: colors.strokeSubtle,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Feather name="bell" size={19} color={colors.textPrimary} />
      <View
        style={{
          position: 'absolute',
          top: 6,
          right: 6,
          minWidth: 16,
          height: 16,
          borderRadius: 8,
          paddingHorizontal: 4,
          backgroundColor: colors.ember,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AppText style={{ fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.bgBase }}>
          {count > 9 ? '9+' : count}
        </AppText>
      </View>
    </Pressable>
  );
}
