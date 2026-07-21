import { useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Feather } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { colors, hairline, radius, spacing } from '@/theme/tokens';
import { useMomentumDemo, ME_NAME, ME_INITIALS } from '@/hooks';
import { useAuth, initialsFrom } from '@/hooks/useAuth';
import { friendlyErrorMessage } from '@/lib/errors';
import { AppText, Avatar, IconButton, Screen, SectionLabel } from '@/components/ui';
import { NameSheet, UsernameSheet } from '@/components/Sheets';
import { useT, type Locale } from '@/i18n';

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
      onPress={
        onPress
          ? () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onPress();
            }
          : undefined
      }
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
      {/* Only a row with a real action looks tappable — otherwise the chevron
       * promises an interaction that never happens. */}
      {onPress ? <Feather name="chevron-right" size={18} color={colors.textTertiary} /> : null}
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
  const { t, locale, setLocale } = useT();
  const { open } = useMomentumDemo();
  const {
    configured,
    session,
    name,
    username,
    isAnonymous,
    isPro,
    linkAppleIdentity,
    saveName,
    saveUsername,
    signOut,
    deleteAccount,
    resetOnboarding,
    setProDev,
  } = useAuth();
  const debugUserId = session?.user.id.slice(0, 8);
  const [linking, setLinking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const notifGranted = useNotificationStatus();

  const displayName = name ?? ME_NAME;
  const displayInitials = name ? initialsFrom(name) : ME_INITIALS;

  const secureAccount = async () => {
    if (linking) return;
    setLinking(true);
    try {
      await linkAppleIdentity();
    } catch (e) {
      Alert.alert(t.errors.linkFailed, friendlyErrorMessage(e));
    } finally {
      setLinking(false);
    }
  };

  const changeLanguage = (l: Locale) => {
    if (l === locale) return;
    // Applies instantly; useSyncLocale() (mounted in the root layout) picks
    // up this change and syncs profiles.locale in the background.
    setLocale(l);
  };

  const pickLanguage = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Alert.alert(t.settings.language, undefined, [
      { text: t.settings.languageTurkish, onPress: () => changeLanguage('tr') },
      { text: t.settings.languageEnglish, onPress: () => changeLanguage('en') },
      { text: t.common.cancel, style: 'cancel' },
    ]);
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
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
      Alert.alert(t.errors.deleteFailed, friendlyErrorMessage(e));
      setDeleting(false);
    }
  };

  const confirmDelete = () => {
    if (deleting) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Alert.alert(t.settings.deleteConfirmTitle, t.settings.deleteConfirmBody, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.settings.deleteAccount, style: 'destructive', onPress: runDelete },
    ]);
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
        <IconButton size={38} onPress={() => router.back()}>
          <Feather name="chevron-left" size={20} color={colors.textPrimary} />
        </IconButton>
        <AppText variant="screenTitle">{t.settings.title}</AppText>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.section }}>
        {/* profile — informational only, no edit action yet */}
        <View
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
        </View>

        {/* Halkora Pro — always reachable (a door, not a nag). Free: ember-
            tinted, opens the paywall. Pro: neutral, shows "Aktif". */}
        {configured ? (
          <View style={{ marginTop: 20 }}>
            <Group>
              <Row
                icon="zap"
                label={t.pro.title}
                value={isPro ? t.pro.settingsSubActive : undefined}
                tint={isPro ? undefined : colors.ember}
                onPress={isPro ? undefined : () => router.push('/paywall?reason=generic')}
              />
            </Group>
          </View>
        ) : null}

        <View style={{ marginTop: 20 }}>
          <Group>
            <Row
              icon="user"
              label={t.settings.name}
              value={displayName}
              onPress={configured ? () => setEditingName(true) : undefined}
            />
            <Divider />
            <Row
              icon="bell"
              label={t.settings.notifications}
              value={notifGranted === null ? '' : notifGranted ? t.settings.notificationsOn : t.settings.notificationsOff}
              onPress={() => Linking.openSettings().catch(() => {})}
            />
            {configured ? (
              <>
                <Divider />
                <Row
                  icon="key"
                  label={t.settings.account}
                  value={linking ? t.settings.accountLinking : isAnonymous ? t.settings.accountUnsecured : t.settings.accountLinked}
                  tint={isAnonymous ? colors.ember : undefined}
                  onPress={isAnonymous ? secureAccount : undefined}
                />
                <Divider />
                <Row
                  icon="at-sign"
                  label={t.settings.username}
                  value={username ? `@${username}` : t.settings.usernameNotSet}
                  onPress={() => setEditingUsername(true)}
                />
              </>
            ) : null}
            <Divider />
            <Row
              icon="globe"
              label={t.settings.language}
              value={locale === 'tr' ? t.settings.languageTurkish : t.settings.languageEnglish}
              onPress={pickLanguage}
            />
            <Divider />
            <Row icon="rotate-ccw" label={t.settings.seeOnboardingAgain} onPress={goOnboarding} />
          </Group>
        </View>

        {/* demo entries — mock-only, never shown against a real backend */}
        {!configured ? (
          <View style={{ marginTop: 24 }}>
            <SectionLabel>{t.settings.demo}</SectionLabel>
            <View style={{ marginTop: 10 }}>
              <Group>
                <Row
                  icon="trending-down"
                  label={t.settings.demoMomentum}
                  onPress={() => {
                    open('c1');
                    router.push('/challenge/c1');
                  }}
                />
                <Divider />
                <Row
                  icon="flag"
                  label={t.settings.demoComplete}
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
            {t.settings.logout}
          </AppText>
        </Pressable>

        {configured ? (
          <Pressable
            onPress={confirmDelete}
            disabled={deleting}
            style={({ pressed }) => ({ alignItems: 'center', paddingBottom: 22, opacity: pressed || deleting ? 0.6 : 1 })}
          >
            <AppText variant="secondary" color={colors.joker}>
              {deleting ? t.settings.deleting : t.settings.deleteAccount}
            </AppText>
          </Pressable>
        ) : null}

        {/* TEMPORARY (remove before public release / once Faz B's is_pro
            hardening — docs/db-pro.sql §3 — is applied): flip is_pro before
            RevenueCat exists, and show the raw stored value + short user id
            so "is_pro=true'ye çevirdim ama görünmüyor" is self-diagnosable
            (compare against `select id, is_pro from profiles;`) instead of
            guessing. Deliberately NOT gated behind __DEV__ — that hid this
            entirely in a Release/TestFlight-style build, which is exactly
            the build most on-device testing happens in right now. */}
        {configured ? (
          <View style={{ marginBottom: 24 }}>
            <SectionLabel>DEV</SectionLabel>
            <View style={{ marginTop: 10 }}>
              <Group>
                <Row
                  icon="zap"
                  label={t.pro.devToggle}
                  value={isPro ? 'Pro' : 'Free'}
                  tint={isPro ? colors.ember : undefined}
                  onPress={() => {
                    void setProDev(!isPro);
                  }}
                />
              </Group>
            </View>
            <AppText variant="meta" color={colors.textTertiary} style={{ marginTop: 8 }} tabular>
              uid: {debugUserId ?? '—'} · is_pro: {String(isPro)}
            </AppText>
          </View>
        ) : null}

        <AppText variant="meta" color={colors.textTertiary} tabular style={{ textAlign: 'center' }}>
          {t.settings.version(Constants.expoConfig?.version ?? '—')}
        </AppText>
      </ScrollView>

      <UsernameSheet
        visible={editingUsername}
        current={username}
        onClose={() => setEditingUsername(false)}
        onSave={saveUsername}
      />

      <NameSheet
        visible={editingName}
        current={displayName}
        onClose={() => setEditingName(false)}
        onSave={saveName}
      />
    </Screen>
  );
}

function Divider() {
  return <View style={{ height: hairline, backgroundColor: colors.strokeSubtle, marginLeft: 48 }} />;
}
