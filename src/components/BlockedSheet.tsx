import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { queryClient } from '@/lib/queryClient';
import { colors, hairline, radius, spacing } from '@/theme/tokens';
import { useLayout } from '@/theme/layout';
import { fetchBlocked, unblockUser, type BlockedPerson } from '@/data/moderation';
import { friendlyErrorMessage } from '@/lib/errors';
import { useT } from '@/i18n';
import { AppText } from './ui';

/**
 * The list of people I've blocked, and the way to undo it — Guideline 1.2
 * expects blocking to be manageable, not a one-way door.
 *
 * This one scrolls, unlike the other sheets: the list has no fixed length.
 * The cap is the screen, so it's the one place a ScrollView belongs.
 */
export function BlockedSheet({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const [people, setPeople] = useState<BlockedPerson[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const { sideGutter } = useLayout();

  useEffect(() => {
    let alive = true;
    fetchBlocked()
      .then((list) => {
        if (alive) setPeople(list);
      })
      .catch(() => {
        if (alive) setPeople([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const undo = async (person: BlockedPerson) => {
    setBusy(person.userId);
    try {
      await unblockUser(person.userId);
      setPeople((prev) => (prev ?? []).filter((p) => p.userId !== person.userId));
      // Their messages come back through the same RLS policy that hid them,
      // but only on the next fetch — without this the chat keeps showing the
      // blocked-out version until something else happens to refetch it.
      // No challenge id here (this sheet lives in Settings), so every chat
      // gets invalidated; they're small and only the open one refetches.
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    } catch (e) {
      Alert.alert(t.moderation.unblockFailed, friendlyErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View
        entering={FadeIn.duration(180)}
        style={{ flex: 1, backgroundColor: colors.scrim }}
      >
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
              maxHeight: '70%',
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
              {t.moderation.blockedTitle}
            </AppText>

            {people && people.length === 0 ? (
              <AppText variant="meta" color={colors.textTertiary} style={{ marginTop: 14 }}>
                {t.moderation.blockedEmpty}
              </AppText>
            ) : null}

            <ScrollView style={{ marginTop: 14 }} showsVerticalScrollIndicator={false}>
              {(people ?? []).map((p) => (
                <View
                  key={p.userId}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 12,
                    borderBottomWidth: hairline,
                    borderBottomColor: colors.strokeSubtle,
                  }}
                >
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <AppText variant="bodyMedium">{p.name}</AppText>
                    {p.username ? (
                      <AppText variant="meta" color={colors.textTertiary}>
                        @{p.username}
                      </AppText>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      undo(p);
                    }}
                    disabled={busy === p.userId}
                    style={({ pressed }) => ({
                      opacity: pressed || busy === p.userId ? 0.6 : 1,
                      paddingVertical: 6,
                      paddingHorizontal: 4,
                    })}
                  >
                    <AppText variant="meta" color={colors.ember}>
                      {t.moderation.unblock}
                    </AppText>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </Animated.View>
        </View>
      </Animated.View>
    </Modal>
  );
}
