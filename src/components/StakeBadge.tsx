import { View } from 'react-native';
import { colors, hairline, radius } from '@/theme/tokens';
import { useT } from '@/i18n';
import { AppText } from './ui';

export function StakeBadge({
  text,
  align = 'start',
}: {
  text: string;
  align?: 'start' | 'center';
}) {
  const { t } = useT();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: align === 'center' ? 'center' : 'flex-start',
        gap: 8,
        backgroundColor: colors.bgElevated,
        borderColor: colors.strokeSubtle,
        borderWidth: hairline,
        borderRadius: radius.pill,
        paddingVertical: 9,
        paddingHorizontal: 14,
      }}
    >
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: 9,
          backgroundColor: colors.emberSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AppText style={{ fontSize: 11 }}>🎲</AppText>
      </View>
      <AppText variant="secondary" color={colors.textSecondary}>
        {t.complete.stakeResult(text)}
      </AppText>
    </View>
  );
}
