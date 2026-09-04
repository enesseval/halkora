import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Alert, Modal, Pressable, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { colors, fonts, hairline, radius, spacing, type } from '@/theme/tokens';
import { Challenge } from '@/data/types';
import { friendlyErrorMessage } from '@/lib/errors';
import type { ReportReason } from '@/data/moderation';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { useT } from '@/i18n';
import { ProgressRing } from './ProgressRing';
import { AppText, Button } from './ui';

/**
 * The shell every sheet with a text field sits in.
 *
 * It exists because of one fact that defeated three attempts at fixing the
 * keyboard: these sheets are rendered inside `Screen`, which is a SafeAreaView
 * carrying `paddingHorizontal: 20` plus the top/bottom insets — and Yoga lays
 * absolutely-positioned children out against the parent's PADDING box, not the
 * screen. So an overlay pinned to `top/left/right/bottom: 0` was really pinned
 * to a box ~20pt narrower and ~34pt shorter than the screen. Every offset
 * computed against the keyboard's screen coordinates was wrong by that much,
 * whether it came from KeyboardAvoidingView or from padding by a measured
 * height, and the scrim never covered the bottom inset either.
 *
 * A Modal is hosted in its own full-screen window, outside that padding box,
 * so `paddingBottom = keyboardHeight` is exactly right with no inset
 * arithmetic left to get wrong. This is the whole fix — the sheets' own
 * content is untouched.
 *
 * Focus waits for the card's entering animation to finish, and that timing is
 * the point rather than a detail. The keyboard only comes up once the field
 * is first responder, so focusing immediately raises the keyboard WHILE
 * SlideInDown is still running — and a reanimated entering animation drives
 * the view toward the position it measured when it started, so the card
 * settles at its pre-keyboard place and stays there. That is precisely the
 * reported behaviour: opened by itself the field sits behind the keyboard,
 * but dismiss the keyboard and tap the field by hand — after the animation —
 * and it lands correctly.
 *
 * So the keyboard is allowed to arrive only once the card has stopped moving.
 * Two attempts rather than one because focus() is idempotent and it costs
 * nothing to be sure the first didn't fall on the animation's last frame.
 */
const ENTER_MS = 260;

function SheetOverlay({
  onClose,
  focusRef,
  children,
}: {
  onClose: () => void;
  focusRef?: RefObject<TextInput | null>;
  children: ReactNode;
}) {
  const keyboardHeight = useKeyboardHeight();
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const focusField = () => focusRef?.current?.focus();
    timers.current = [
      setTimeout(focusField, ENTER_MS + 60),
      setTimeout(focusField, ENTER_MS + 240),
    ];
    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal
      visible
      transparent
      animationType="none"
      // Android's hardware back button — a sheet should close, not leave the
      // screen. No-op on iOS.
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View
        entering={FadeIn.duration(180)}
        style={{ flex: 1, backgroundColor: colors.scrim }}
      >
        <View
          style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: keyboardHeight }}
        >
          <Pressable style={{ flex: 1 }} onPress={onClose} />
          {children}
        </View>
      </Animated.View>
    </Modal>
  );
}

/** The sheet card itself — surface, rounded top, grab handle. */
function SheetCard({ children }: { children: ReactNode }) {
  return (
    <Animated.View
      // Kept in step with ENTER_MS — focus is scheduled off this duration, so
      // changing one without the other puts the keyboard back inside the
      // animation and the card back behind it.
      entering={SlideInDown.duration(ENTER_MS)}
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
      {children}
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/* E8 — Missed Day / Return (full-screen gate on detail entry)         */
/* ------------------------------------------------------------------ */
export function MissedDaySheet({
  challenge,
  onUseJoker,
  onCheckInToday,
  onDismiss,
}: {
  challenge: Challenge;
  onUseJoker: () => void;
  /** Actually checks today in. The button used to only close this screen,
   * which dropped you on Detail to press check-in a second time — the press
   * here already said what you wanted. */
  onCheckInToday: () => void;
  onDismiss: () => void;
}) {
  const { t } = useT();
  const [usedJoker, setUsedJoker] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);

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
        <Button
          label={t.detail.todayCheckIn}
          disabled={checkingIn}
          onPress={() => {
            // Guarded because the check-in makes this whole screen go away —
            // a second tap in that gap would be a duplicate write the server
            // answers with ALREADY_CHECKED_IN.
            if (checkingIn) return;
            setCheckingIn(true);
            onCheckInToday();
            onDismiss();
          }}
        />
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
        {/* The way past this. It covers the whole screen, so without it the
            only exits were checking in or spending a joker — and someone who
            opened the app to read the chat was held here until they did one
            of the two. Saying "not now" is a legitimate answer to having
            missed a day. */}
        <AppText
          variant="secondary"
          color={colors.textTertiary}
          style={{ textAlign: 'center', paddingVertical: 10 }}
          onPress={onDismiss}
        >
          {t.detail.missedNotNow}
        </AppText>
      </View>
    </Animated.View>
  );
}

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
  const inputRef = useRef<TextInput>(null);

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
      setError(friendlyErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SheetOverlay onClose={onClose} focusRef={inputRef}>
      <SheetCard>
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
            ref={inputRef}
            value={value}
            onChangeText={setValue}
            placeholder={t.settings.namePlaceholder}
            placeholderTextColor={colors.textTertiary}
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
      </SheetCard>
    </SheetOverlay>
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

  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setValue(current ?? '');
      setError(null);
    }
  }, [visible, current]);

  if (!visible) return null;

  /**
   * Nothing typed here is rewritten.
   *
   * This field used to strip disallowed characters as you typed. That is
   * correct about what the server accepts and wrong about how a text field
   * behaves: React Native's TextInput is controlled, so the native view shows
   * the character for a frame before our value is written back over it, and
   * every rejected keystroke flickered. The rule is stated instead — the text
   * stays exactly as typed, the field marks itself invalid, and Save is closed
   * until it isn't. maxLength is the one exception, because the native input
   * enforces it without ever rewriting anything.
   */
  const VALID = /^[a-z0-9_]+$/;
  const badChars = value.length > 0 && !VALID.test(value);
  const tooShort = value.length > 0 && !badChars && value.length < 3;
  const invalid = badChars || tooShort;

  const canSave = value.length >= 3 && !invalid && value !== current && !saving;

  /**
   * "Bu kullanıcı adı zaten alınmış" is an answer about the text that was
   * submitted. It used to survive every keystroke after it — including
   * clearing the field — so the sheet kept accusing a username that was no
   * longer on screen. Editing invalidates the answer.
   */
  const onChange = (next: string) => {
    setValue(next);
    if (error) setError(null);
  };

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(value);
      onClose();
    } catch (e) {
      setError(friendlyErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SheetOverlay onClose={onClose} focusRef={inputRef}>
      <SheetCard>
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
            borderColor: error || invalid ? colors.joker : colors.strokeSubtle,
            paddingHorizontal: 16,
            height: 52,
          }}
        >
          <AppText style={{ fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.textTertiary }}>
            @
          </AppText>
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={onChange}
            placeholder={t.settings.usernamePlaceholder}
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
            returnKeyType="done"
            onSubmitEditing={submit}
            style={{ flex: 1, color: colors.textPrimary, fontFamily: fonts.bodyMedium, fontSize: 16 }}
          />
        </View>

        {invalid && !error ? (
          <AppText variant="meta" color={colors.joker} style={{ marginTop: 10 }}>
            {badChars ? t.settings.usernameCharInvalid : t.settings.usernameTooShort}
          </AppText>
        ) : null}

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
      </SheetCard>
    </SheetOverlay>
  );
}

/* ------------------------------------------------------------------ */
/* Detay ekranı — kurucu ayarları (Faz 3C, docs "Ek O3")               */
/* ------------------------------------------------------------------ */
/**
 * Same caps as creating a ring (app/(main)/create.tsx). Without them the
 * owner could edit past a limit the create screen enforces, which is the
 * same string ending up somewhere it doesn't fit by a different door.
 */
const TITLE_MAX = 40;
const ACTION_MAX = 60;
const STAKE_MAX = 60;

function EditField({
  label,
  value,
  onChangeText,
  placeholder,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  maxLength?: number;
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
        maxLength={maxLength}
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
      setError(friendlyErrorMessage(e));
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
            setError(friendlyErrorMessage(e));
            setDeleting(false);
          }
        },
      },
    ]);
  };

  return (
    <SheetOverlay onClose={onClose}>
      <SheetCard>
        <AppText variant="screenTitle" style={{ fontSize: 22 }}>
          {t.detail.ownerSettingsTitle}
        </AppText>

        <EditField
          label={t.detail.ownerSettingsTitleLabel}
          value={title}
          onChangeText={setTitle}
          maxLength={TITLE_MAX}
        />
        <EditField
          label={t.detail.ownerSettingsDailyActionLabel}
          value={dailyAction}
          onChangeText={setDailyAction}
          maxLength={ACTION_MAX}
        />
        <EditField
          label={t.detail.ownerSettingsStakeLabel}
          value={stakeText}
          onChangeText={setStakeText}
          placeholder={t.detail.ownerSettingsStakePlaceholder}
          maxLength={STAKE_MAX}
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
      </SheetCard>
    </SheetOverlay>
  );
}

/* ------------------------------------------------------------------ */
/* Nudge — pick one of a few meaningful messages instead of one generic  */
/* "wave" (saha testi bulgusu: the old single nudge felt random/pointless) */
/* ------------------------------------------------------------------ */
export function NudgeMessageSheet({
  participantName,
  onSend,
  onClose,
}: {
  participantName: string;
  onSend: (message: string) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: colors.scrim,
          justifyContent: 'flex-end',
          zIndex: 30 }}
    >
      <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={onClose} />

      <Animated.View
        entering={SlideInDown.duration(280)}
        style={{
          backgroundColor: colors.bgElevated,
          borderTopLeftRadius: radius.sheet,
          borderTopRightRadius: radius.sheet,
          paddingHorizontal: 24,
          paddingTop: 12,
          paddingBottom: 40,
        }}
      >
        <View style={{ alignItems: 'center', marginBottom: 8 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.strokeSubtle }} />
        </View>

        <AppText variant="screenTitle" style={{ fontSize: 20, marginTop: 8, marginBottom: 16 }}>
          {t.participant.nudgeSheetTitle(participantName)}
        </AppText>

        <View style={{ gap: 10 }}>
          {t.participant.nudgeOptions.map((option) => (
            <Pressable
              key={option}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onSend(option);
              }}
              style={({ pressed }) => ({
                backgroundColor: colors.bgSurface,
                borderRadius: radius.badge,
                borderWidth: hairline,
                borderColor: colors.strokeSubtle,
                paddingVertical: 14,
                paddingHorizontal: 16,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <AppText variant="bodyMedium">{option}</AppText>
            </Pressable>
          ))}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/* Joker on a tapped gap — confirm before spending one                 */
/* ------------------------------------------------------------------ */
/**
 * A joker is scarce and can't be taken back, so tapping a gap on the ring
 * opens this instead of writing straight away. It names the day being
 * repaired and what's left afterwards, so nobody spends their last one by
 * brushing the ring.
 */
/* ------------------------------------------------------------------ */
/* Guideline 1.2 — reporting a message                                  */
/* ------------------------------------------------------------------ */
/**
 * A reason has to be picked rather than "report" being one anonymous tap:
 * a report with no category can't be triaged, and being asked why makes
 * casual mis-reporting less likely.
 */
export function ReportSheet({
  onPick,
  onClose,
}: {
  onPick: (reason: ReportReason) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const reasons: { key: ReportReason; label: string }[] = [
    { key: 'harassment', label: t.moderation.reasonHarassment },
    { key: 'hate', label: t.moderation.reasonHate },
    { key: 'sexual', label: t.moderation.reasonSexual },
    { key: 'violence', label: t.moderation.reasonViolence },
    { key: 'spam', label: t.moderation.reasonSpam },
    { key: 'other', label: t.moderation.reasonOther },
  ];

  return (
    <SheetOverlay onClose={onClose}>
      <SheetCard>
        <AppText variant="screenTitle" style={{ fontSize: 22 }}>
          {t.moderation.reportTitle}
        </AppText>
        <AppText variant="meta" color={colors.textTertiary} style={{ marginTop: 6 }}>
          {t.moderation.reportHint}
        </AppText>

        <View style={{ gap: 10, marginTop: 18 }}>
          {reasons.map((r) => (
            <Pressable
              key={r.key}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onPick(r.key);
              }}
              style={({ pressed }) => ({
                backgroundColor: colors.bgElevated,
                borderRadius: radius.badge,
                borderWidth: hairline,
                borderColor: colors.strokeSubtle,
                paddingVertical: 14,
                paddingHorizontal: 16,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <AppText variant="bodyMedium">{r.label}</AppText>
            </Pressable>
          ))}
        </View>
      </SheetCard>
    </SheetOverlay>
  );
}

export function JokerDaySheet({
  dayNumber,
  totalDays,
  jokerRemaining,
  onConfirm,
  onClose,
}: {
  dayNumber: number;
  totalDays: number;
  jokerRemaining: number;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useT();
  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: colors.scrim,
          justifyContent: 'flex-end',
          zIndex: 30 }}
    >
      <Pressable
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        onPress={onClose}
      />

      <Animated.View
        entering={SlideInDown.duration(280)}
        style={{
          backgroundColor: colors.bgElevated,
          borderTopLeftRadius: radius.sheet,
          borderTopRightRadius: radius.sheet,
          paddingHorizontal: 24,
          paddingTop: 12,
          paddingBottom: 40,
        }}
      >
        <View style={{ alignItems: 'center', marginBottom: 8 }}>
          <View
            style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.strokeSubtle }}
          />
        </View>

        <AppText variant="screenTitle" style={{ fontSize: 20, marginTop: 8 }}>
          {t.detail.jokerDayTitle(dayNumber)}
        </AppText>
        <AppText variant="secondary" tabular style={{ marginTop: 6, marginBottom: 20 }}>
          {t.common.dayOf(dayNumber, totalDays)} · {t.detail.jokerDayRemaining(jokerRemaining - 1)}
        </AppText>

        <View style={{ gap: 10 }}>
          <Button
            label={t.detail.jokerDayConfirm}
            variant="amber"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              onConfirm();
            }}
          />
          <Button label={t.common.cancel} variant="ghost" onPress={onClose} />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/* Faz 2 §2.6 — how to add the widget                                  */
/* ------------------------------------------------------------------ */
/**
 * Three frames, one sentence each. iOS gives a widget no way to introduce
 * itself and there is no such thing as a tooltip on the Home Screen, so the
 * only place this can be explained is inside the app.
 */
export function WidgetHintSheet({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const steps = [t.widgetHint.step1, t.widgetHint.step2, t.widgetHint.step3];

  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: colors.scrim,
          justifyContent: 'flex-end',
          zIndex: 30 }}
    >
      <Pressable
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        onPress={onClose}
      />
      <Animated.View
        entering={SlideInDown.duration(280)}
        style={{
          backgroundColor: colors.bgElevated,
          borderTopLeftRadius: radius.sheet,
          borderTopRightRadius: radius.sheet,
          paddingHorizontal: 24,
          paddingTop: 12,
          paddingBottom: 40,
        }}
      >
        <View style={{ alignItems: 'center', marginBottom: 8 }}>
          <View
            style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.strokeSubtle }}
          />
        </View>

        <AppText variant="screenTitle" style={{ fontSize: 20, marginTop: 8, marginBottom: 18 }}>
          {t.widgetHint.sheetTitle}
        </AppText>

        <View style={{ gap: 14, marginBottom: 22 }}>
          {steps.map((step, i) => (
            <View key={step} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              {/* Numbered because these are genuinely sequential — you cannot
                  do the second before the first. */}
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: colors.emberSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AppText variant="meta" color={colors.ember} tabular>
                  {i + 1}
                </AppText>
              </View>
              <AppText variant="bodyMedium" style={{ flex: 1 }}>
                {step}
              </AppText>
            </View>
          ))}
        </View>

        <Button label={t.widgetHint.gotIt} onPress={onClose} />
      </Animated.View>
    </Animated.View>
  );
}
