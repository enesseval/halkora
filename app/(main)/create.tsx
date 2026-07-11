import { useState } from 'react';
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

/** Editable "gün sayısı" pill — sits next to the 7/30 quick-pick chips so the
 * user can type any custom day count (3, 5, 15, ...). */
function DayInput({
  value,
  onChangeText,
  selected,
}: {
  value: string;
  onChangeText: (t: string) => void;
  selected: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: selected ? colors.emberSoft : colors.bgElevated,
        borderColor: selected ? colors.ember : colors.strokeSubtle,
        borderWidth: hairline,
        borderRadius: radius.badge,
        paddingHorizontal: 14,
        paddingVertical: 9,
      }}
    >
      <TextInput
        value={value}
        onChangeText={(t) => onChangeText(t.replace(/[^0-9]/g, '').slice(0, 3))}
        placeholder="Özel"
        placeholderTextColor={colors.textTertiary}
        keyboardType="number-pad"
        maxLength={3}
        style={{
          minWidth: 26,
          padding: 0,
          fontFamily: fonts.bodyMedium,
          fontSize: 15,
          color: selected ? colors.textPrimary : colors.textSecondary,
        }}
      />
      <AppText
        style={{
          ...type.secondary,
          color: selected ? colors.textPrimary : colors.textSecondary,
        }}
      >
        gün
      </AppText>
    </View>
  );
}

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
  // Empty when a 7/30 preset chip is active; holds the raw typed text
  // whenever a custom day count is in use (initially the 14-day default).
  const [daysText, setDaysText] = useState('14');
  const pickPresetDays = (d: number) => {
    setTotalDays(d);
    setDaysText('');
  };
  const changeCustomDays = (raw: string) => {
    setDaysText(raw);
    const n = parseInt(raw, 10);
    if (!Number.isNaN(n) && n > 0) setTotalDays(n);
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
                  selected={totalDays === d && !daysText}
                  onPress={() => pickPresetDays(d)}
                />
              ))}
              <DayInput value={daysText} onChangeText={changeCustomDays} selected={!!daysText} />
            </View>
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
