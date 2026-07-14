import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { colors, fonts, hairline, radius, spacing, type } from '@/theme/tokens';
import {
  useCreateChallenge,
  TEMPLATES,
  STAKE_PRESETS,
} from '@/hooks';
import { addDays, formatLongDate, formatShortDate, isSameDay } from '@/lib/day';
import { AppText, Button, Chip, IconButton, Screen } from '@/components/ui';
import { useT } from '@/i18n';

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

/** The real native wheel (UIPickerView on iOS, a dropdown/dialog on Android —
 * each platform's own convention, matching how DateTimePicker below already
 * varies by platform) for the custom day count (1..max). Replaces an earlier
 * hand-rolled ScrollView-snap approximation that didn't look/feel like
 * Apple's actual picker. */
function DayWheelPicker({
  max,
  value,
  onChange,
}: {
  max: number;
  value: number;
  onChange: (n: number) => void;
}) {
  const { t } = useT();
  const days = useMemo(() => Array.from({ length: max }, (_, i) => i + 1), [max]);

  return (
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

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  autoFocus,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  autoFocus?: boolean;
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

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [action, setAction] = useState('');
  const [totalDays, setTotalDays] = useState(14);
  // False while a 7/30 preset chip is active; true once the wheel picker has
  // been used to pick a custom count (starts already "custom" — 14 isn't a preset).
  const [customDays, setCustomDays] = useState(true);
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

  const isToday = isSameDay(startDate, today);
  const isTomorrow = isSameDay(startDate, tomorrow);
  const isCustom = !isToday && !isTomorrow;
  const [stakeMode, setStakeMode] = useState<'direct' | 'vote'>('direct');
  const [stakeText, setStakeText] = useState('');
  const [creating, setCreating] = useState(false);
  const [firstDayJoinOnly, setFirstDayJoinOnly] = useState(false);

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
      startsLabel: isToday ? undefined : startsLabel,
      stake: stakeText ? { mode: stakeMode, text: stakeText } : undefined,
      firstDayJoinOnly,
    });
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
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
        {step === 3 ? (
          <AppText variant="secondary" color={colors.textSecondary} onPress={finish}>
            {t.common.skip}
          </AppText>
        ) : (
          <View style={{ width: 38 }} />
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
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
            <Field label={t.create.challengeName} value={title} onChangeText={setTitle} placeholder={t.create.challengeNamePlaceholder} />
            <Field label={t.create.dailyActionLabel} value={action} onChangeText={setAction} placeholder={t.create.dailyActionPlaceholder} />
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
                onPress={() => setShowDayPicker((v) => !v)}
              />
            </View>

            {showDayPicker ? (
              <View
                style={{
                  marginTop: 12,
                  backgroundColor: colors.bgSurface,
                  borderRadius: radius.card,
                  borderWidth: hairline,
                  borderColor: colors.strokeSubtle,
                  paddingHorizontal: 8,
                }}
              >
                <DayWheelPicker
                  max={MAX_CUSTOM_DAYS}
                  value={totalDays}
                  onChange={pickCustomDays}
                />
                <View style={{ paddingHorizontal: 8, paddingBottom: 8 }}>
                  <Button label={t.common.done} variant="secondary" onPress={() => setShowDayPicker(false)} />
                </View>
              </View>
            ) : null}

            <AppText variant="meta" color={colors.textTertiary} style={{ marginTop: 28, marginBottom: 8 }}>
              {t.create.start}
            </AppText>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <DatePill
                dayLabel={t.create.todayLabel}
                dateLabel={formatShortDate(today)}
                selected={isToday}
                onPress={() => {
                  setStartDate(today);
                  setShowPicker(false);
                }}
              />
              <DatePill
                dayLabel={t.create.tomorrowLabel}
                dateLabel={formatShortDate(tomorrow)}
                selected={isTomorrow}
                onPress={() => {
                  setStartDate(tomorrow);
                  setShowPicker(false);
                }}
              />
              <DatePill
                icon
                dayLabel={isCustom ? formatShortDate(startDate) : t.create.calendar}
                dateLabel={isCustom ? t.create.selected : t.create.futureDate}
                selected={isCustom}
                onPress={() => setShowPicker((v) => !v)}
              />
            </View>

            {showPicker ? (
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

            {isCustom ? (
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
          </>
        ) : null}

        {step === 3 ? (
          <>
            <AppText variant="secondary" style={{ marginTop: 12 }}>
              {t.create.stakeIntro}
            </AppText>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <View style={{ flex: 1 }}>
                <Chip label={t.create.stakeDirect} selected={stakeMode === 'direct'} onPress={() => setStakeMode('direct')} />
              </View>
              <View style={{ flex: 1 }}>
                <Chip label={t.create.stakeVote} selected={stakeMode === 'vote'} onPress={() => setStakeMode('vote')} />
              </View>
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
            <Field label={t.create.stakeCustomLabel} value={stakeText} onChangeText={setStakeText} placeholder={t.create.stakeCustomPlaceholder} />
          </>
        ) : null}
      </ScrollView>

      <View style={{ paddingBottom: spacing.section }}>
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
      </KeyboardAvoidingView>
    </Screen>
  );
}
