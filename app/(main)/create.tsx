import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { colors, fonts, hairline, radius, spacing, type } from '@/theme/tokens';
import {
  useCreateChallenge,
  useChallenge,
  TEMPLATES,
  STAKE_PRESETS,
} from '@/hooks';
import { sendInvite, isDuplicateInviteError } from '@/data/invites';
import { isSupabaseConfigured } from '@/lib/supabase';
import { addDays, formatLongDate, formatShortDate, isSameDay } from '@/lib/day';
import type { StakeKind } from '@/data/types';
import { AppText, Button, Chip, IconButton, Screen } from '@/components/ui';
import { useT } from '@/i18n';

/** Head count used only to make the collective-target formula concrete. The
 * real one isn't known while creating (a lobby has no participants yet), so
 * the copy around it says "example". */
const HELP_EXAMPLE_PEOPLE = 5;

/** The three the spec asks for. Midnight is the default and means the plain
 * calendar day — the behaviour every ring had before deadlines existed. */
const DEADLINE_PRESETS = ['10:00', '21:00', '00:00'];

/** Every hour of the day. Minutes are deliberately not offered: a cut-off at
 * 21:30 rather than 21:00 changes nothing anyone can feel, and a minute wheel
 * makes the choice look more consequential than it is. */
const DEADLINE_HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);

/** ~20% of the ring's length, so a 14-day ring suggests 3 and a 7-day one
 * suggests 1 — a starting point the owner can override. */
function suggestedThreshold(totalDays: number): number {
  return Math.max(Math.round(totalDays * 0.2), 0);
}

/** Hour-only wheel for the cut-off, in the same modal shell as the day-count
 * picker so the two custom choices in this flow behave identically. */
function HourPickerSheet({
  visible,
  value,
  onChange,
  onClose,
}: {
  visible: boolean;
  value: string;
  onChange: (hhmm: string) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40 }}
    >
      <BlurView intensity={40} tint="dark" style={{ flex: 1, justifyContent: 'flex-end' }}>
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
              marginBottom: 12,
            }}
          />
          <AppText variant="screenTitle" style={{ fontSize: 22, marginBottom: 4 }}>
            {t.create.deadlineLabel}
          </AppText>
          <Picker
            selectedValue={value}
            onValueChange={(v) => {
              Haptics.selectionAsync().catch(() => {});
              onChange(String(v));
            }}
            itemStyle={{ color: colors.textPrimary, fontFamily: fonts.bodyMedium, fontSize: 19 }}
            style={Platform.OS !== 'ios' ? { color: colors.textPrimary } : undefined}
            dropdownIconColor={colors.textPrimary}
          >
            {DEADLINE_HOURS.map((h) => (
              <Picker.Item key={h} label={h} value={h} color={colors.textPrimary} />
            ))}
          </Picker>
          <Button label={t.common.done} onPress={onClose} />
        </Animated.View>
      </BlurView>
    </Animated.View>
  );
}

/** One start-date choice pill (Bugün / Yarın / custom calendar date). */
function DatePill({
  dayLabel,
  dateLabel,
  selected,
  onPress,
  icon,
}: {
  dayLabel: string;
  dateLabel: string;
  selected: boolean;
  onPress: () => void;
  icon?: boolean;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: selected ? colors.emberSoft : colors.bgElevated,
        borderColor: selected ? colors.ember : colors.strokeSubtle,
        borderWidth: hairline,
        borderRadius: radius.badge,
        paddingVertical: 12,
        alignItems: 'center',
        gap: 3,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        {icon ? (
          <Feather
            name="calendar"
            size={14}
            color={selected ? colors.ember : colors.textSecondary}
          />
        ) : null}
        <AppText
          style={{
            fontFamily: fonts.bodyMedium,
            fontSize: 15,
            color: selected ? colors.textPrimary : colors.textSecondary,
          }}
        >
          {dayLabel}
        </AppText>
      </View>
      <AppText
        tabular
        style={{
          ...type.meta,
          color: selected ? colors.ember : colors.textTertiary,
        }}
      >
        {dateLabel}
      </AppText>
    </Pressable>
  );
}

/** Pill that opens the day-count wheel below (mirrors the "Takvim" DatePill's
 * open/close-a-panel pattern) — shows "Özel" until a custom count is active,
 * then shows the chosen count. */
function DayPickerTrigger({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
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
        gap: 6,
        backgroundColor: selected ? colors.emberSoft : colors.bgElevated,
        borderColor: selected ? colors.ember : colors.strokeSubtle,
        borderWidth: hairline,
        borderRadius: radius.badge,
        paddingHorizontal: 14,
        paddingVertical: 9,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <AppText
        style={{
          ...type.secondary,
          fontFamily: selected ? fonts.bodyMedium : type.secondary.fontFamily,
          color: selected ? colors.textPrimary : colors.textSecondary,
        }}
      >
        {label}
      </AppText>
      <Feather name="chevron-down" size={14} color={selected ? colors.ember : colors.textTertiary} />
    </Pressable>
  );
}

/**
 * Native wheel (UIPickerView on iOS, a dropdown/dialog on Android — each
 * platform's own convention, matching DateTimePicker below) for the custom
 * day count (1..max), presented as a real modal: blurred/dimmed backdrop +
 * slide-up sheet, same as every other picker/action in this app (Ek
 * UsernameSheet) — not an inline panel wedged into the page
 * that pushes everything below it down.
 */
function DayPickerSheet({
  visible,
  max,
  value,
  onChange,
  onClose,
}: {
  visible: boolean;
  max: number;
  value: number;
  onChange: (n: number) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const days = useMemo(() => Array.from({ length: max }, (_, i) => i + 1), [max]);

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40 }}
    >
      <BlurView intensity={40} tint="dark" style={{ flex: 1, justifyContent: 'flex-end' }}>
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
              marginBottom: 12,
            }}
          />
          <AppText variant="screenTitle" style={{ fontSize: 22, marginBottom: 4 }}>
            {t.create.titles[1]}
          </AppText>
          <Picker
            selectedValue={value}
            onValueChange={(v) => {
              Haptics.selectionAsync().catch(() => {});
              onChange(Number(v));
            }}
            itemStyle={{
              color: colors.textPrimary,
              fontFamily: fonts.bodyMedium,
              fontSize: 19,
            }}
            style={Platform.OS !== 'ios' ? { color: colors.textPrimary } : undefined}
            dropdownIconColor={colors.textPrimary}
          >
            {days.map((d) => (
              <Picker.Item key={d} label={t.common.dayCount(d)} value={d} />
            ))}
          </Picker>
          <View style={{ marginTop: 12 }}>
            <Button label={t.common.done} onPress={onClose} />
          </View>
        </Animated.View>
      </BlurView>
    </Animated.View>
  );
}

// ProgressRing draws one SVG path segment per day — an unbounded custom count
// (the input allowed up to 999) made that render cost unbounded too.
const MAX_CUSTOM_DAYS = 100;

const DAY_OPTIONS = [7, 30];
const JOKER_VALUES = [0, 1, 2];

function Dots({ step }: { step: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
      {[0, 1, 2, 3].map((i) => (
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

/**
 * Character caps. Chosen from where these strings actually have to fit: a
 * home card's title line, the ring's centre, and the 360pt share image.
 */
const TITLE_MAX = 40;
const ACTION_MAX = 60;
const STAKE_MAX = 60;

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  autoFocus,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  /** Hard cap, enforced by the native input. */
  maxLength?: number;
}) {
  return (
    <View style={{ marginTop: 20 }}>
      <AppText variant="meta" color={colors.textTertiary} style={{ marginBottom: 8 }}>
        {label}
      </AppText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        autoFocus={autoFocus}
        // These strings are drawn into fixed places — a home card, the ring's
        // centre, a 360pt share image — where the only thing an unbounded
        // title can do is get truncated with an ellipsis. Better to stop the
        // typing than to accept text the app can't show (saha testi bulgusu
        // — "taşacak kısım 3 nokta ile devam ettiriliyor, ama limit
        // koymalıyız"). maxLength is the one place it's right to refuse a
        // keystroke: the native input never shows the character at all, so
        // there is nothing to flicker.
        maxLength={maxLength}
        style={{
          height: 54,
          backgroundColor: colors.bgSurface,
          borderRadius: radius.badge,
          borderWidth: hairline,
          borderColor: value ? colors.ember : colors.strokeSubtle,
          paddingHorizontal: 16,
          color: colors.textPrimary,
          fontFamily: type.bodyMedium.fontFamily,
          fontSize: 17,
        }}
      />
    </View>
  );
}

export default function CreateScreen() {
  const router = useRouter();
  const { t } = useT();
  const create = useCreateChallenge();

  // "Aynı grupla tekrar halka kur" (ROADMAP MVP-sonrası) — the finish screen
  // links here with the just-completed challenge's id; its own data (still
  // in the local cache) prefills the form and, once created, every past
  // participant gets auto-invited (below).
  const { rematchOf } = useLocalSearchParams<{ rematchOf?: string }>();
  const rematchSource = useChallenge(rematchOf);

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState(() => rematchSource?.title ?? '');
  const [action, setAction] = useState(() => rematchSource?.dailyActionRaw ?? '');
  const [totalDays, setTotalDays] = useState(() => rematchSource?.totalDays ?? 14);
  // False while a 7/30 preset chip is active; true once the wheel picker has
  // been used to pick a custom count (starts already "custom" — 14 isn't a preset).
  const [customDays, setCustomDays] = useState(
    () => !DAY_OPTIONS.includes(rematchSource?.totalDays ?? 14),
  );
  const [showDayPicker, setShowDayPicker] = useState(false);
  const pickPresetDays = (d: number) => {
    setTotalDays(d);
    setCustomDays(false);
    setShowDayPicker(false);
  };
  const pickCustomDays = (n: number) => {
    setTotalDays(n);
    setCustomDays(true);
  };
  const today = new Date();
  const tomorrow = addDays(today, 1);
  const [startDate, setStartDate] = useState<Date>(tomorrow);
  const [showPicker, setShowPicker] = useState(false);
  const [joker, setJoker] = useState(1);
  // Faz 1 — kesim saati. Ayrı bir adım yerine bu adımda: "günün nasıl işlediği"
  // sorusu joker ile aynı yere ait, ve varsayılanda bırakılırsa hiçbir ek
  // karmaşıklık göstermiyor.
  const [deadline, setDeadline] = useState('00:00');
  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false);
  // Kurucu-tetiklemeli başlangıç (saha testi bulgusu) — true iken start
  // seçimindeki 3 pill (Bugün/Yarın/Tarih seç) yok sayılır, challenge
  // status='lobby' ile kurulur (startChallenge sonradan gerçek başlangıcı verir).
  // A rematch defaults to a lobby: the old group has to opt in again, and
  // starting on a date would kick off with whoever happened to be around
  // (docs/BAHIS-V2-VE-ROVANS.md §7). Still switchable.
  const [lobby, setLobby] = useState(!!rematchOf);

  // The footer lifts by the measured keyboard height (see the footer's own
  // note); the inset comes off it because Screen already applies one.
  const keyboardHeight = useKeyboardHeight();
  const insets = useSafeAreaInsets();

  const isToday = isSameDay(startDate, today);
  const isTomorrow = isSameDay(startDate, tomorrow);
  const isCustom = !isToday && !isTomorrow;
  const [stakeMode, setStakeMode] = useState<'direct' | 'vote'>(rematchSource?.stake?.mode ?? 'direct');
  const [stakeText, setStakeText] = useState(() => rematchSource?.stake?.text ?? '');
  // Bahis v2 (docs/db-stake-v2.sql): individual = whoever misses more than
  // the threshold pays; collective = the group hits a shared target or
  // nobody does.
  const [stakeKind, setStakeKind] = useState<StakeKind>(rematchSource?.stake?.kind ?? 'individual');
  /**
   * Whether this ring has a stake at all.
   *
   * This used to be expressed by leaving the step alone and pressing "Skip" in
   * the header — which meant someone who started building a stake and then
   * changed their mind had no way to say so, and the individual/collective
   * pair read as a question they had already failed to answer. "No stake" is
   * one of the three answers now, and it starts as the selected one: nothing
   * is quietly switched on for you.
   */
  const [stakeOn, setStakeOn] = useState(!!rematchSource?.stake?.text);
  const [showCollectiveHelp, setShowCollectiveHelp] = useState(false);
  const [collectivePct, setCollectivePct] = useState(
    () => rematchSource?.stake?.collectiveTargetPct ?? 80,
  );
  // Suggested from the length (a 14-day ring tolerates ~3), but the moment
  // the user picks one themselves we stop moving it under them.
  const [thresholdTouched, setThresholdTouched] = useState(false);
  const [thresholdMissed, setThresholdMissed] = useState(
    () => rematchSource?.stake?.thresholdMissed ?? suggestedThreshold(rematchSource?.totalDays ?? 14),
  );
  useEffect(() => {
    if (!thresholdTouched) setThresholdMissed(suggestedThreshold(totalDays));
  }, [totalDays, thresholdTouched]);
  // The suggestion has to be reachable: a fixed 0/1/2/3 row can't offer the
  // 6 a 30-day ring suggests.
  const thresholdOptions = Array.from(
    new Set([0, 1, 2, 3, suggestedThreshold(totalDays)]),
  ).sort((a, b) => a - b);
  const [creating, setCreating] = useState(false);
  const [firstDayJoinOnly, setFirstDayJoinOnly] = useState(() => rematchSource?.firstDayJoinOnly ?? false);

  const titles = t.create.titles;

  const onChangeDate = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (event.type === 'set' && date) setStartDate(date);
  };

  const finish = async () => {
    if (creating) return;
    setCreating(true);
    const pad = (n: number) => String(n).padStart(2, '0');
    const startDateISO = `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}`;
    const startsLabel = isTomorrow ? t.common.startsTomorrow : t.common.startsOn(formatShortDate(startDate));
    const id = await create({
      title,
      dailyAction: action,
      totalDays,
      startTomorrow: !isToday,
      startDateISO,
      joker,
      deadlineTime: deadline,
      startsLabel: isToday ? undefined : startsLabel,
      // stakeOn is the answer to "is there a stake"; stakeText can still hold
      // something typed before backing out, and that must not sneak through.
      stake: stakeOn && stakeText
        ? {
            mode: stakeMode,
            kind: stakeKind,
            text: stakeText,
            thresholdMissed: stakeKind === 'individual' ? thresholdMissed : undefined,
            collectiveTargetPct: stakeKind === 'collective' ? collectivePct : undefined,
          }
        : undefined,
      firstDayJoinOnly,
      lobby,
    });
    // null = the create was rejected (e.g. free-plan cap → paywall shown by
    // the hook). Stay on this screen so the user can retry after upgrading.
    if (!id) {
      setCreating(false);
      return;
    }
    // Rematch: auto-invite everyone who was in the old ring (except me, the
    // new owner — I'm already a participant via `create` above). Best-effort
    // — a failed/duplicate invite here shouldn't block landing on the new
    // ring's invite screen, which still shows the code as a manual fallback.
    if (rematchSource && isSupabaseConfigured) {
      const others = rematchSource.participants.filter((p) => !p.isMe);
      await Promise.all(
        others.map((p) =>
          sendInvite(id, p.id, 'rematch').catch((e) => {
            if (!isDuplicateInviteError(e)) console.error('rematch auto-invite failed', e);
          }),
        ),
      );
    }
    router.replace(`/challenge/${id}/invite`);
  };

  const next = () => (step < 3 ? setStep(step + 1) : finish());
  // Reached either by pushing from Home's "+" (canGoBack -> reveal Home) or by
  // replacing the onboarding fork screen (no history left -> back to "/start"
  // explicitly, same fallback pattern as join/[code].tsx's goBack()).
  const back = () => {
    if (step > 0) {
      setStep(step - 1);
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace('/start');
  };

  return (
    <Screen edges={['top', 'bottom']}>
      {/* header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 8,
        }}
      >
        <IconButton size={38} onPress={back}>
          <Feather name={step === 0 ? 'x' : 'chevron-left'} size={18} color={colors.textPrimary} />
        </IconButton>
        <Dots step={step} />
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
        // Otherwise the first tap while the keyboard is up only dismisses it,
        // and every option on the stake step needs a second tap.
        keyboardShouldPersistTaps="handled"
      >
        <AppText variant="screenTitle" style={{ marginTop: 20 }}>
          {titles[step]}
        </AppText>

        {step === 0 ? (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 20 }}>
              {TEMPLATES().map((tpl) => (
                <Chip
                  key={tpl.id}
                  label={tpl.label}
                  emoji={tpl.emoji}
                  selected={title === tpl.title}
                  onPress={() => {
                    setTitle(tpl.title);
                    setAction(tpl.action);
                  }}
                />
              ))}
            </View>
            <Field
              label={t.create.challengeName}
              value={title}
              onChangeText={setTitle}
              placeholder={t.create.challengeNamePlaceholder}
              maxLength={TITLE_MAX}
            />
            <Field
              label={t.create.dailyActionLabel}
              value={action}
              onChangeText={setAction}
              placeholder={t.create.dailyActionPlaceholder}
              maxLength={ACTION_MAX}
            />
          </>
        ) : null}

        {step === 1 ? (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 20, alignItems: 'center' }}>
              {DAY_OPTIONS.map((d) => (
                <Chip
                  key={d}
                  label={`${d}`}
                  selected={totalDays === d && !customDays}
                  onPress={() => pickPresetDays(d)}
                />
              ))}
              <DayPickerTrigger
                label={customDays ? t.common.dayCount(totalDays) : t.create.custom}
                selected={customDays}
                onPress={() => setShowDayPicker(true)}
              />
            </View>

            <AppText variant="meta" color={colors.textTertiary} style={{ marginTop: 28, marginBottom: 8 }}>
              {t.create.start}
            </AppText>
            <View style={{ flexDirection: 'row', gap: 10, opacity: lobby ? 0.4 : 1 }}>
              <DatePill
                dayLabel={t.create.todayLabel}
                dateLabel={formatShortDate(today)}
                selected={isToday && !lobby}
                onPress={() => {
                  setLobby(false);
                  setStartDate(today);
                  setShowPicker(false);
                }}
              />
              <DatePill
                dayLabel={t.create.tomorrowLabel}
                dateLabel={formatShortDate(tomorrow)}
                selected={isTomorrow && !lobby}
                onPress={() => {
                  setLobby(false);
                  setStartDate(tomorrow);
                  setShowPicker(false);
                }}
              />
              <DatePill
                icon
                dayLabel={isCustom ? formatShortDate(startDate) : t.create.calendar}
                dateLabel={isCustom ? t.create.selected : t.create.futureDate}
                selected={isCustom && !lobby}
                onPress={() => {
                  setLobby(false);
                  setShowPicker((v) => !v);
                }}
              />
            </View>

            {/* Kurucu-tetiklemeli başlangıç (saha testi bulgusu) — tarih
                vermeden kur, grup toplandığında challenge içinden başlat. */}
            <View style={{ marginTop: 10 }}>
              <Chip
                label={t.create.lobbyOption}
                selected={lobby}
                onPress={() => {
                  setLobby(!lobby);
                  setShowPicker(false);
                }}
              />
            </View>
            <AppText variant="meta" color={colors.textTertiary} style={{ marginTop: 8 }}>
              {lobby ? t.create.lobbyOptionHint : t.create.lobbyOptionHintOff}
            </AppText>

            {showPicker && !lobby ? (
              <View
                style={{
                  marginTop: 12,
                  backgroundColor: colors.bgSurface,
                  borderRadius: radius.card,
                  borderWidth: hairline,
                  borderColor: colors.strokeSubtle,
                  padding: Platform.OS === 'ios' ? 8 : 16,
                  alignItems: 'center',
                }}
              >
                <DateTimePicker
                  value={startDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  minimumDate={today}
                  onChange={onChangeDate}
                  themeVariant="dark"
                  accentColor={colors.ember}
                  textColor={colors.textPrimary}
                />
                {Platform.OS === 'ios' ? (
                  <View style={{ alignSelf: 'stretch', marginTop: 4 }}>
                    <Button
                      label={t.common.done}
                      variant="secondary"
                      onPress={() => setShowPicker(false)}
                    />
                  </View>
                ) : null}
              </View>
            ) : null}

            {isCustom && !lobby ? (
              <AppText
                variant="secondary"
                color={colors.textSecondary}
                tabular
                style={{ marginTop: 12 }}
              >
                {t.create.start}: {formatLongDate(startDate)}
              </AppText>
            ) : null}

            <AppText variant="meta" color={colors.textTertiary} style={{ marginTop: 28, marginBottom: 8 }}>
              {t.create.join}
            </AppText>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Chip label={t.create.joinUnlimited} selected={!firstDayJoinOnly} onPress={() => setFirstDayJoinOnly(false)} />
              <Chip label={t.create.joinFirstDayOnly} selected={firstDayJoinOnly} onPress={() => setFirstDayJoinOnly(true)} />
            </View>
            <AppText variant="meta" color={colors.textTertiary} style={{ marginTop: 8 }}>
              {firstDayJoinOnly ? t.create.joinFirstDayOnlyHint : t.create.joinUnlimitedHint}
            </AppText>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <AppText variant="secondary" style={{ marginTop: 12 }}>
              {t.create.jokerIntro}
            </AppText>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              {JOKER_VALUES.map((v) => (
                <View key={v} style={{ flex: 1 }}>
                  <Chip
                    label={v === 0 ? t.create.jokerNone : `${v}`}
                    tint="joker"
                    selected={joker === v}
                    onPress={() => setJoker(v)}
                  />
                </View>
              ))}
            </View>

            <AppText variant="meta" color={colors.textTertiary} style={{ marginTop: 28, marginBottom: 10 }}>
              {t.create.deadlineLabel}
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {DEADLINE_PRESETS.map((v) => (
                <Chip
                  key={v}
                  label={v === '00:00' ? t.create.deadlineMidnight : v}
                  selected={deadline === v}
                  onPress={() => setDeadline(v)}
                />
              ))}
              <Chip
                label={
                  DEADLINE_PRESETS.includes(deadline) ? t.create.deadlineCustom : deadline
                }
                selected={!DEADLINE_PRESETS.includes(deadline)}
                onPress={() => setShowDeadlinePicker(true)}
              />
            </View>
            <AppText variant="meta" color={colors.textTertiary} style={{ marginTop: 10 }}>
              {t.create.deadlineHint}
            </AppText>

            <HourPickerSheet
              visible={showDeadlinePicker}
              value={deadline}
              onChange={setDeadline}
              onClose={() => setShowDeadlinePicker(false)}
            />
          </>
        ) : null}

        {step === 3 ? (
          <>
            <AppText variant="secondary" style={{ marginTop: 12 }}>
              {t.create.stakeIntro}
            </AppText>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 20 }}>
              <View style={{ flex: 1 }}>
                <Chip
                  label={t.create.stakeKindNone}
                  selected={!stakeOn}
                  onPress={() => setStakeOn(false)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Chip
                  label={t.create.stakeKindIndividual}
                  selected={stakeOn && stakeKind === 'individual'}
                  onPress={() => {
                    setStakeOn(true);
                    setStakeKind('individual');
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Chip
                  label={t.create.stakeKindCollective}
                  selected={stakeOn && stakeKind === 'collective'}
                  onPress={() => {
                    setStakeOn(true);
                    setStakeKind('collective');
                  }}
                />
              </View>
            </View>
            {/* only the chosen kind's explanation — showing both made the
                selection read as if it didn't matter */}
            <AppText variant="meta" color={colors.textTertiary} style={{ marginTop: 8 }}>
              {!stakeOn
                ? t.create.stakeKindHintNone
                : stakeKind === 'individual'
                  ? t.create.stakeKindHintIndividual
                  : t.create.stakeKindHintCollective}
            </AppText>

            {!stakeOn ? null : stakeKind === 'individual' ? (
              <>
                <AppText variant="meta" color={colors.textTertiary} style={{ marginTop: 24, marginBottom: 10 }}>
                  {t.create.stakeThresholdLabel}
                </AppText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {thresholdOptions.map((n) => (
                    <Chip
                      key={n}
                      label={t.create.stakeThresholdDay(n)}
                      selected={thresholdMissed === n}
                      onPress={() => {
                        setThresholdTouched(true);
                        setThresholdMissed(n);
                      }}
                    />
                  ))}
                </View>
                <AppText variant="meta" color={colors.textTertiary} style={{ marginTop: 24, marginBottom: 10 }}>
                  {t.create.stakeSuggestions}
                </AppText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {STAKE_PRESETS().map((s) => (
                    <Chip
                      key={s.id}
                      label={s.label}
                      emoji={s.emoji}
                      selected={stakeText === s.label}
                      onPress={() => setStakeText(s.label)}
                    />
                  ))}
                </View>
                <Field
                  label={t.create.stakeCustomLabel}
                  value={stakeText}
                  onChangeText={setStakeText}
                  placeholder={t.create.stakeCustomPlaceholder}
                  maxLength={STAKE_MAX}
                />
              </>
            ) : (
              <>
                {/* "80%" of what, exactly? The number is meaningless without
                    the formula, and the formula is too long to sit inline. */}
                {/* zIndex + absolute box: the explanation floats over the
                    content below instead of pushing it down, so opening it
                    doesn't move the chips out from under your thumb. */}
                <View style={{ zIndex: 10, marginTop: 24, marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <AppText variant="meta" color={colors.textTertiary}>
                      {t.create.stakeCollectiveTargetLabel}
                    </AppText>
                    <Pressable
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setShowCollectiveHelp((v) => !v);
                      }}
                      hitSlop={10}
                    >
                      <Feather
                        name={showCollectiveHelp ? 'x-circle' : 'help-circle'}
                        size={15}
                        color={showCollectiveHelp ? colors.ember : colors.textTertiary}
                      />
                    </Pressable>
                  </View>

                  {showCollectiveHelp ? (
                    <Animated.View
                      entering={FadeIn.duration(160)}
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: 8,
                        backgroundColor: colors.bgElevated,
                        borderRadius: radius.card,
                        borderWidth: hairline,
                        borderColor: colors.strokeSubtle,
                        padding: 14,
                        gap: 10,
                      }}
                    >
                      <AppText variant="bodyMedium" style={{ fontSize: 15 }}>
                        {t.create.stakeCollectiveHelpTitle}
                      </AppText>
                      <AppText variant="meta" color={colors.textSecondary}>
                        {t.create.stakeCollectiveHelpBody}
                      </AppText>
                      <AppText variant="meta" color={colors.textPrimary} tabular>
                        {t.create.stakeCollectiveHelpExample(
                          collectivePct,
                          totalDays,
                          HELP_EXAMPLE_PEOPLE,
                          Math.ceil((collectivePct / 100) * totalDays * HELP_EXAMPLE_PEOPLE),
                          totalDays * HELP_EXAMPLE_PEOPLE,
                        )}
                      </AppText>
                      <AppText variant="meta" color={colors.textTertiary}>
                        {t.create.stakeCollectiveHelpNote}
                      </AppText>
                    </Animated.View>
                  ) : null}
                </View>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {[80, 90, 100].map((pct) => (
                    <Chip
                      key={pct}
                      label={t.common.percent(pct)}
                      selected={collectivePct === pct}
                      onPress={() => setCollectivePct(pct)}
                    />
                  ))}
                </View>
                <Field
                  label={t.create.stakeCustomLabel}
                  value={stakeText}
                  onChangeText={setStakeText}
                  placeholder={t.create.stakeCollectivePlaceholder}
                  maxLength={STAKE_MAX}
                />
              </>
            )}
          </>
        ) : null}
      </ScrollView>

      {/* The footer lifts itself rather than relying on KeyboardAvoidingView,
          which measured its own frame against a Screen that has already eaten
          the bottom inset and left the button under the keyboard on the stake
          step — the one step with text fields near the bottom. The inset is
          subtracted because Screen already applies it and the keyboard height
          is measured from the true screen edge. */}
      <View style={{ paddingBottom: spacing.section + Math.max(keyboardHeight - insets.bottom, 0) }}>
        <Button
          label={
            step === 3
              ? creating
                ? t.create.creating
                : t.create.createCta
              : t.common.continue
          }
          onPress={next}
          disabled={creating || (step === 0 && (!title.trim() || !action.trim()))}
        />
      </View>

      <DayPickerSheet
        visible={showDayPicker}
        max={MAX_CUSTOM_DAYS}
        value={totalDays}
        onChange={pickCustomDays}
        onClose={() => setShowDayPicker(false)}
      />
    </Screen>
  );
}
