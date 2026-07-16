import { useState } from 'react';
import { Pressable, Share, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { colors, hairline, radius, type } from '@/theme/tokens';
import { useT } from '@/i18n';
import { AppText, Button } from './ui';

/** "Daveti paylaş" button + a real, working copy-link row. Used by E4 (invite) and Detail (upcoming). */
export function InviteShare({ inviteCode, title }: { inviteCode: string; title: string }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const link = `halkora.app/j/${inviteCode}`;

  const share = () => {
    Share.share({ message: t.invite.shareMessage(title, link) }).catch(() => {});
  };

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(link);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — share sheet above still works
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <Button label={t.invite.shareInvite} onPress={share} icon={<Feather name="share" size={18} color={colors.bgBase} />} />
      <Pressable
        onPress={copy}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: colors.bgSurface,
          borderRadius: radius.badge,
          borderWidth: hairline,
          borderColor: colors.strokeSubtle,
          paddingHorizontal: 16,
          height: 50,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <AppText variant="secondary" color={colors.textSecondary}>
          {link}
        </AppText>
        <AppText variant="secondary" color={colors.ember} style={{ fontFamily: type.bodyMedium.fontFamily }}>
          {copied ? t.common.copied : t.common.copy}
        </AppText>
      </Pressable>
    </View>
  );
}
