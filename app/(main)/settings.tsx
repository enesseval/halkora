import { useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { colors, hairline, radius, spacing } from '@/theme/tokens';
import { useMomentumDemo, ME_NAME, ME_INITIALS } from '@/hooks';
import { useAuth, initialsFrom } from '@/hooks/useAuth';
import { errMessage } from '@/lib/errors';
import { AppText, Avatar, IconButton, Screen, SectionLabel } from '@/components/ui';

/** null while the initial permission check is in flight. Push is native-only —
 * expo-notifications' web shim doesn't fully implement this, so skip there. */
function useNotificationStatus(): boolean | null {
  const [granted, setGranted] = useState<boolean | null>(null);
  useEffect(() => {
    if (Platform.OS === 'web') {
      setGranted(false);
      return;
    }
    Notifications.getPermissionsAsync()
      .then((p) => setGranted(p.status === 'granted'))
      .catch(() => setGranted(false));
  }, []);
  return granted;
}

function Row({
  icon,
  label,
  value,
  onPress,
  tint,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  tint?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 15,
        paddingHorizontal: 16,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Feather name={icon} size={18} color={tint ?? colors.textSecondary} />
      <AppText variant="bodyMedium" style={{ flex: 1 }} color={tint ?? colors.textPrimary}>
        {label}
      </AppText>
      {value ? (
        <AppText variant="secondary" color={colors.textTertiary}>
          {value}
        </AppText>
      ) : null}
      <Feather name="chevron-right" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: colors.bgSurface,
        borderRadius: radius.card,
        borderWidth: hairline,
        borderColor: colors.strokeSubtle,
        overflow: 'hidden',
      }}
    >
      {children}
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { open } = useMomentumDemo();
  const { configured, name, isAnonymous, linkAppleIdentity, signOut, deleteAccount, resetOnboarding } = useAuth();
  const [linking, setLinking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const notifGranted = useNotificationStatus();

  const displayName = name ?? ME_NAME;
  const displayInitials = name ? initialsFrom(name) : ME_INITIALS;

  const secureAccount = async () => {
    if (linking) return;
    setLinking(true);
    try {
      await linkAppleIdentity();
    } catch (e) {
      Alert.alert('Bağlanamadı', errMessage(e));
    } finally {
      setLinking(false);
    }
  };

  const goOnboarding = async () => {
    if (configured) {
      // clears the profile name -> root guard sends us back to onboarding
      await resetOnboarding();
    } else {
      router.replace('/onboarding');
    }
  };

  const logout = async () => {
    if (configured) {
      await signOut(); // guard routes to /welcome
    } else {
      router.replace('/welcome');
    }
  };

  const runDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteAccount(); // guard routes to /welcome once the session clears
    } catch (e) {
      Alert.alert('Silinemedi', errMessage(e));
      setDeleting(false);
    }
  };

  const confirmDelete = () => {
    if (deleting) return;
    Alert.alert(
      'Hesabını sil?',
      'Bu geri alınamaz. Katılımcılığın, check-in\'lerin, mesajların kalıcı olarak silinir. Kurduğun challenge\'lar grubun diğer üyeleri için kalmaya devam eder.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Hesabı sil', style: 'destructive', onPress: runDelete },
      ],
    );
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
        <IconButton size={38} onPress={() => router.back()}>
          <Feather name="chevron-left" size={20} color={colors.textPrimary} />
        </IconButton>
        <AppText variant="screenTitle">Ayarlar</AppText>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.section }}>
        {/* profile */}
        <Pressable
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            backgroundColor: colors.bgSurface,
            borderRadius: radius.card,
            borderWidth: hairline,
            borderColor: colors.strokeSubtle,
            padding: 16,
            marginTop: 12,
          }}
        >
          <Avatar initials={displayInitials} size={48} tint />
          <View style={{ flex: 1 }}>
            <AppText variant="bodyMedium" style={{ fontSize: 18 }}>
              {displayName}
            </AppText>
          </View>
          <Feather name="chevron-right" size={18} color={colors.textTertiary} />
        </Pressable>

        <View style={{ marginTop: 20 }}>
          <Group>
            <Row icon="user" label="İsim" value={displayName} />
            <Divider />
            <Row
              icon="bell"
              label="Bildirimler"
              value={notifGranted === null ? '' : notifGranted ? 'Açık' : 'Kapalı'}
              onPress={() => Linking.openSettings().catch(() => {})}
            />
            {configured ? (
              <>
                <Divider />
                <Row
                  icon="key"
                  label="Hesap"
                  value={linking ? 'Bağlanıyor…' : isAnonymous ? 'Güvence yok' : 'Apple ile bağlı'}
                  tint={isAnonymous ? colors.ember : undefined}
                  onPress={isAnonymous ? secureAccount : undefined}
                />
              </>
            ) : null}
            <Divider />
            <Row icon="rotate-ccw" label="Onboarding'i tekrar gör" onPress={goOnboarding} />
          </Group>
        </View>

        {/* demo entries — mock-only, never shown against a real backend */}
        {!configured ? (
          <View style={{ marginTop: 24 }}>
            <SectionLabel>Demo</SectionLabel>
            <View style={{ marginTop: 10 }}>
              <Group>
                <Row
                  icon="trending-down"
                  label="Momentum düşüşü (E10)"
                  onPress={() => {
                    open('c1');
                    router.push('/challenge/c1');
                  }}
                />
                <Divider />
                <Row
                  icon="flag"
                  label="Bitiş & kutlama (E9)"
                  onPress={() => router.push('/challenge/a1/complete')}
                />
              </Group>
            </View>
          </View>
        ) : null}

        {/* logout — faint, never red */}
        <Pressable
          onPress={logout}
          style={({ pressed }) => ({ alignItems: 'center', paddingVertical: 22, opacity: pressed ? 0.6 : 1 })}
        >
          <AppText variant="secondary" color={colors.textTertiary}>
            Çıkış yap
          </AppText>
        </Pressable>

        {configured ? (
          <Pressable
            onPress={confirmDelete}
            disabled={deleting}
            style={({ pressed }) => ({ alignItems: 'center', paddingBottom: 22, opacity: pressed || deleting ? 0.6 : 1 })}
          >
            <AppText variant="secondary" color={colors.joker}>
              {deleting ? 'Siliniyor…' : 'Hesabı sil'}
            </AppText>
          </Pressable>
        ) : null}

        <AppText variant="meta" color={colors.textTertiary} tabular style={{ textAlign: 'center' }}>
          Sürüm 1.0.2
        </AppText>
      </ScrollView>
    </Screen>
  );
}

function Divider() {
  return <View style={{ height: hairline, backgroundColor: colors.strokeSubtle, marginLeft: 48 }} />;
}
