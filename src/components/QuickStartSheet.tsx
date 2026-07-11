import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { colors, fonts, hairline, radius, spacing } from '@/theme/tokens';
import { extractCode } from '@/lib/invite';
import { AppText } from './ui';

function Row({
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
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        backgroundColor: colors.bgElevated,
        borderRadius: radius.card,
        borderWidth: hairline,
        borderColor: colors.strokeSubtle,
        padding: 16,
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: emberIcon ? colors.emberSoft : colors.bgSurface,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Feather name={icon} size={18} color={emberIcon ? colors.ember : colors.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText style={{ fontFamily: fonts.displaySemibold, fontSize: 16, color: colors.textPrimary }}>
          {title}
        </AppText>
        <AppText variant="meta" color={colors.textTertiary} style={{ marginTop: 2 }}>
          {subtitle}
        </AppText>
      </View>
      <Feather name="chevron-right" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

/** Home "+" → half-screen sheet: start a challenge, or join one by code. */
export function QuickStartSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<'choose' | 'join'>('choose');
  const [input, setInput] = useState('');
  const [clip, setClip] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setMode('choose');
      setInput('');
    }
  }, [visible]);

  useEffect(() => {
    if (mode !== 'join') return;
    Clipboard.getStringAsync()
      .then((v) => setClip(v))
      .catch(() => {});
  }, [mode]);

  if (!visible) return null;

  const typedCode = extractCode(input);
  const clipCode = extractCode(clip);
  const code = typedCode ?? (!input.trim() ? clipCode : null);
  const fromClipboard = !typedCode && !!clipCode;

  const goCreate = () => {
    onClose();
    router.push('/create');
  };

  const goJoin = () => {
    if (!code) return;
    onClose();
    router.push(`/join/${code}`);
  };

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 3,
        backgroundColor: colors.scrim,
        justifyContent: 'flex-end',
        zIndex: 30,
      }}
    >
      <Pressable style={{ flex: 1 }} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Animated.View
        entering={SlideInDown.duration(260)}
        style={{
          backgroundColor: colors.bgSurface,
          borderTopLeftRadius:radius.sheet,
          borderTopRightRadius:radius.sheet,
          borderBottomLeftRadius:radius.sheetLow,
          borderBottomRightRadius:radius.sheetLow,
          borderWidth: hairline,
          borderColor: colors.strokeSubtle,
          paddingHorizontal: spacing.screenX,
          paddingTop: 12,
          paddingBottom: 36,
        }}
      >
        <View
          style={{
            alignSelf: 'center',
            width: 40,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.strokeSubtle,
            marginBottom: 20,
          }}
        />

        {mode === 'choose' ? (
          <>
            <AppText variant="screenTitle" style={{ fontSize: 22, marginBottom: 18 }}>
              Ne yapmak istersin?
            </AppText>
            <View style={{ gap: 12 }}>
              <Row
                icon="plus"
                emberIcon
                title="Challenge oluştur"
                subtitle="Hedefi sen koy, grubunu çağır."
                onPress={goCreate}
              />
              <Row
                icon="link-2"
                title="Davetle katıl"
                subtitle="Bir kod veya link girerek katıl."
                onPress={() => setMode('join')}
              />
            </View>
          </>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setMode('choose');
                }}
                hitSlop={8}
                style={{ padding: 4 }}
              >
                <Feather name="chevron-left" size={20} color={colors.textPrimary} />
              </Pressable>
              <AppText
                style={{ flex: 1, textAlign: 'center', fontFamily: fonts.displaySemibold, fontSize: 17, color: colors.textPrimary, marginRight: 28 }}
              >
                Davetle katıl
              </AppText>
            </View>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                backgroundColor: colors.bgElevated,
                borderRadius: radius.pill,
                borderWidth: hairline,
                borderColor: colors.strokeSubtle,
                paddingHorizontal: 16,
                height: 52,
              }}
            >
              <Feather name="link" size={16} color={colors.textTertiary} />
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Davet linki veya kod"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                style={{ flex: 1, color: colors.textPrimary, fontFamily: fonts.bodyRegular, fontSize: 15 }}
              />
            </View>

            {code ? (
              <View style={{ marginTop: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Feather name="clipboard" size={13} color={colors.ember} />
                  <AppText variant="meta" color={colors.ember}>
                    {fromClipboard ? 'Panoda bir davet bulduk' : 'Davet hazır'}
                  </AppText>
                </View>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    goJoin();
                  }}
                  style={({ pressed }) => ({
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
          </>
        )}
      </Animated.View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}
