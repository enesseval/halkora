import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { colors, fonts, hairline, radius, spacing, type } from '@/theme/tokens';
import { useAuth, initialsFrom } from '@/hooks/useAuth';
import type { SegmentState } from '@/hooks';
import { ProgressRing } from '@/components/ProgressRing';
import { registerForPushToken } from '@/lib/push';
import { takePendingInviteCode } from '@/lib/pendingInvite';
import { AppText, Avatar, AvatarStack, Button, Chip, Screen } from '@/components/ui';
import { useT } from '@/i18n';

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
  const { t } = useT();
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
        {t.onboarding.hook.title}
      </AppText>
      <AppText variant="secondary" style={{ textAlign: 'center', marginTop: 14 }}>
        {t.onboarding.hook.subtitle}
      </AppText>
    </View>
  );
}

/* O2 — mechanic / one tap */
function Mechanic() {
  const { t } = useT();
  return (
    <View style={{ flex: 1, justifyContent: 'center' }}>
      <AppText variant="hero">{t.onboarding.mechanic.title}</AppText>
      <AppText variant="secondary" style={{ marginTop: 14, maxWidth: 320 }}>
        {t.onboarding.mechanic.subtitle}
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
              {t.onboarding.mechanic.cardTitle}
            </AppText>
            <AppText style={{ fontFamily: fonts.bodyMedium, fontSize: 20, lineHeight: 25, marginTop: 6 }}>
              {t.onboarding.mechanic.cardAction}
            </AppText>
            <AppText tabular style={{ ...type.secondary, marginTop: 12 }}>{t.onboarding.mechanic.cardProgress}</AppText>
          </View>
          <ProgressRing totalDays={14} days={CARD_DAYS} size="M" activeIndex={6}
            centerContent={
              <AppText tabular style={{ fontFamily: fonts.displaySemibold, fontSize: 15, color: colors.textPrimary }}>7/14</AppText>
            }
          />
        </View>
        <View style={{ height: 56, borderRadius: radius.pill, backgroundColor: colors.ember, alignItems: 'center', justifyContent: 'center' }}>
          <AppText style={{ fontFamily: fonts.bodyBold, fontSize: 17, color: colors.bgBase }}>{t.onboarding.mechanic.checkIn}</AppText>
        </View>
      </View>
    </View>
  );
}

/* O3 — stake */
function Stake() {
  const { t } = useT();
  const options = [
    { label: t.onboarding.stake.option1, emoji: '☕', on: true },
    { label: t.onboarding.stake.option2, emoji: '🍽️', on: false },
    { label: t.onboarding.stake.option3, emoji: '🎬', on: false },
  ];
  return (
    <View style={{ flex: 1, justifyContent: 'center' }}>
      <AppText variant="hero">{t.onboarding.stake.title}</AppText>
      <AppText variant="secondary" style={{ marginTop: 14, maxWidth: 330 }}>
        {t.onboarding.stake.subtitle}
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
          {t.onboarding.stake.footnote}
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
  const { t } = useT();
  return (
    <View style={{ flex: 1, justifyContent: 'center' }}>
      <AppText variant="screenTitle">{t.onboarding.name.title}</AppText>
      <AppText variant="secondary" style={{ marginTop: 12, maxWidth: 320 }}>
        {t.onboarding.name.subtitle}
      </AppText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 32 }}>
        <Avatar initials={name.trim() ? initialsFrom(name) : 'SN'} size={44} tint />
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t.onboarding.name.placeholder}
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
        {t.onboarding.name.footnote}
      </AppText>
    </View>
  );
}

/* O5 — push permission */
function NotifStep() {
  const { t } = useT();
  return (
    <View style={{ flex: 1, justifyContent: 'center' }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          backgroundColor: colors.emberSoft,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
        }}
      >
        <Feather name="bell" size={26} color={colors.ember} />
      </View>
      <AppText variant="hero">{t.onboarding.notif.title}</AppText>
      <AppText variant="secondary" style={{ marginTop: 14, maxWidth: 320 }}>
        {t.onboarding.notif.subtitle}
      </AppText>
    </View>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { t } = useT();
  const { saveName } = useAuth();
  const [step, setStep] = useState(0); // 0,1,2 intro · 3 name · 4 notifications
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [askingPermission, setAskingPermission] = useState(false);

  const isName = step === 3;
  const isNotif = step === 4;
  const canSubmitName = name.trim().length >= 2 && !saving;

  const submitName = async () => {
    if (!canSubmitName) return;
    setSaving(true);
    setErr(null);
    try {
      await saveName(name);
      setStep(4);
    } catch {
      setErr(t.errors.saveFailed);
      setSaving(false);
    }
  };

  const finishNotifStep = async (allow: boolean) => {
    if (allow) {
      setAskingPermission(true);
      await registerForPushToken(); // fire-and-forget; useSyncPushToken() persists the token
      setAskingPermission(false);
    }
    // A /join/{code} deep link tapped before signing in gets stashed by the
    // root guard (src/lib/pendingInvite.ts) — resume it now instead of
    // dropping the visitor on the generic fork screen.
    const pendingCode = await takePendingInviteCode();
    router.replace(pendingCode ? `/join/${pendingCode}` : '/start');
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
          {!isName && !isNotif ? (
            <AppText variant="secondary" color={colors.textSecondary} onPress={() => setStep(3)}>
              {t.common.skip}
            </AppText>
          ) : null}
        </View>

        {step === 0 ? <Hook /> : null}
        {step === 1 ? <Mechanic /> : null}
        {step === 2 ? <Stake /> : null}
        {isName ? <NameStep name={name} setName={setName} onSubmit={submitName} /> : null}
        {isNotif ? <NotifStep /> : null}

        {err ? (
          <AppText variant="meta" color={colors.joker} style={{ marginBottom: 8 }}>
            {err}
          </AppText>
        ) : null}

        <View style={{ gap: 16, paddingBottom: spacing.section, paddingTop: 8 }}>
          {!isName && !isNotif ? <Dots step={step} /> : null}
          {isName ? (
            <Button
              label={saving ? t.onboarding.name.saving : t.common.continue}
              onPress={submitName}
              disabled={!canSubmitName}
            />
          ) : null}
          {isNotif ? (
            <>
              <Button
                label={askingPermission ? t.onboarding.notif.asking : t.onboarding.notif.allow}
                onPress={() => finishNotifStep(true)}
                disabled={askingPermission}
              />
              <AppText
                variant="secondary"
                color={colors.textSecondary}
                onPress={() => (askingPermission ? undefined : finishNotifStep(false))}
                style={{ textAlign: 'center' }}
              >
                {t.onboarding.notif.notNow}
              </AppText>
            </>
          ) : null}
          {!isName && !isNotif ? (
            <Button label={step === 2 ? t.onboarding.start : t.common.continue} onPress={advance} />
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
