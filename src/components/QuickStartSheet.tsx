import { useEffect, useState } from 'react';
import { AppState, Pressable, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { colors, fonts, hairline, radius, spacing } from '@/theme/tokens';
import { codeProblem, extractCode } from '@/lib/invite';
import { useClipboardCode } from '@/hooks/useClipboardCode';
import { useCreateGate } from '@/hooks';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { useT } from '@/i18n';
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
  const { t } = useT();
  const canCreate = useCreateGate();
  const keyboardHeight = useKeyboardHeight();
  const [mode, setMode] = useState<'choose' | 'join'>('choose');
  const [input, setInput] = useState('');
  /** The value arrived by pasting rather than typing — changes the card's
   * wording, nothing else. */
  const [pasted, setPasted] = useState(false);
  // ALL hooks stay above the `if (!visible) return null` below. This sheet is
  // mounted permanently and hides itself by returning early, so a hook placed
  // after that line runs on some renders and not others — React counts a
  // different number of hooks the moment the sheet opens and throws, which
  // crashes the app on the "+" button. That exact bug shipped twice from this
  // very spot; the early return is not a safe place to add anything.
  //
  // The field autofocuses, so opening this sheet is what triggers the paste
  // prompt — which is the moment someone is trying to join anyway.
  const clipboard = useClipboardCode((found) => {
    setInput(found);
    setPasted(true);
  });

  useEffect(() => {
    if (!visible) {
      setMode('choose');
      setInput('');
      setPasted(false);
    }
  }, [visible]);

  if (!visible) return null;

  const code = extractCode(input);
  const fromClipboard = pasted;
  const problem = codeProblem(input);
  const typed = input.replace(/\s+/g, '').length;

  const goCreate = () => {
    onClose();
    // Capped free users see the paywall HERE, before the form — not after
    // filling all four steps (the gate routes to /paywall itself).
    if (!canCreate()) return;
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
        zIndex: 30,
      }}
    >
      {/* Live keyboard-height padding, not KeyboardAvoidingView — KAV
          mis-measures inside absolute overlays (relative frame vs the
          keyboard's screen coords) and left the join-code input covered. */}
      <View
        style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: keyboardHeight }}
      >
      <Pressable style={{ flex: 1 }} onPress={onClose} />
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
              {t.start.whatToDo}
            </AppText>
            <View style={{ gap: 12 }}>
              <Row
                icon="plus"
                emberIcon
                title={t.start.createTitleShort}
                subtitle={t.start.createSubtitleShort}
                onPress={goCreate}
              />
              <Row
                icon="link-2"
                title={t.start.joinTitle}
                subtitle={t.start.joinSubtitleShort}
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
                {t.start.joinHeaderTitle}
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
                onChangeText={(v) => {
                  setInput(v);
                  setPasted(false);
                }}
                placeholder={t.start.linkPlaceholder}
                placeholderTextColor={colors.textTertiary}
                onFocus={clipboard.check}
                // Lowercase on purpose — invite codes are lowercase hex and
                // the server compares them as-is. See app/(auth)/start.tsx.
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
                style={{ flex: 1, color: colors.textPrimary, fontFamily: fonts.bodyRegular, fontSize: 15 }}
              />
            </View>


            {clipboard.notCode && !input ? (
              <AppText variant="meta" color={colors.textTertiary} style={{ marginTop: 10, marginLeft: 4 }}>
                {t.start.clipboardNotCode}
              </AppText>
            ) : null}

            {problem ? (
              <AppText variant="meta" color={colors.textTertiary} style={{ marginTop: 10, marginLeft: 4 }}>
                {problem === 'short'
                  ? t.start.codeTooShort(typed)
                  : problem === 'long'
                    ? t.start.codeTooLong(typed)
                    : t.start.codeInvalid}
              </AppText>
            ) : null}


            {code ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }}>
                <Feather name="clipboard" size={13} color={colors.ember} />
                <AppText variant="meta" color={colors.ember}>
                  {fromClipboard ? t.start.foundInClipboard : t.start.inviteReady}
                </AppText>
              </View>
            ) : null}

            {/* Always rendered, dimmed until the code is complete — it used to
                live inside the block above and only existed once a code
                parsed, so typing one by hand looked like it did nothing. */}
            <Pressable
              disabled={!code}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                goJoin();
              }}
              style={({ pressed }) => ({
                marginTop: 14,
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
          </>
        )}
      </Animated.View>
      </View>
    </Animated.View>
  );
}
