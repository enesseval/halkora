import { useEffect, useState } from 'react';
import { AppState, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
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
            // The one-tap paste is iOS's own suggestion strip above the keyboard, not
            // a button of ours — that's what this field is set up to invite.
            // Autocorrect stays off (it would mangle a ten-character code) and
            // textContentType is what still gets the strip drawn for code fields.
            autoCorrect={false}
            spellCheck={false}
            textContentType="oneTimeCode"
            style={{ flex: 1, color: colors.textPrimary, fontFamily: fonts.bodyRegular, fontSize: 15 }}
          />
        </View>

        {/* Its own row rather than crammed into the pill — Apple won't let the
            paste control be restyled, so inside the field it fought the
            existing design instead of joining it. */}
        

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
          </View>
        ) : null}

        <View style={{ flex: 1 }} />

        {/* Always here, dimmed until the code is complete. It used to live
            inside the card above, which only rendered once a code parsed —
            and with the keyboard up that card sat below the fold, so typing a
            code by hand looked like it did nothing (saha testi bulgusu:
            "yapıştırmada çalışıyor, elle girince açılmıyor"). */}
        <Pressable
          disabled={!code}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            join();
          }}
          style={({ pressed }) => ({
            height: 52,
            borderRadius: radius.pill,
            backgroundColor: code ? colors.ember : colors.bgElevated,
            borderWidth: code ? 0 : hairline,
            borderColor: colors.strokeSubtle,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed && code ? 0.9 : 1,
          })}
        >
          <AppText
            style={{
              fontFamily: fonts.bodyBold,
              fontSize: 17,
              color: code ? colors.bgBase : colors.textTertiary,
            }}
          >
            {t.start.joinThisChallenge}
          </AppText>
        </Pressable>

        <AppText variant="meta" color={colors.textTertiary} style={{ textAlign: 'center', paddingTop: 14, paddingBottom: spacing.section }}>
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
