import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, fonts, hairline, radius } from '@/theme/tokens';
import { AppText, Avatar, AvatarStack } from '@/components/ui';
import { ProgressRing } from '@/components/ProgressRing';
import { useT } from '@/i18n';
import type { Challenge } from '@/data/types';

/**
 * The finish-line share cards — 9:16 "artifacts" the group actually wants to
 * post (Instagram stories etc.). Rendered at 360×640 logical px and captured
 * with the device's pixel ratio (3x phones → 1080×1920 PNG, natively sharp).
 * The swipeable preview + share flow around these lives in
 * app/challenge/[id]/share.tsx (a real transparentModal route — see that
 * file for why).
 *
 * A single fixed layout read as too plain (saha testi bulgusu) — there are
 * now 4 templates sharing the exact same data, swipeable like a story
 * template picker: Classic (the original ring-hero certificate), Bold (a
 * poster-style ember banner), Mono (typography-forward, minimal), and Stats
 * (a data-grid recap). All stay inside the app's own dark/ember system —
 * no photos, no gradients outside the token palette, never red.
 */

export const CARD_W = 360;
export const CARD_H = 640;

export type ShareTemplateId = 'classic' | 'bold' | 'mono' | 'stats';

function Wordmark({ tone = 'default' }: { tone?: 'default' | 'onEmber' }) {
  const onEmber = tone === 'onEmber';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View
        style={{
          width: 14,
          height: 14,
          borderRadius: 7,
          borderWidth: 2.5,
          borderColor: onEmber ? colors.bgBase : colors.ember,
        }}
      />
      <AppText
        style={{
          fontFamily: fonts.displaySemibold,
          fontSize: 13,
          letterSpacing: 4,
          color: onEmber ? colors.bgBase : colors.textSecondary,
        }}
      >
        HALKORA
      </AppText>
    </View>
  );
}

function StatCol({ value, label, tint }: { value: string; label: string; tint?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <AppText
        tabular
        style={{ fontFamily: fonts.displayBold, fontSize: 22, lineHeight: 26, color: tint ?? colors.textPrimary }}
      >
        {value}
      </AppText>
      <AppText
        style={{
          fontFamily: fonts.bodyRegular,
          fontSize: 10,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          color: colors.textTertiary,
        }}
      >
        {label}
      </AppText>
    </View>
  );
}

function Footer({ tone = 'default' }: { tone?: 'default' | 'onEmber' }) {
  return (
    <AppText
      style={{
        marginTop: 18,
        fontFamily: fonts.bodyRegular,
        fontSize: 11,
        letterSpacing: 1.5,
        color: tone === 'onEmber' ? 'rgba(13,14,17,0.55)' : colors.textTertiary,
      }}
    >
      halkora.app
    </AppText>
  );
}

/** Classic — the original ring-hero certificate. */
function ClassicCard({ challenge }: { challenge: Challenge }) {
  const { t } = useT();
  const stats = challenge.finishStats;
  const perfectDays = challenge.advancedStats?.perfectDays ?? 0;

  return (
    <View style={{ width: CARD_W, height: CARD_H, backgroundColor: colors.bgBase, overflow: 'hidden' }}>
      {/* off-canvas decorative rings — depth without leaving the palette */}
      <View
        style={{
          position: 'absolute',
          top: -140,
          right: -140,
          width: 320,
          height: 320,
          borderRadius: 160,
          borderWidth: 1,
          borderColor: colors.strokeSubtle,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: -170,
          left: -170,
          width: 380,
          height: 380,
          borderRadius: 190,
          borderWidth: 1,
          borderColor: colors.emberSoft,
        }}
      />

      {/* hairline inner frame — the "certificate" edge */}
      <View
        style={{
          position: 'absolute',
          top: 14,
          left: 14,
          right: 14,
          bottom: 14,
          borderRadius: radius.card,
          borderWidth: hairline,
          borderColor: colors.strokeSubtle,
        }}
      />

      <View style={{ flex: 1, alignItems: 'center', paddingTop: 44, paddingBottom: 36, paddingHorizontal: 32 }}>
        <Wordmark />

        {/* hero ring — soft ember halo behind, personal honest segments */}
        <View style={{ marginTop: 40, alignItems: 'center', justifyContent: 'center' }}>
          <View
            style={{
              position: 'absolute',
              width: 264,
              height: 264,
              borderRadius: 132,
              backgroundColor: colors.emberSoft,
            }}
          />
          <ProgressRing
            totalDays={challenge.totalDays}
            days={challenge.days}
            size="L"
            diameter={208}
            strokeWidth={13}
            centerContent={
              <View style={{ alignItems: 'center' }}>
                <AppText
                  tabular
                  style={{ fontFamily: fonts.displayBold, fontSize: 56, lineHeight: 62, color: colors.textPrimary }}
                >
                  {challenge.totalDays}
                </AppText>
                <AppText
                  style={{
                    fontFamily: fonts.bodyRegular,
                    fontSize: 11,
                    letterSpacing: 3,
                    textTransform: 'uppercase',
                    color: colors.textSecondary,
                  }}
                >
                  {t.complete.shareCardDays}
                </AppText>
              </View>
            }
          />
        </View>

        {/* title */}
        <View style={{ marginTop: 36, alignItems: 'center', gap: 6 }}>
          <AppText
            numberOfLines={2}
            style={{
              fontFamily: fonts.displaySemibold,
              fontSize: 24,
              lineHeight: 30,
              letterSpacing: -0.4,
              color: colors.textPrimary,
              textAlign: 'center',
            }}
          >
            {challenge.title}
          </AppText>
          <AppText
            style={{
              fontFamily: fonts.bodyRegular,
              fontSize: 12,
              letterSpacing: 2,
              textTransform: 'uppercase',
              color: colors.ember,
            }}
          >
            {t.complete.shareCardCompleted}
          </AppText>
        </View>

        <View style={{ flex: 1 }} />

        {/* stats band */}
        {stats ? (
          <View
            style={{
              flexDirection: 'row',
              alignSelf: 'stretch',
              paddingVertical: 14,
              borderTopWidth: hairline,
              borderBottomWidth: hairline,
              borderColor: colors.strokeSubtle,
            }}
          >
            <StatCol value={`${stats.people}`} label={t.complete.statPeople} />
            <StatCol value={`${stats.checkins}`} label={t.complete.statCheckins} />
            <StatCol value={t.common.percent(stats.completionPct)} label={t.complete.statCompletion} tint={colors.ember} />
          </View>
        ) : null}

        {/* perfect days — small gold-free ember chip, only when earned */}
        {perfectDays > 0 ? (
          <View
            style={{
              marginTop: 14,
              backgroundColor: colors.emberSoft,
              borderRadius: radius.pill,
              paddingHorizontal: 14,
              paddingVertical: 6,
            }}
          >
            <AppText style={{ fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.ember }}>
              {t.complete.shareCardPerfect(perfectDays)}
            </AppText>
          </View>
        ) : null}

        {/* the ring's people */}
        <View style={{ marginTop: 18 }}>
          <AvatarStack people={challenge.participants} max={6} size={30} surface={colors.bgBase} />
        </View>

        <Footer />
      </View>
    </View>
  );
}

/** Bold — a poster-style ember banner up top, the ring anchored below it. */
function BoldCard({ challenge }: { challenge: Challenge }) {
  const { t } = useT();
  const stats = challenge.finishStats;
  const perfectDays = challenge.advancedStats?.perfectDays ?? 0;

  return (
    <View style={{ width: CARD_W, height: CARD_H, backgroundColor: colors.bgBase, overflow: 'hidden' }}>
      <View
        style={{
          alignItems: 'center',
          paddingTop: 44,
          paddingBottom: 28,
          paddingHorizontal: 28,
          backgroundColor: colors.ember,
          borderBottomLeftRadius: 44,
          borderBottomRightRadius: 44,
        }}
      >
        <Wordmark tone="onEmber" />
        <AppText
          numberOfLines={2}
          style={{
            marginTop: 20,
            fontFamily: fonts.displayBold,
            fontSize: 26,
            lineHeight: 30,
            letterSpacing: -0.4,
            color: colors.bgBase,
            textAlign: 'center',
          }}
        >
          {t.complete.shareCardCompleted}
        </AppText>
        <View
          style={{
            marginTop: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: 'rgba(13,14,17,0.16)',
            borderRadius: radius.pill,
            paddingHorizontal: 16,
            paddingVertical: 8,
            maxWidth: '100%',
          }}
        >
          <Feather name="check-circle" size={14} color={colors.bgBase} />
          <AppText
            numberOfLines={1}
            style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.bgBase, flexShrink: 1 }}
          >
            {challenge.title}
          </AppText>
        </View>
      </View>

      <View style={{ flex: 1, alignItems: 'center', paddingTop: 36, paddingBottom: 28, paddingHorizontal: 32 }}>
        <ProgressRing
          totalDays={challenge.totalDays}
          days={challenge.days}
          size="L"
          diameter={172}
          strokeWidth={11}
          centerContent={
            <View style={{ alignItems: 'center' }}>
              <AppText
                tabular
                style={{ fontFamily: fonts.displayBold, fontSize: 44, lineHeight: 48, color: colors.textPrimary }}
              >
                {challenge.totalDays}
              </AppText>
              <AppText
                style={{
                  fontFamily: fonts.bodyRegular,
                  fontSize: 10,
                  letterSpacing: 2.5,
                  textTransform: 'uppercase',
                  color: colors.textSecondary,
                }}
              >
                {t.complete.shareCardDays}
              </AppText>
            </View>
          }
        />

        {stats ? (
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 30 }}>
            <View
              style={{
                backgroundColor: colors.bgElevated,
                borderRadius: radius.badge,
                paddingVertical: 10,
                paddingHorizontal: 14,
                alignItems: 'center',
                minWidth: 78,
              }}
            >
              <AppText tabular style={{ fontFamily: fonts.displayBold, fontSize: 18, color: colors.textPrimary }}>
                {stats.people}
              </AppText>
              <AppText style={{ fontFamily: fonts.bodyRegular, fontSize: 10, color: colors.textTertiary }}>
                {t.complete.statPeople}
              </AppText>
            </View>
            <View
              style={{
                backgroundColor: colors.bgElevated,
                borderRadius: radius.badge,
                paddingVertical: 10,
                paddingHorizontal: 14,
                alignItems: 'center',
                minWidth: 78,
              }}
            >
              <AppText tabular style={{ fontFamily: fonts.displayBold, fontSize: 18, color: colors.textPrimary }}>
                {stats.checkins}
              </AppText>
              <AppText style={{ fontFamily: fonts.bodyRegular, fontSize: 10, color: colors.textTertiary }}>
                {t.complete.statCheckins}
              </AppText>
            </View>
            <View
              style={{
                backgroundColor: colors.emberSoft,
                borderRadius: radius.badge,
                paddingVertical: 10,
                paddingHorizontal: 14,
                alignItems: 'center',
                minWidth: 78,
              }}
            >
              <AppText tabular style={{ fontFamily: fonts.displayBold, fontSize: 18, color: colors.ember }}>
                {t.common.percent(stats.completionPct)}
              </AppText>
              <AppText style={{ fontFamily: fonts.bodyRegular, fontSize: 10, color: colors.ember }}>
                {t.complete.statCompletion}
              </AppText>
            </View>
          </View>
        ) : null}

        <View style={{ flex: 1 }} />

        {perfectDays > 0 ? (
          <AppText
            style={{ marginBottom: 14, fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.joker }}
          >
            {t.complete.shareCardPerfect(perfectDays)}
          </AppText>
        ) : null}

        <AvatarStack people={challenge.participants} max={6} size={30} surface={colors.bgBase} />
        <Footer />
      </View>
    </View>
  );
}

/** Mono — typography-forward and minimal; the ring is a supporting detail, not the hero. */
function MonoCard({ challenge }: { challenge: Challenge }) {
  const { t } = useT();
  const stats = challenge.finishStats;
  const perfectDays = challenge.advancedStats?.perfectDays ?? 0;
  const roster = challenge.participants.slice(0, 3);
  const extra = challenge.participants.length - roster.length;

  return (
    <View style={{ width: CARD_W, height: CARD_H, backgroundColor: colors.bgBase, overflow: 'hidden' }}>
      <View style={{ flex: 1, paddingTop: 44, paddingBottom: 28, paddingHorizontal: 32 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Wordmark />
          <ProgressRing totalDays={challenge.totalDays} days={challenge.days} size="S" diameter={40} strokeWidth={4} />
        </View>

        <View style={{ marginTop: 32 }}>
          <AppText
            tabular
            numberOfLines={1}
            style={{ fontFamily: fonts.displayBold, fontSize: 96, lineHeight: 96, letterSpacing: -3, color: colors.textPrimary }}
          >
            {challenge.totalDays}
          </AppText>
          <AppText
            style={{
              marginTop: 6,
              fontFamily: fonts.bodyRegular,
              fontSize: 12,
              letterSpacing: 2.5,
              textTransform: 'uppercase',
              color: colors.textTertiary,
            }}
          >
            {t.complete.shareCardDays} · {t.complete.shareCardCompleted}
          </AppText>
        </View>

        <View style={{ marginTop: 24, height: hairline, backgroundColor: colors.strokeSubtle }} />

        <AppText
          numberOfLines={2}
          style={{
            marginTop: 20,
            fontFamily: fonts.displaySemibold,
            fontSize: 20,
            lineHeight: 26,
            letterSpacing: -0.3,
            color: colors.textPrimary,
          }}
        >
          {challenge.title}
        </AppText>

        {stats ? (
          <View style={{ flexDirection: 'row', marginTop: 18, gap: 24 }}>
            <StatCol value={`${stats.people}`} label={t.complete.statPeople} />
            <StatCol value={`${stats.checkins}`} label={t.complete.statCheckins} />
            <StatCol value={t.common.percent(stats.completionPct)} label={t.complete.statCompletion} tint={colors.ember} />
          </View>
        ) : null}

        <View style={{ flex: 1 }} />

        {/* roster list instead of overlapping avatars — a quieter, editorial touch */}
        <View>
          {roster.map((p) => (
            <View
              key={p.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 8,
                borderTopWidth: hairline,
                borderColor: colors.strokeSubtle,
              }}
            >
              <Avatar initials={p.initials} size={22} />
              <AppText
                numberOfLines={1}
                style={{ flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textSecondary }}
              >
                {p.name}
              </AppText>
            </View>
          ))}
          {extra > 0 ? (
            <AppText
              style={{
                paddingTop: 8,
                fontFamily: fonts.bodyRegular,
                fontSize: 12,
                color: colors.textTertiary,
              }}
            >
              +{extra}
            </AppText>
          ) : null}
        </View>

        {perfectDays > 0 ? (
          <AppText style={{ marginTop: 12, fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.joker }}>
            {t.complete.shareCardPerfect(perfectDays)}
          </AppText>
        ) : null}

        <Footer />
      </View>
    </View>
  );
}

function StatTile({ value, label, tint }: { value: string; label: string; tint?: string }) {
  return (
    <View
      style={{
        flexBasis: '48%',
        backgroundColor: tint ? colors.emberSoft : colors.bgElevated,
        borderRadius: radius.card,
        paddingVertical: 16,
        paddingHorizontal: 16,
        marginBottom: 12,
      }}
    >
      <AppText
        tabular
        numberOfLines={1}
        style={{ fontFamily: fonts.displayBold, fontSize: 28, lineHeight: 32, color: tint ?? colors.textPrimary }}
      >
        {value}
      </AppText>
      <AppText
        style={{
          marginTop: 4,
          fontFamily: fonts.bodyRegular,
          fontSize: 11,
          letterSpacing: 1,
          textTransform: 'uppercase',
          color: tint ? colors.ember : colors.textTertiary,
        }}
      >
        {label}
      </AppText>
    </View>
  );
}

/** Stats — a data-grid recap; the ring shrinks to a corner badge. */
function StatsCard({ challenge }: { challenge: Challenge }) {
  const { t } = useT();
  const stats = challenge.finishStats;
  const perfectDays = challenge.advancedStats?.perfectDays ?? 0;

  return (
    <View style={{ width: CARD_W, height: CARD_H, backgroundColor: colors.bgBase, overflow: 'hidden' }}>
      <View style={{ flex: 1, paddingTop: 44, paddingBottom: 28, paddingHorizontal: 28 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Wordmark />
          <ProgressRing totalDays={challenge.totalDays} days={challenge.days} size="S" diameter={44} strokeWidth={4} />
        </View>

        <AppText
          numberOfLines={2}
          style={{
            marginTop: 26,
            fontFamily: fonts.displaySemibold,
            fontSize: 24,
            lineHeight: 29,
            letterSpacing: -0.4,
            color: colors.textPrimary,
          }}
        >
          {challenge.title}
        </AppText>
        <AppText
          style={{
            marginTop: 6,
            fontFamily: fonts.bodyRegular,
            fontSize: 12,
            letterSpacing: 2,
            textTransform: 'uppercase',
            color: colors.ember,
          }}
        >
          {t.complete.shareCardCompleted}
        </AppText>

        <View style={{ marginTop: 24, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <StatTile value={`${challenge.totalDays}`} label={t.complete.shareCardDays} />
          {stats ? <StatTile value={`${stats.people}`} label={t.complete.statPeople} /> : null}
          {stats ? <StatTile value={`${stats.checkins}`} label={t.complete.statCheckins} /> : null}
          {stats ? (
            <StatTile value={t.common.percent(stats.completionPct)} label={t.complete.statCompletion} tint={colors.ember} />
          ) : null}
        </View>

        {perfectDays > 0 ? (
          <View
            style={{
              backgroundColor: colors.jokerSoft,
              borderRadius: radius.card,
              paddingVertical: 14,
              paddingHorizontal: 16,
            }}
          >
            <AppText style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.joker }}>
              {t.complete.shareCardPerfect(perfectDays)}
            </AppText>
          </View>
        ) : null}

        <View style={{ flex: 1 }} />

        <AvatarStack people={challenge.participants} max={6} size={28} surface={colors.bgBase} />
        <Footer />
      </View>
    </View>
  );
}

export function ShareCard({ challenge, variant = 'classic' }: { challenge: Challenge; variant?: ShareTemplateId }) {
  switch (variant) {
    case 'bold':
      return <BoldCard challenge={challenge} />;
    case 'mono':
      return <MonoCard challenge={challenge} />;
    case 'stats':
      return <StatsCard challenge={challenge} />;
    default:
      return <ClassicCard challenge={challenge} />;
  }
}
