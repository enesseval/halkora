import { useState } from 'react';
import { Pressable, Share, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { colors, hairline, radius, type } from '@/theme/tokens';
import { AppText, Button } from './ui';

/** "Daveti paylaş" button + a real, working copy-link row. Used by E4 (invite) and Detail (upcoming). */
export function InviteShare({ inviteCode, title }: { inviteCode: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const link = `thechallenge.app/j/${inviteCode}`;

  const share = () => {
    Share.share({ message: `"${title}" challenge'ına katıl: ${link}` }).catch(() => {});
  };

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — share sheet above still works
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <Button label="Daveti paylaş" onPress={share} icon={<Feather name="share" size={18} color={colors.bgBase} />} />
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
          {copied ? 'Kopyalandı ✓' : 'Kopyala'}
        </AppText>
      </Pressable>
    </View>
  );
}
