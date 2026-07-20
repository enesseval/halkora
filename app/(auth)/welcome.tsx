import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { colors, spacing } from '@/theme/tokens';
import { ProgressRing } from '@/components/ProgressRing';
import { AppText, Button, Screen } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { friendlyErrorMessage } from '@/lib/errors';
import { useT } from '@/i18n';
import type { SegmentState } from '@/hooks';

const LOGO_DAYS: SegmentState[] = [
  'empty', 'empty', 'done', 'done', 'done', 'done',
  'empty', 'empty', 'empty', 'empty', 'empty', 'empty',
];

export default function WelcomeScreen() {
  const router = useRouter();
  const { t } = useT();
  const { configured, signInWithApple, signInAnonymously } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    // No backend yet → keep the Phase-1 mock experience.
    if (!configured) {
      router.replace('/');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      // On success the root guard routes to onboarding (or Home).
      await fn();
    } catch (e) {
      // Surface the real reason (e.g. "Anonymous sign-ins are disabled").
      setErr(friendlyErrorMessage(e) || t.errors.signInFailed);
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ProgressRing totalDays={12} days={LOGO_DAYS} size="L" />
        <AppText variant="hero" style={{ marginTop: 32 }}>
          {t.common.appName}
        </AppText>
        <AppText
          variant="body"
          color={colors.textSecondary}
          style={{ textAlign: 'center', marginTop: 12, maxWidth: 280 }}
        >
          {t.welcome.tagline}
        </AppText>
      </View>

      <View style={{ gap: 12, paddingBottom: spacing.section }}>
        <Button
          label={t.welcome.continueWithApple}
          onPress={() => run(signInWithApple)}
          disabled={busy}
          style={{ backgroundColor: colors.textPrimary }}
          textStyle={{ color: colors.bgBase }}
          icon={<FontAwesome name="apple" size={18} color={colors.bgBase} />}
        />
        {/* Android/web (or a not-yet-configured Apple provider) fall back to
            anonymous sign-in inside signInWithApple() itself — there is no
            separate "Google" button anymore since it never actually did real
            Google OAuth, it silently signed in anonymously, which is
            misleading (docs/ROADMAP.md Faz 3A-3). This is the HONEST guest
            path instead — same anonymous sign-in, but labeled for what it is.
            Upgradeable later from Settings ("Hesabını güvenceye al"). */}
        <AppText
          variant="secondary"
          color={colors.textSecondary}
          onPress={() => run(signInAnonymously)}
          style={{ textAlign: 'center' }}
        >
          {t.welcome.continueAsGuest}
        </AppText>
        {err ? (
          <AppText variant="meta" color={colors.joker} style={{ textAlign: 'center' }}>
            {err}
          </AppText>
        ) : (
          <AppText
            variant="meta"
            color={colors.textTertiary}
            style={{ textAlign: 'center', marginTop: 8 }}
          >
            {t.welcome.terms}
          </AppText>
        )}
      </View>
    </Screen>
  );
}
