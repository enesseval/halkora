import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts, hairline, radius, spacing, type } from '@/theme/tokens';
import { useAuth, initialsFrom } from '@/hooks/useAuth';
import type { SegmentState } from '@/hooks';
import { ProgressRing } from '@/components/ProgressRing';
import { AppText, Avatar, AvatarStack, Button, Chip, Screen } from '@/components/ui';

const O1_DAYS: SegmentState[] = [
  'done', 'done', 'done', 'today',
  'empty', 'empty', 'empty', 'empty',
  'empty', 'empty', 'empty', 'empty', 'empty', 'empty',
];
const CARD_DAYS: SegmentState[] = [
  'done', 'done', 'joker', 'done', 'done', 'done', 'today',
  'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty',
];

function Dots({ step }: { step: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            width: i === step ? 20 : 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: i === step ? colors.ember : colors.strokeSubtle,
          }}
        />
      ))}
    </View>
  );
}

/* O1 — hook / promise */
function Hook() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ProgressRing totalDays={14} days={O1_DAYS} size="L" activeIndex={3}
        centerContent={
          <AppText tabular style={{ ...type.hero, fontSize: 28, lineHeight: 34, color: colors.textPrimary }}>
            3/14
          </AppText>
        }
      />
      <AppText variant="hero" style={{ textAlign: 'center', marginTop: 40 }}>
        Kendine verdiğin sözler yalnızken kolay unutulur.
      </AppText>
      <AppText variant="secondary" style={{ textAlign: 'center', marginTop: 14 }}>
        Arkadaşların izlerken değil.
      </AppText>
    </View>
  );
}

/* O2 — mechanic / one tap */
function Mechanic() {
  return (
    <View style={{ flex: 1, justifyContent: 'center' }}>
      <AppText variant="hero">Her gün{'\n'}tek dokunuş.</AppText>
      <AppText variant="secondary" style={{ marginTop: 14, maxWidth: 320 }}>
        Check-in yaparsın, günün segmenti dolar. Grubun anında görür.
      </AppText>

      <View
        style={{
          marginTop: 32,
          backgroundColor: colors.bgSurface,
          borderRadius: radius.card,
          borderWidth: hairline,
          borderColor: colors.strokeSubtle,
          padding: 20,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 18 }}>
          <View style={{ flex: 1 }}>
            <AppText style={{ fontFamily: fonts.bodyRegular, fontSize: 13, color: colors.textSecondary }}>
              30 Gün Kitap Okuma
            </AppText>
            <AppText style={{ fontFamily: fonts.bodyMedium, fontSize: 20, lineHeight: 25, marginTop: 6 }}>
              Bugün: 20 sayfa oku
            </AppText>
            <AppText tabular style={{ ...type.secondary, marginTop: 12 }}>5/8 kişi tamamladı</AppText>
          </View>
          <ProgressRing totalDays={14} days={CARD_DAYS} size="M" activeIndex={6}
            centerContent={
              <AppText tabular style={{ fontFamily: fonts.displaySemibold, fontSize: 15, color: colors.textPrimary }}>7/14</AppText>
            }
          />
        </View>
        <View style={{ height: 56, borderRadius: radius.pill, backgroundColor: colors.ember, alignItems: 'center', justifyContent: 'center' }}>
          <AppText style={{ fontFamily: fonts.bodyBold, fontSize: 17, color: colors.bgBase }}>Check-in</AppText>
        </View>
      </View>
    </View>
  );
}

/* O3 — stake */
function Stake() {
  const options = [
    { label: 'Tamamlayamayan kahve ısmarlar', emoji: '☕', on: true },
    { label: 'Yemek ısmarlar', emoji: '🍽️', on: false },
    { label: 'Grubun seçtiği filmi izler', emoji: '🎬', on: false },
  ];
  return (
    <View style={{ flex: 1, justifyContent: 'center' }}>
      <AppText variant="hero">İşin ucunda{'\n'}bir şey olsun.</AppText>
      <AppText variant="secondary" style={{ marginTop: 14, maxWidth: 330 }}>
        Grup bir bahis koyar. Tamamlayamayan öder — dostça, küçük, unutulmaz.
      </AppText>
      <View style={{ gap: 10, marginTop: 28, alignItems: 'flex-start' }}>
        {options.map((o) => (
          <Chip key={o.label} label={o.label} emoji={o.emoji} selected={o.on} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24 }}>
        <AvatarStack
          people={[
            { id: 'ek', initials: 'EK' },
            { id: 'ay', initials: 'AY' },
            { id: 'zd', initials: 'ZD' },
          ]}
          size={26}
          surface={colors.bgBase}
          plain
        />
        <AppText variant="meta" color={colors.textTertiary} style={{ flex: 1 }}>
          Kaybeden belli olur, kimse utandırılmaz.
        </AppText>
      </View>
    </View>
  );
}

/* O4 — name */
function NameStep({
  name,
  setName,
  onSubmit,
}: {
  name: string;
  setName: (t: string) => void;
  onSubmit: () => void;
}) {
  return (
    <View style={{ flex: 1, justifyContent: 'center' }}>
      <AppText variant="screenTitle">Grubun seni{'\n'}nasıl tanısın?</AppText>
      <AppText variant="secondary" style={{ marginTop: 12, maxWidth: 320 }}>
        Sadece ismin yeter. Hesap, şifre, e-posta yok.
      </AppText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 32 }}>
        <Avatar initials={name.trim() ? initialsFrom(name) : 'SN'} size={44} tint />
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Adın"
          placeholderTextColor={colors.textTertiary}
          autoFocus
          autoCapitalize="words"
          maxLength={40}
          returnKeyType="done"
          onSubmitEditing={onSubmit}
          style={{
            flex: 1,
            height: 56,
            backgroundColor: colors.bgSurface,
            borderRadius: radius.badge,
            borderWidth: hairline,
            borderColor: name.trim() ? colors.ember : colors.strokeSubtle,
            paddingHorizontal: 18,
            color: colors.textPrimary,
            fontFamily: fonts.bodyMedium,
            fontSize: 17,
          }}
        />
      </View>
      <AppText variant="meta" color={colors.textTertiary} style={{ marginTop: 10 }}>
        İstediğin zaman değiştirebilirsin.
      </AppText>
    </View>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { saveName } = useAuth();
  const [step, setStep] = useState(0); // 0,1,2 intro · 3 name
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isName = step === 3;
  const canSubmitName = name.trim().length >= 2 && !saving;

  const submitName = async () => {
    if (!canSubmitName) return;
    setSaving(true);
    setErr(null);
    try {
      await saveName(name);
      router.replace('/start');
    } catch {
      setErr('Kaydedilemedi. Bağlantını kontrol edip tekrar dene.');
      setSaving(false);
    }
  };

  const advance = () => (step < 2 ? setStep(step + 1) : setStep(3));

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* skip */}
        <View style={{ height: 28, justifyContent: 'center', alignItems: 'flex-end' }}>
          {!isName ? (
            <AppText variant="secondary" color={colors.textSecondary} onPress={() => setStep(3)}>
              Atla
            </AppText>
          ) : null}
        </View>

        {step === 0 ? <Hook /> : null}
        {step === 1 ? <Mechanic /> : null}
        {step === 2 ? <Stake /> : null}
        {isName ? <NameStep name={name} setName={setName} onSubmit={submitName} /> : null}

        {err ? (
          <AppText variant="meta" color={colors.joker} style={{ marginBottom: 8 }}>
            {err}
          </AppText>
        ) : null}

        <View style={{ gap: 16, paddingBottom: spacing.section, paddingTop: 8 }}>
          {!isName ? <Dots step={step} /> : null}
          {isName ? (
            <Button
              label={saving ? 'Kaydediliyor…' : 'Devam'}
              onPress={submitName}
              disabled={!canSubmitName}
            />
          ) : (
            <Button label={step === 2 ? 'Başlayalım' : 'Devam'} onPress={advance} />
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
