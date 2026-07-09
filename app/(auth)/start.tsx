import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { colors, fonts, hairline, radius, spacing } from '@/theme/tokens';
import { useAuth } from '@/hooks/useAuth';
import { extractCode } from '@/lib/invite';
import { AppText, IconButton, Screen } from '@/components/ui';

function OptionCard({
  icon,
  title,
  subtitle,
  onPress,
  emberIcon,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
  emberIcon?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        backgroundColor: colors.bgSurface,
        borderRadius: radius.card,
        borderWidth: hairline,
        borderColor: colors.strokeSubtle,
        padding: 18,
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: emberIcon ? colors.emberSoft : colors.bgElevated,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Feather name={icon} size={18} color={emberIcon ? colors.ember : colors.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText style={{ fontFamily: fonts.displaySemibold, fontSize: 17, color: colors.textPrimary }}>
          {title}
        </AppText>
        <AppText variant="meta" color={colors.textTertiary} style={{ marginTop: 3 }}>
          {subtitle}
        </AppText>
      </View>
      <Feather name="chevron-right" size={20} color={colors.textTertiary} />
    </Pressable>
  );
}

export default function StartScreen() {
  const router = useRouter();
  const { name } = useAuth();
  const first = (name ?? '').trim().split(/\s+/)[0] || 'sen';

  const [mode, setMode] = useState<'fork' | 'join'>('fork');
  const [input, setInput] = useState('');
  const [clip, setClip] = useState<string | null>(null);

  // Auto-detect an invite in the clipboard when the join view opens.
  useEffect(() => {
    if (mode !== 'join') return;
    Clipboard.getStringAsync()
      .then((v) => setClip(v))
      .catch(() => {});
  }, [mode]);

  const typedCode = extractCode(input);
  const clipCode = extractCode(clip);
  const code = typedCode ?? (!input.trim() ? clipCode : null);
  const fromClipboard = !typedCode && !!clipCode;

  const join = () => {
    if (!code) return;
    router.replace(`/join/${code}`);
  };

  if (mode === 'join') {
    return (
      <Screen edges={['top', 'bottom']}>
        {/* top bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 6, paddingBottom: 16 }}>
          <IconButton size={40} onPress={() => setMode('fork')}>
            <Feather name="chevron-left" size={20} color={colors.textPrimary} />
          </IconButton>
          <AppText
            numberOfLines={1}
            style={{ flex: 1, textAlign: 'center', fontFamily: fonts.displaySemibold, fontSize: 17, color: colors.textPrimary }}
          >
            Davetle katıl
          </AppText>
          <View style={{ width: 40 }} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.bgSurface, borderRadius: radius.pill, borderWidth: hairline, borderColor: colors.strokeSubtle, paddingHorizontal: 16, height: 52 }}>
          <Feather name="link" size={16} color={colors.textTertiary} />
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Davet linki veya kod"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            style={{ flex: 1, color: colors.textPrimary, fontFamily: fonts.bodyRegular, fontSize: 15 }}
          />
        </View>

        {code ? (
          <View
            style={{
              marginTop: 20,
              backgroundColor: colors.bgSurface,
              borderRadius: radius.card,
              borderWidth: hairline,
              borderColor: colors.ember,
              padding: 18,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Feather name="clipboard" size={14} color={colors.ember} />
              <AppText variant="meta" color={colors.ember}>
                {fromClipboard ? 'Panoda bir davet bulduk' : 'Davet hazır'}
              </AppText>
            </View>
            <AppText style={{ fontFamily: fonts.displaySemibold, fontSize: 17, color: colors.textPrimary }}>
              Kod: {code}
            </AppText>
            <AppText variant="meta" color={colors.textTertiary} style={{ marginTop: 4 }}>
              Detay ve katılımcıları bir sonraki ekranda görürsün.
            </AppText>
            <Pressable
              onPress={join}
              style={({ pressed }) => ({
                marginTop: 16,
                height: 52,
                borderRadius: radius.pill,
                backgroundColor: colors.ember,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <AppText style={{ fontFamily: fonts.bodyBold, fontSize: 17, color: colors.bgBase }}>
                Bu challenge'a katıl
              </AppText>
            </Pressable>
          </View>
        ) : null}

        <View style={{ flex: 1 }} />
        <AppText variant="meta" color={colors.textTertiary} style={{ textAlign: 'center', paddingBottom: spacing.section }}>
          Yanlış davet mi? Linki yukarıya yapıştır.
        </AppText>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <AppText variant="screenTitle" style={{ marginBottom: 28 }}>
          Güzel, {first}.{'\n'}Nasıl başlıyoruz?
        </AppText>
        <View style={{ gap: 12 }}>
          <OptionCard
            icon="plus"
            emberIcon
            title="Challenge başlat"
            subtitle="Hedefi sen koy, grubunu çağır. 2 dakika sürer."
            onPress={() => router.push('/create')}
          />
          <OptionCard
            icon="link-2"
            title="Davetle katıl"
            subtitle="Arkadaşın link mi gönderdi? Buradan gir."
            onPress={() => setMode('join')}
          />
        </View>
      </View>
      <AppText
        variant="secondary"
        color={colors.textTertiary}
        onPress={() => router.replace('/')}
        style={{ textAlign: 'center', paddingBottom: spacing.section }}
      >
        İkisini de sonra yapabilirsin — şimdilik göz at
      </AppText>
    </Screen>
  );
}
