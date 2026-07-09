import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { colors, hairline, radius, spacing } from '@/theme/tokens';
import { useMomentumDemo, ME_NAME, ME_INITIALS } from '@/hooks';
import { useAuth, initialsFrom } from '@/hooks/useAuth';
import { AppText, Avatar, IconButton, Screen, SectionLabel } from '@/components/ui';

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
  const { configured, name, signOut, resetOnboarding } = useAuth();

  const displayName = name ?? ME_NAME;
  const displayInitials = name ? initialsFrom(name) : ME_INITIALS;

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
            <AppText variant="meta" color={colors.textTertiary} style={{ marginTop: 2 }}>
              selin@icloud.com
            </AppText>
          </View>
          <Feather name="chevron-right" size={18} color={colors.textTertiary} />
        </Pressable>

        <View style={{ marginTop: 20 }}>
          <Group>
            <Row icon="user" label="İsim" value={displayName} />
            <Divider />
            <Row icon="bell" label="Bildirimler" value="Akşam 20:00" />
            <Divider />
            <Row icon="key" label="Hesap" value="Apple ile" />
            <Divider />
            <Row icon="globe" label="Dil" value="Türkçe" />
          </Group>
        </View>

        {/* demo entries — reach E9 / E10 in the mock */}
        <View style={{ marginTop: 24 }}>
          <SectionLabel>Demo</SectionLabel>
          <View style={{ marginTop: 10 }}>
            <Group>
              {!configured ? (
                <>
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
                  <Divider />
                </>
              ) : null}
              <Row
                icon="rotate-ccw"
                label="Onboarding'i tekrar gör"
                tint={colors.ember}
                onPress={goOnboarding}
              />
            </Group>
          </View>
        </View>

        {/* logout — faint, never red */}
        <Pressable
          onPress={logout}
          style={({ pressed }) => ({ alignItems: 'center', paddingVertical: 22, opacity: pressed ? 0.6 : 1 })}
        >
          <AppText variant="secondary" color={colors.textTertiary}>
            Çıkış yap
          </AppText>
        </Pressable>

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
