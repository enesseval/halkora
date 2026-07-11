import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '@/theme/tokens';
import { AppText, Button } from './ui';

/**
 * Shown whenever a first load genuinely fails (no cached data to fall back
 * to) — never shows mock/stale data in its place, always tells the user
 * something went wrong and offers a way to try again.
 */
export function ErrorState({
  message = 'Veriler yüklenemedi.',
  detail,
  onRetry,
}: {
  message?: string;
  detail?: string;
  onRetry?: () => void;
}) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 32 }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 18,
          backgroundColor: colors.bgElevated,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Feather name="wifi-off" size={22} color={colors.textTertiary} />
      </View>
      <AppText variant="bodyMedium" style={{ textAlign: 'center' }}>
        {message}
      </AppText>
      {detail ? (
        <AppText variant="meta" color={colors.textTertiary} style={{ textAlign: 'center' }}>
          {detail}
        </AppText>
      ) : null}
      {onRetry ? (
        <View style={{ marginTop: 8, alignSelf: 'stretch' }}>
          <Button label="Tekrar dene" variant="secondary" onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}
