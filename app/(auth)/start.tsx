import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { colors, fonts, hairline, radius, spacing } from '@/theme/tokens';
import { useAuth } from '@/hooks/useAuth';
import { extractCode } from '@/lib/invite';
import { AppText, IconButton, Screen } from '@/components/ui';
import { useT } from '@/i18n';

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
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
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
  const { t } = useT();
  const { name } = useAuth();
  const first = (name ?? '').trim().split(/\s+/)[0] || t.start.nameFallback;

  const [mode, setMode] = useState<'fork' | 'join'>('fork');
  const [input, setInput] = useState('');
  /** The value arrived by pasting rather than typing — changes the card's
   * wording, nothing else. */
  const [pasted, setPasted] = useState(false);

  // Apple's own paste control (UIPasteControl) hands over the clipboard
  // WITHOUT the "Allow Paste?" prompt. Reading the clipboard on mount, which
  // is what this screen used to do, is what raised that prompt — and it fired
  // once, before the code had even been copied, so a code copied afterwards
  // was never seen (saha testi bulgusu: "yapıştıra bastım ama yapıştırmadı").
  const pasteButtonAvailable = Clipboard.isPasteButtonAvailable;

  /** Fallback for where the paste control doesn't exist. Prompts, but only
   * when the person actually asked to paste. */
  const readClipboard = () => {
    Clipboard.getStringAsync()
      .then((v) => {
        if (!v?.trim()) return;
        setInput(v.trim());
        setPasted(true);
      })
      .catch(() => {});
  };

  const code = extractCode(input);
  const fromClipboard = pasted;

  const join = () => {
    if (!code) return;
    router.replace(`/join/${code}`);
  };

  if (mode === 'join') {
    return (
      <Screen edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* top bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 6, paddingBottom: 16 }}>
          <IconButton size={40} onPress={() => setMode('fork')}>
            <Feather name="chevron-left" size={20} color={colors.textPrimary} />
          </IconButton>
          <AppText
            numberOfLines={1}
            style={{ flex: 1, textAlign: 'center', fontFamily: fonts.displaySemibold, fontSize: 17, color: colors.textPrimary }}
          >
            {t.start.joinHeaderTitle}
          </AppText>
          <View style={{ width: 40 }} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.bgSurface, borderRadius: radius.pill, borderWidth: hairline, borderColor: colors.strokeSubtle, paddingHorizontal: 16, height: 52 }}>
          <Feather name="link" size={16} color={colors.textTertiary} />
          <TextInput
            value={input}
            onChangeText={(v) => {
              setInput(v);
              setPasted(false);
            }}
            placeholder={t.start.linkPlaceholder}
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            style={{ flex: 1, color: colors.textPrimary, fontFamily: fonts.bodyRegular, fontSize: 15 }}
          />
          {pasteButtonAvailable ? (
            <Clipboard.ClipboardPasteButton
              acceptedContentTypes={['plain-text']}
              displayMode="iconOnly"
              cornerStyle="capsule"
              backgroundColor={colors.ember}
              foregroundColor={colors.bgBase}
              style={{ width: 34, height: 34 }}
              onPress={(data) => {
                if (data.type !== 'text' || !data.text?.trim()) return;
                setInput(data.text.trim());
                setPasted(true);
              }}
            />
          ) : (
            <Pressable onPress={readClipboard} hitSlop={8}>
              <Feather name="clipboard" size={18} color={colors.ember} />
            </Pressable>
          )}
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
                {fromClipboard ? t.start.foundInClipboard : t.start.inviteReady}
              </AppText>
            </View>
            <AppText style={{ fontFamily: fonts.displaySemibold, fontSize: 17, color: colors.textPrimary }}>
              {t.start.codeLabel(code)}
            </AppText>
            <AppText variant="meta" color={colors.textTertiary} style={{ marginTop: 4 }}>
              {t.start.detailHint}
            </AppText>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                join();
              }}
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
                {t.start.joinThisChallenge}
              </AppText>
            </Pressable>
          </View>
        ) : null}

        <View style={{ flex: 1 }} />
        <AppText variant="meta" color={colors.textTertiary} style={{ textAlign: 'center', paddingBottom: spacing.section }}>
          {t.start.wrongInvite}
        </AppText>
        </KeyboardAvoidingView>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <AppText variant="screenTitle" style={{ marginBottom: 28 }}>
          {t.start.greeting(first)}
        </AppText>
        <View style={{ gap: 12 }}>
          <OptionCard
            icon="plus"
            emberIcon
            title={t.start.createTitle}
            subtitle={t.start.createSubtitle}
            onPress={() => router.replace('/create')}
          />
          <OptionCard
            icon="link-2"
            title={t.start.joinTitle}
            subtitle={t.start.joinSubtitle}
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
        {t.start.footnote}
      </AppText>
    </Screen>
  );
}
