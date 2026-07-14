import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
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

const DAY_ITEM_HEIGHT = 40;
const DAY_VISIBLE_ROWS = 5; // odd, so one row sits dead-center

/** iOS-style wheel picker for the custom day count (1..max) — replaces a
 * keyboard-and-type text field with something that can't produce an
 * out-of-range value in the first place. */
function DayWheelPicker({
  max,
  value,
  onChange,
}: {
  max: number;
  value: number;
  onChange: (n: number) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const days = useMemo(() => Array.from({ length: max }, (_, i) => i + 1), [max]);
  const [centerIndex, setCenterIndex] = useState(() => Math.max(0, Math.min(max - 1, value - 1)));
  const padTop = DAY_ITEM_HEIGHT * Math.floor(DAY_VISIBLE_ROWS / 2);

  // The `contentOffset` prop alone isn't reliably honored on first mount
  // (react-native-web in particular ignores it), so force the initial
  // scroll position imperatively once the ScrollView actually exists.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: centerIndex * DAY_ITEM_HEIGHT, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-sync the wheel if `value` changed from outside (a 7/30 preset chip
  // tapped while this panel is still open).
  useEffect(() => {
    const idx = Math.max(0, Math.min(days.length - 1, value - 1));
    if (idx !== centerIndex) {
      setCenterIndex(idx);
      scrollRef.current?.scrollTo({ y: idx * DAY_ITEM_HEIGHT, animated: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Tracks + commits the centered value continuously as the wheel moves, not
  // just when a scroll-end event fires — momentum-end detection can be
  // unreliable across platforms/input methods (e.g. web mouse-wheel), so the
  // visible highlighted row and the actual committed value must never
  // depend on catching one specific event just right.
  const commit = (offsetY: number) => {
    const idx = Math.max(0, Math.min(days.length - 1, Math.round(offsetY / DAY_ITEM_HEIGHT)));
    if (idx !== centerIndex) {
      Haptics.selectionAsync().catch(() => {});
      setCenterIndex(idx);
      onChange(days[idx]);
    }
  };

  return (
    <View style={{ height: DAY_ITEM_HEIGHT * DAY_VISIBLE_ROWS }}>
      {/* selection band — fixed in place, marks the centered (selected) row */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: padTop,
          left: 0,
          right: 0,
          height: DAY_ITEM_HEIGHT,
          borderTopWidth: hairline,
          borderBottomWidth: hairline,
          borderColor: colors.strokeSubtle,
        }}
      />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={DAY_ITEM_HEIGHT}
        decelerationRate="fast"
        contentOffset={{ x: 0, y: centerIndex * DAY_ITEM_HEIGHT }}
        contentContainerStyle={{ paddingVertical: padTop }}
        scrollEventThrottle={16}
        onScroll={(e) => commit(e.nativeEvent.contentOffset.y)}
        onMomentumScrollEnd={(e) => commit(e.nativeEvent.contentOffset.y)}
        onScrollEndDrag={(e) => commit(e.nativeEvent.contentOffset.y)}
      >
        {days.map((d, i) => {
          const dist = Math.abs(i - centerIndex);
          return (
            <View key={d} style={{ height: DAY_ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' }}>
              <AppText
                tabular
                style={{
                  fontFamily: dist === 0 ? fonts.displaySemibold : fonts.bodyMedium,
                  fontSize: dist === 0 ? 19 : 16,
                  color:
                    dist === 0 ? colors.textPrimary : dist === 1 ? colors.textSecondary : colors.textTertiary,
                }}
              >
                {d} gün
              </AppText>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ProgressRing draws one SVG path segment per day — an unbounded custom count
// (the input allowed up to 999) made that render cost unbounded too.
const MAX_CUSTOM_DAYS = 100;

const DAY_OPTIONS = [7, 30];
const JOKER_OPTIONS = [
  { v: 0, label: 'Yok' },
  { v: 1, label: '1' },
  { v: 2, label: '2' },
];

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

  const titles = ['Ne yapacaksınız?', 'Kaç gün?', 'Joker hakkı', 'Bahis'];

  const onChangeDate = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (event.type === 'set' && date) setStartDate(date);
  };

  const finish = async () => {
    if (creating) return;
    setCreating(true);
    const pad = (n: number) => String(n).padStart(2, '0');
    const startDateISO = `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}`;
    const startsLabel = isTomorrow
      ? 'Yarın başlıyor'
      : `${formatShortDate(startDate)} başlıyor`;
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
            Atla
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
              {TEMPLATES.map((t) => (
                <Chip
                  key={t.id}
                  label={t.label}
                  emoji={t.emoji}
                  selected={title === t.title}
                  onPress={() => {
                    setTitle(t.title);
                    setAction(t.action);
                  }}
                />
              ))}
            </View>
            <Field label="Challenge adı" value={title} onChangeText={setTitle} placeholder="30 Gün Kitap Okuma" />
            <Field label="Günlük aksiyon" value={action} onChangeText={setAction} placeholder="ör. 20 sayfa oku" />
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
                label={customDays ? `${totalDays} gün` : 'Özel'}
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
                  <Button label="Tamam" variant="secondary" onPress={() => setShowDayPicker(false)} />
                </View>
              </View>
            ) : null}

            <AppText variant="meta" color={colors.textTertiary} style={{ marginTop: 28, marginBottom: 8 }}>
              Başlangıç
            </AppText>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <DatePill
                dayLabel="Bugün"
                dateLabel={formatShortDate(today)}
                selected={isToday}
                onPress={() => {
                  setStartDate(today);
                  setShowPicker(false);
                }}
              />
              <DatePill
                dayLabel="Yarın"
                dateLabel={formatShortDate(tomorrow)}
                selected={isTomorrow}
                onPress={() => {
                  setStartDate(tomorrow);
                  setShowPicker(false);
                }}
              />
              <DatePill
                icon
                dayLabel={isCustom ? formatShortDate(startDate) : 'Takvim'}
                dateLabel={isCustom ? 'seçildi' : 'ileri tarih'}
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
                      label="Tamam"
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
                Başlangıç: {formatLongDate(startDate)}
              </AppText>
            ) : null}

            <AppText variant="meta" color={colors.textTertiary} style={{ marginTop: 28, marginBottom: 8 }}>
              Katılım
            </AppText>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Chip label="Sınırsız" selected={!firstDayJoinOnly} onPress={() => setFirstDayJoinOnly(false)} />
              <Chip label="Sadece ilk gün" selected={firstDayJoinOnly} onPress={() => setFirstDayJoinOnly(true)} />
            </View>
            <AppText variant="meta" color={colors.textTertiary} style={{ marginTop: 8 }}>
              {firstDayJoinOnly
                ? 'İlk gün bitince davet kapanır — sonradan katılınamaz.'
                : 'Herkes istediği zaman katılabilir.'}
            </AppText>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <AppText variant="secondary" style={{ marginTop: 12 }}>
              Joker, kaçırılan bir günü kural içinde telafi eder. Halkada amber görünür — kimse utanmaz.
            </AppText>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              {JOKER_OPTIONS.map((j) => (
                <View key={j.v} style={{ flex: 1 }}>
                  <Chip label={j.label} tint="joker" selected={joker === j.v} onPress={() => setJoker(j.v)} />
                </View>
              ))}
            </View>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <AppText variant="secondary" style={{ marginTop: 12 }}>
              Tamamlayamayan ne yapar? İsteğe bağlı — ama grubu diri tutar.
            </AppText>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <View style={{ flex: 1 }}>
                <Chip label="Doğrudan belirle" selected={stakeMode === 'direct'} onPress={() => setStakeMode('direct')} />
              </View>
              <View style={{ flex: 1 }}>
                <Chip label="Oylamaya sun" selected={stakeMode === 'vote'} onPress={() => setStakeMode('vote')} />
              </View>
            </View>
            <AppText variant="meta" color={colors.textTertiary} style={{ marginTop: 24, marginBottom: 10 }}>
              Hazır öneriler
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {STAKE_PRESETS.map((s) => (
                <Chip
                  key={s.id}
                  label={s.label}
                  emoji={s.emoji}
                  selected={stakeText === s.label}
                  onPress={() => setStakeText(s.label)}
                />
              ))}
            </View>
            <Field label="Kendi bahsini yaz" value={stakeText} onChangeText={setStakeText} placeholder="Kendi bahsini yaz..." />
          </>
        ) : null}
      </ScrollView>

      <View style={{ paddingBottom: spacing.section }}>
        <Button
          label={
            step === 3
              ? creating
                ? 'Oluşturuluyor…'
                : "Challenge'ı oluştur"
              : 'Devam'
          }
          onPress={next}
          disabled={creating || (step === 0 && (!title.trim() || !action.trim()))}
        />
      </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
