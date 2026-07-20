import { useEffect, useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { colors, fonts, hairline, radius, spacing, type } from '@/theme/tokens';
import { Challenge, Momentum } from '@/data/types';
import { errMessage } from '@/lib/errors';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { useT } from '@/i18n';
import { ProgressRing } from './ProgressRing';
import { AppText, Button } from './ui';

/* ------------------------------------------------------------------ */
/* E8 — Missed Day / Return (full-screen gate on detail entry)         */
/* ------------------------------------------------------------------ */
export function MissedDaySheet({
  challenge,
  onUseJoker,
  onDismiss,
}: {
  challenge: Challenge;
  onUseJoker: () => void;
  onDismiss: () => void;
}) {
  const { t } = useT();
  const [usedJoker, setUsedJoker] = useState(false);

  useEffect(() => {
    if (!usedJoker) return;
    const t = setTimeout(onDismiss, 950);
    return () => clearTimeout(t);
  }, [usedJoker, onDismiss]);

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: colors.bgBase,
        paddingHorizontal: spacing.screenX,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 20,
      }}
    >
      <AppText variant="screenTitle" style={{ textAlign: 'center' }}>
        {t.detail.notStarted}
      </AppText>
      <AppText variant="secondary" tabular style={{ marginTop: 8, marginBottom: 36 }}>
        {challenge.title} · {t.common.dayOf(challenge.currentDay, challenge.totalDays)}
      </AppText>

      <ProgressRing
        totalDays={challenge.totalDays}
        days={challenge.days}
        size="L"
        activeIndex={challenge.currentDay - 1}
        centerContent={
          <AppText tabular style={{ ...type.hero, color: colors.textPrimary }}>
            {challenge.currentDay}/{challenge.totalDays}
          </AppText>
        }
      />

      <View style={{ height: 40 }} />

      <View style={{ width: '100%', gap: 12 }}>
        <Button label={t.detail.todayCheckIn} onPress={onDismiss} />
        {challenge.jokerRemaining > 0 && !usedJoker ? (
          <Button
            label={t.detail.useJoker(challenge.jokerRemaining)}
            variant="amber"
            onPress={() => {
              onUseJoker();
              setUsedJoker(true);
            }}
          />
        ) : null}
      </View>
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/* E10 — Momentum bottom sheet (scrim + slide up)                       */
/* ------------------------------------------------------------------ */
export function MomentumSheet({
  momentum,
  onRestart,
  onEndEarly,
  onClose,
}: {
  momentum: Momentum;
  onRestart: () => void;
  onEndEarly: () => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const startDay = momentum.daysTogether - momentum.last3.length + 1;
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: colors.scrim,
        justifyContent: 'flex-end',
        zIndex: 30,
      }}
    >
      <Pressable style={{ flex: 1 }} onPress={onClose} />
      <Animated.View
        entering={SlideInDown.duration(280)}
        style={{
          backgroundColor: colors.bgSurface,
          borderTopLeftRadius: radius.sheet,
          borderTopRightRadius: radius.sheet,
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
        <AppText variant="screenTitle" style={{ fontSize: 24 }}>
          {t.detail.momentumTitle}
        </AppText>
        <AppText variant="secondary" style={{ marginTop: 8 }}>
          {t.detail.momentumSubtitle}
        </AppText>

        <View
          style={{
            flexDirection: 'row',
            marginTop: 20,
            backgroundColor: colors.bgElevated,
            borderRadius: radius.card,
            borderWidth: hairline,
            borderColor: colors.strokeSubtle,
            padding: 16,
            gap: 12,
            alignItems: 'center',
          }}
        >
          {momentum.last3.map((n, i) => (
            <View key={i} style={{ alignItems: 'center', flex: 1 }}>
              <AppText variant="meta" color={colors.textTertiary} tabular>
                {t.detail.momentumDay(startDay + i)}
              </AppText>
              <AppText
                tabular
                style={{ fontFamily: fonts.displayBold, fontSize: 22, color: colors.textPrimary, marginTop: 4 }}
              >
                {n}
              </AppText>
              <AppText variant="meta" color={colors.textTertiary} tabular>
                {t.detail.momentumOutOf(momentum.total)}
              </AppText>
            </View>
          ))}
          <View style={{ flex: 1.4, paddingLeft: 8 }}>
            <AppText variant="secondary" color={colors.textSecondary}>
              {t.detail.momentumFootnote}
            </AppText>
          </View>
        </View>

        <View style={{ gap: 12, marginTop: 20 }}>
          <Button label={t.detail.restart} onPress={onRestart} />
          <Button label={t.detail.endEarly} variant="secondary" onPress={onEndEarly} />
        </View>

        <AppText
          variant="meta"
          color={colors.textTertiary}
          tabular
          style={{ textAlign: 'center', marginTop: 18 }}
        >
          {t.detail.daysTogether(momentum.daysTogether)}
        </AppText>
      </Animated.View>
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/* Ayarlar — görünen isim düzenleme (saha testi bulgusu, ROADMAP "MVP-öncesi") */
/* ------------------------------------------------------------------ */
export function NameSheet({
  visible,
  current,
  onClose,
  onSave,
}: {
  visible: boolean;
  current: string;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
}) {
  const { t } = useT();
  const [value, setValue] = useState(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keyboardHeight = useKeyboardHeight();

  useEffect(() => {
    if (visible) {
      setValue(current);
      setError(null);
    }
  }, [visible, current]);

  if (!visible) return null;

  const canSave = value.trim().length > 0 && value.trim() !== current && !saving;

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(value.trim());
      onClose();
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: colors.scrim,
        zIndex: 30,
      }}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: keyboardHeight }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <Animated.View
          entering={SlideInDown.duration(260)}
          style={{
            backgroundColor: colors.bgSurface,
            borderTopLeftRadius: radius.sheet,
            borderTopRightRadius: radius.sheet,
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
          <AppText variant="screenTitle" style={{ fontSize: 22 }}>
            {t.settings.nameEditTitle}
          </AppText>
          <AppText variant="meta" color={colors.textTertiary} style={{ marginTop: 6 }}>
            {t.settings.nameEditHint}
          </AppText>

          <View
            style={{
              marginTop: 18,
              backgroundColor: colors.bgElevated,
              borderRadius: radius.pill,
              borderWidth: hairline,
              borderColor: error ? colors.joker : colors.strokeSubtle,
              paddingHorizontal: 16,
              height: 52,
              justifyContent: 'center',
            }}
          >
            <TextInput
              value={value}
              onChangeText={setValue}
              placeholder={t.settings.namePlaceholder}
              placeholderTextColor={colors.textTertiary}
              autoFocus
              maxLength={40}
              returnKeyType="done"
              onSubmitEditing={submit}
              style={{ color: colors.textPrimary, fontFamily: fonts.bodyMedium, fontSize: 16 }}
            />
          </View>

          {error ? (
            <AppText variant="meta" color={colors.joker} style={{ marginTop: 10 }}>
              {error}
            </AppText>
          ) : null}

          <View style={{ marginTop: 20 }}>
            <Button
              label={saving ? t.settings.nameSaving : t.settings.nameSave}
              onPress={submit}
              disabled={!canSave}
            />
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/* Ayarlar — @kullanıcıadı düzenleme (Faz 3C, docs "Ek O")             */
/* ------------------------------------------------------------------ */
export function UsernameSheet({
  visible,
  current,
  onClose,
  onSave,
}: {
  visible: boolean;
  current: string | null;
  onClose: () => void;
  onSave: (username: string) => Promise<void>;
}) {
  const { t } = useT();
  const [value, setValue] = useState(current ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keyboardHeight = useKeyboardHeight();

  useEffect(() => {
    if (visible) {
      setValue(current ?? '');
      setError(null);
    }
  }, [visible, current]);

  if (!visible) return null;

  // Strip anything the server would reject anyway, live — friendlier than
  // letting an invalid character through and rejecting it after Save.
  const sanitize = (raw: string) => raw.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);

  const canSave = value.length >= 3 && value !== current && !saving;

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(value);
      onClose();
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: colors.scrim,
        zIndex: 30,
      }}
    >
      {/* paddingBottom = the LIVE keyboard height (useKeyboardHeight) — not
          KeyboardAvoidingView, which mis-measures inside absolute overlays
          (relative frame vs the keyboard's screen coords) and left the input
          partly covered on device. */}
      <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: keyboardHeight }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <Animated.View
          entering={SlideInDown.duration(260)}
          style={{
            backgroundColor: colors.bgSurface,
            borderTopLeftRadius: radius.sheet,
            borderTopRightRadius: radius.sheet,
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
          <AppText variant="screenTitle" style={{ fontSize: 22 }}>
            {t.settings.usernameEditTitle}
          </AppText>
          <AppText variant="meta" color={colors.textTertiary} style={{ marginTop: 6 }}>
            {t.settings.usernameEditHint}
          </AppText>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              marginTop: 18,
              backgroundColor: colors.bgElevated,
              borderRadius: radius.pill,
              borderWidth: hairline,
              borderColor: error ? colors.joker : colors.strokeSubtle,
              paddingHorizontal: 16,
              height: 52,
            }}
          >
            <AppText style={{ fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.textTertiary }}>
              @
            </AppText>
            <TextInput
              value={value}
              onChangeText={(raw) => setValue(sanitize(raw))}
              placeholder={t.settings.usernamePlaceholder}
              placeholderTextColor={colors.textTertiary}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
              returnKeyType="done"
              onSubmitEditing={submit}
              style={{ flex: 1, color: colors.textPrimary, fontFamily: fonts.bodyMedium, fontSize: 16 }}
            />
          </View>

          {error ? (
            <AppText variant="meta" color={colors.joker} style={{ marginTop: 10 }}>
              {error}
            </AppText>
          ) : null}

          <View style={{ marginTop: 20 }}>
            <Button
              label={saving ? t.settings.usernameSaving : t.settings.usernameSave}
              onPress={submit}
              disabled={!canSave}
            />
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/* Detay ekranı — kurucu ayarları (Faz 3C, docs "Ek O3")               */
/* ------------------------------------------------------------------ */
function EditField({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={{ marginTop: 16 }}>
      <AppText variant="meta" color={colors.textTertiary} style={{ marginBottom: 8 }}>
        {label}
      </AppText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        style={{
          height: 50,
          backgroundColor: colors.bgElevated,
          borderRadius: radius.badge,
          borderWidth: hairline,
          borderColor: colors.strokeSubtle,
          paddingHorizontal: 16,
          color: colors.textPrimary,
          fontFamily: fonts.bodyMedium,
          fontSize: 16,
        }}
      />
    </View>
  );
}

export function OwnerSettingsSheet({
  visible,
  challenge,
  onClose,
  onSave,
  onDelete,
}: {
  visible: boolean;
  challenge: Challenge;
  onClose: () => void;
  onSave: (title: string, dailyAction: string, stakeText: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const { t } = useT();
  const [title, setTitle] = useState(challenge.title);
  const [dailyAction, setDailyAction] = useState(challenge.dailyActionRaw ?? '');
  const [stakeText, setStakeText] = useState(challenge.stake?.text ?? '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keyboardHeight = useKeyboardHeight();

  useEffect(() => {
    if (visible) {
      setTitle(challenge.title);
      setDailyAction(challenge.dailyActionRaw ?? '');
      setStakeText(challenge.stake?.text ?? '');
      setError(null);
    }
    // Deliberately excludes `challenge` from deps — only reset when the
    // sheet transitions to visible, not on every poll-driven refresh while
    // it's open (that would wipe whatever the owner is mid-typing).
  }, [visible]);

  if (!visible) return null;

  const canSave = title.trim().length > 0 && dailyAction.trim().length > 0 && !saving;

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(title.trim(), dailyAction.trim(), stakeText.trim());
      onClose();
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (deleting) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Alert.alert(t.detail.deleteChallengeConfirmTitle, t.detail.deleteChallengeConfirmBody, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.detail.deleteChallenge,
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await onDelete();
            // onDelete's caller navigates away on success — no onClose() here,
            // the sheet unmounts along with the screen it's attached to.
          } catch (e) {
            setError(errMessage(e));
            setDeleting(false);
          }
        },
      },
    ]);
  };

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: colors.scrim,
        zIndex: 30,
      }}
    >
      {/* See UsernameSheet's comment: live keyboard-height padding, not
          KeyboardAvoidingView (which mis-measures inside absolute overlays). */}
      <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: keyboardHeight }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <Animated.View
          entering={SlideInDown.duration(260)}
          style={{
            backgroundColor: colors.bgSurface,
            borderTopLeftRadius: radius.sheet,
            borderTopRightRadius: radius.sheet,
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
          <AppText variant="screenTitle" style={{ fontSize: 22 }}>
            {t.detail.ownerSettingsTitle}
          </AppText>

          <EditField label={t.detail.ownerSettingsTitleLabel} value={title} onChangeText={setTitle} />
          <EditField
            label={t.detail.ownerSettingsDailyActionLabel}
            value={dailyAction}
            onChangeText={setDailyAction}
          />
          <EditField
            label={t.detail.ownerSettingsStakeLabel}
            value={stakeText}
            onChangeText={setStakeText}
            placeholder={t.detail.ownerSettingsStakePlaceholder}
          />

          {error ? (
            <AppText variant="meta" color={colors.joker} style={{ marginTop: 10 }}>
              {error}
            </AppText>
          ) : null}

          <View style={{ marginTop: 20 }}>
            <Button
              label={saving ? t.detail.ownerSettingsSaving : t.detail.ownerSettingsSave}
              onPress={submit}
              disabled={!canSave}
            />
          </View>

          {/* Destructive — faint, never red, matches Settings' delete-account
              pattern (a deliberate confirm dialog stands between the tap and
              the actual delete, not the button's own color). */}
          <Pressable
            onPress={confirmDelete}
            disabled={deleting}
            style={({ pressed }) => ({
              alignItems: 'center',
              paddingTop: 18,
              opacity: pressed || deleting ? 0.6 : 1,
            })}
          >
            <AppText variant="secondary" color={colors.joker}>
              {deleting ? t.detail.deletingChallenge : t.detail.deleteChallenge}
            </AppText>
          </Pressable>
        </Animated.View>
      </View>
    </Animated.View>
  );
}
