import { Alert, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { colors, radius, spacing, type } from '@/theme/tokens';
import { AppText, Button, IconButton, Screen } from '@/components/ui';
import { useT } from '@/i18n';

/**
 * Halkora Pro paywall (Faz 4). Presented as a modal, always with a `reason`
 * so the headline is contextual — never a generic nag (ROADMAP Faz 4:
 * "limit anında bağlamsal gösterim").
 *
 * Faz A: the purchase button is a placeholder (no RevenueCat yet — that's
 * Faz B, docs "Ek R"). Tapping it just explains subscriptions are coming.
 * The whole gating flow around it (limit trigger, is_pro read, advanced-stats
 * unlock) is real and testable via the DEV Pro toggle in Settings.
 */
type Reason = 'challengeLimit' | 'advancedStats' | 'generic';

function reasonKey(raw: string | string[] | undefined): Reason {
  const r = Array.isArray(raw) ? raw[0] : raw;
  if (r === 'challengeLimit' || r === 'advancedStats') return r;
  return 'generic';
}

function FeatureRow({ label }: { label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 8,
          backgroundColor: colors.emberSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Feather name="check" size={15} color={colors.ember} />
      </View>
      <AppText variant="bodyMedium">{label}</AppText>
    </View>
  );
}

export default function Paywall() {
  const { t } = useT();
  const router = useRouter();
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const key = reasonKey(reason);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const notReady = () => {
    Alert.alert(t.pro.notReadyTitle, t.pro.notReadyBody);
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 4 }}>
        <IconButton onPress={close}>
          <Feather name="x" size={22} color={colors.textSecondary} />
        </IconButton>
      </View>

      <View style={{ flex: 1, justifyContent: 'center', gap: spacing.section }}>
        <View style={{ gap: 12 }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: radius.badge,
              backgroundColor: colors.emberSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="zap" size={26} color={colors.ember} />
          </View>
          <AppText style={type.hero}>{t.pro.headline[key]}</AppText>
          <AppText variant="secondary">{t.pro.sub[key]}</AppText>
        </View>

        <View style={{ gap: 16 }}>
          <FeatureRow label={t.pro.features.unlimited} />
          <FeatureRow label={t.pro.features.advancedStats} />
        </View>
      </View>

      <View style={{ gap: 8, paddingBottom: 8 }}>
        <Button label={t.pro.cta} onPress={notReady} />
        <Button label={t.pro.restore} variant="secondary" onPress={notReady} />
      </View>
    </Screen>
  );
}
