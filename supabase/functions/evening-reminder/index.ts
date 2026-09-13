// Supabase Edge Function — the "halkan bekliyor" reminder.
//
// Meant to run HOURLY via pg_cron + pg_net (see docs/PHASE2-SUPABASE.md
// "Ek I"). Each run pushes to people who still owe today's check-in and whose
// own reminder hour is the hour we are in right now.
//
// The hour used to belong to the RING: everyone in it was nudged at the same
// time, an hour before its deadline. That is the right time for someone who
// checks in at the last minute and the wrong time for everyone else — the
// person who always does it over breakfast got told at eight in the evening,
// hours after it stopped being useful, every single day.
//
// So the hour belongs to the PERSON now. Their last 14 days of check-ins in
// that ring say when they normally do it; the reminder lands an hour after
// that, once they are late by their own standard, and it is worded gently.
// Someone with no habit yet — or whose habit is already past the ring's own
// cut-off — keeps the old deadline-minus-one-hour slot, worded as the last
// call it actually is.
//
// Still one push per person per day (profiles.last_reminder_date), however
// many rings are waiting: the body says how many.
//
// KİMSENİN İLK GÜNÜ HATIRLATILMAZ. Sabah halkayı kuran birine akşam "bugün
// check-in yapmadın" demek, halka 11 saatlikken en sert metni göndermek
// demekti — üstelik alışkanlık verisi olmadığı için tam da son-çağrı metnine
// düşüyordu. Kişinin o halkadaki kendi ilk günü (participants.joined_at)
// sessiz; hatırlatma ikinci günden itibaren başlar.
//
// Ve metin artık gerçek duruma bağlı: halkadaki kaç kişinin bugünü
// işaretlediği, ya da tek kişilikse serinin kaç günlük olduğu. Jenerik bir
// "halkan bekliyor" ikinci haftada görünmez oluyor; "3 kişiden 2'si bugünü
// işaretledi" olmuyor.
//
// Deployed with --no-verify-jwt (the caller is pg_cron/pg_net, not a
// signed-in user) — WEBHOOK_SECRET stands in for auth. Without it, anyone
// who finds this function's URL could trigger it on demand and spam every
// pending participant.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendPush, type PushMessage } from '../_shared/push.ts';
import { secretsMatch } from '../_shared/auth.ts';

const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET');

/** How far back to look for someone's usual check-in time. */
const HABIT_DAYS = 14;
/**
 * How many check-ins it takes before we claim to know someone's habit. Two
 * mornings in a row is a coincidence; the reminder should not move itself
 * across the day on that basis.
 */
const HABIT_MIN_SAMPLES = 3;
/** How long after their usual hour someone counts as late. */
const HABIT_GRACE_HOURS = 1;

// Bu metinler YALNIZCA burada yaşıyor — uygulama arayüzü değil, sunucunun
// yazdığı push kopyası (src/i18n'de karşılıkları yok). İki dil de bu tabloda,
// birlikte değişirler.
//
// Her kova bir DİZİ, tek metin değil. Tek metin ikinci haftada görünmez
// oluyordu; aynı bildirimi her akşam gören insan onu okumayı bırakıyor.
// Seçim aşağıdaki pick() ile dönüyor.
//
// Kovalar güçlüden zayıfa: sosyal sinyal > seri > jenerik. Halkadaki başka
// birinin bugünü işaretlemiş olması, uygulamanın söyleyebileceği en ikna edici
// şey; onu söyleyebiliyorsak jenerik metne düşmüyoruz.
type Tone = 'habit' | 'lastCall';

/**
 * Havuzların şekli açıkça yazılı, `as const` çıkarımına bırakılmadı: iki dilin
 * tuple tipleri birbirinden farklı çıkıyor ve pick()'in tip değişkeni ortak
 * üst tipe ({}) düşüyordu. Açık tip hem bunu çözer hem de yeni bir metin
 * eklerken kovanın imzasını zorunlu kılar.
 */
type Pools = {
  title: Record<Tone, readonly string[]>;
  plain: Record<Tone, readonly string[]>;
  social: Record<Tone, readonly ((done: number, total: number) => string)[]>;
  streak: Record<Tone, readonly ((n: number) => string)[]>;
  multi: Record<Tone, readonly ((n: number) => string)[]>;
};

const COPY: Record<'tr' | 'en', Pools> = {
  tr: {
    title: {
      habit: ['Bugünü işaretlemedin', 'Halkan hazır', 'Küçük bir hatırlatma'],
      lastCall: ['Halkan bekliyor', 'Gün bitiyor', 'Son çağrı'],
    },
    plain: {
      habit: [
        'Genelde bu saatlerde yapıyorsun — halkan hazır.',
        'Her zamanki saatin geçti, bugün henüz işaretli değil.',
        'Bugünü işaretlemeyi unuttun galiba.',
      ],
      lastCall: [
        'Bugün için check-in yapmadın — halka seni bekliyor.',
        'Gün bitmeden bir dokunuş kaldı.',
        'Bugünü işaretlemek için son fırsat.',
      ],
    },
    social: {
      habit: [
        (done: number, total: number) => `Halkanda ${done}/${total} bugünü tamamladı.`,
        (done: number, _total: number) => `${done} kişi bugünü işaretledi bile.`,
      ],
      lastCall: [
        (done: number, total: number) => `${done}/${total} kişi bugünü işaretledi — sıra sende.`,
        (done: number, _total: number) => `Halkandan ${done} kişi bugünü tamamladı, gün bitiyor.`,
      ],
    },
    streak: {
      habit: [
        (n: number) => `${n} günlük serin sürüyor, bugün henüz işaretli değil.`,
        (n: number) => `${n} gündür yapıyorsun — bugünü de ekle.`,
      ],
      lastCall: [
        (n: number) => `${n} günlük serin var — bugün de bozma.`,
        (n: number) => `${n} gündür aralıksız. Bugün kalan tek eksik.`,
      ],
    },
    multi: {
      habit: [
        (n: number) => `${n} halkada bugünü henüz işaretlemedin.`,
        (n: number) => `${n} halkan bugünü bekliyor.`,
      ],
      lastCall: [
        (n: number) => `${n} halka bugün seni bekliyor.`,
        (n: number) => `${n} halkada bugün hâlâ işaretsiz.`,
      ],
    },
  },
  en: {
    title: {
      habit: ["Today isn't marked yet", 'Your ring is ready', 'A small reminder'],
      lastCall: ['Your ring is waiting', 'The day is ending', 'Last call'],
    },
    plain: {
      habit: [
        'This is usually when you do it — your ring is ready.',
        "Your usual time has passed, and today isn't marked yet.",
        'Looks like you forgot to mark today.',
      ],
      lastCall: [
        "You haven't checked in today — your ring is waiting on you.",
        "One tap left before the day's out.",
        'Last chance to mark today.',
      ],
    },
    social: {
      habit: [
        (done: number, total: number) => `${done}/${total} in your ring finished today.`,
        (done: number, _total: number) => `${done} already marked today.`,
      ],
      lastCall: [
        (done: number, total: number) => `${done}/${total} marked today — you're up.`,
        (done: number, _total: number) => `${done} in your ring finished today, and the day is ending.`,
      ],
    },
    streak: {
      habit: [
        (n: number) => `Your ${n}-day streak is alive, but today isn't marked.`,
        (n: number) => `${n} days running — add today to it.`,
      ],
      lastCall: [
        (n: number) => `You're on a ${n}-day streak — don't break it today.`,
        (n: number) => `${n} days straight. Today is the only one missing.`,
      ],
    },
    multi: {
      habit: [
        (n: number) => `${n} rings are still unmarked today.`,
        (n: number) => `${n} of your rings are waiting on today.`,
      ],
      lastCall: [
        (n: number) => `${n} rings are waiting on you today.`,
        (n: number) => `${n} rings are still unmarked today.`,
      ],
    },
  },
};

type Locale = keyof typeof COPY;

function copyFor(locale: string | null | undefined): Pools {
  return COPY[(locale as Locale) ?? 'tr'] ?? COPY.tr;
}

/** Kullanıcı id'sini sabit bir sayıya indirger — herkesin havuzda farklı bir
 *  yerden başlaması için. */
function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Havuzdan bugünün metnini seçer.
 *
 * (hash + günIndeksi) % uzunluk — rastgele değil, DÖNEN bir seçim. Saf hash
 * olsaydı iki gün üst üste aynı metnin gelme ihtimali 1/N olurdu; burada
 * indeks her gün tam olarak bir artıyor, yani havuz tükenmeden hiçbir metin
 * tekrar etmiyor. Farklı kullanıcılar farklı offsetten başladığı için de
 * herkes aynı gün aynı cümleyi görmüyor.
 */
function pick<T>(pool: readonly T[], userId: string, dayIndex: number): { value: T; index: number } {
  const index = (hashCode(userId) + dayIndex) % pool.length;
  return { value: pool[index], index };
}

/**
 * The ring's own last-call hour — the hour before its deadline. Midnight is
 * the exception and keeps 20:00: it is the default every ring has, and moving
 * it to 23:00 would silently start pushing people at night.
 */
function deadlineHour(deadline: string | null): number {
  const hhmm = (deadline ?? '00:00').slice(0, 5);
  if (hhmm === '00:00') return 20;
  const hour = Number(hhmm.slice(0, 2));
  return (hour + 23) % 24;
}

/** The opening date of the cycle we're in, as "YYYY-MM-DD". Mirrors
 * public.challenge_cycle_start() and src/lib/cycle.ts — one formula, four
 * copies, change them together. */
function cycleStartFor(timeZone: string, deadline: string, when: Date = new Date()): string {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(when);
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(when);
  if (time >= deadline) return date;
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * The hour of the clock in `timeZone`, 0-23.
 *
 * The `% 24` is not cosmetic: `hour12: false` reports midnight as "24" in
 * several ICU versions, and a ring whose deadline made its last-call hour 0
 * could therefore never match the current hour — its reminder simply never
 * fired.
 */
function hourIn(timeZone: string, when: Date = new Date()): number {
  return (
    Number(
      new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hour12: false }).format(when),
    ) % 24
  );
}

/** The middle value — not the mean, which one 3am check-in drags across the
 * whole day. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

Deno.serve(async (req) => {
  // Fail closed: no secret configured means no calls are trusted.
  if (!secretsMatch(WEBHOOK_SECRET, req.headers.get('x-webhook-secret'))) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // NOT .eq('status','active'): a "starts tomorrow" challenge is created as
    // 'upcoming' and nothing ever flips the DB column to 'active' (the client
    // derives live status from dates) — filtering on 'active' would silently
    // exclude those groups forever. The day-window check below already skips
    // challenges that haven't started or have run past total_days; only an
    // explicit early-end ('completed', set by end_challenge_early) must be
    // excluded here.
    const { data: challenges } = await admin
      .from('challenges')
      .select('id, start_date, timezone, total_days, deadline_time')
      .neq('status', 'completed');

    // Every ring is considered on every run now, not only the ones at their
    // own last-call hour: the hour that matters is the person's, and two
    // people in the same ring can have different ones.
    const live = (challenges ?? []).filter((c) => {
      // Lobby (docs/db-lobby.sql): start_date is null until the owner starts
      // it. Without this the Invalid Date below makes currentDay NaN, and NaN
      // comparisons are always false — the "hasn't started yet" skip would
      // never fire and the group would be reminded about a ring nobody has
      // started.
      if (!c.start_date) return false;
      const timeZone = c.timezone as string;
      const deadline = ((c.deadline_time as string | null) ?? '00:00').slice(0, 5);
      const startDate = new Date(`${c.start_date as string}T00:00:00Z`);
      const cycle = new Date(`${cycleStartFor(timeZone, deadline)}T00:00:00Z`);
      const day = Math.round((cycle.getTime() - startDate.getTime()) / 86_400_000) + 1;
      if (day < 1 || day > (c.total_days as number)) return false;
      (c as Record<string, unknown>).currentDay = day;
      return true;
    });
    if (live.length === 0) {
      return new Response(JSON.stringify({ reminded: 0 }), { status: 200 });
    }

    /** Everyone who still owes today's check-in, per ring. */
    const pending: {
      userId: string;
      participantId: string;
      challengeId: string;
      timeZone: string;
      lastCallHour: number;
      /** Bugün halkada kaç kişi işaretledi / halka kaç kişilik. */
      doneCount: number;
      totalCount: number;
      /** Bu kişinin halkadaki gün numarası — seri hesabı için. */
      currentDay: number;
    }[] = [];

    // Katılımcılar ve bugünün check-in'leri TOPLUCA çekiliyor. Eskiden bu
    // döngünün içinde halka başına iki sorgu vardı: saatlik cron 1000 canlı
    // halkada çalışma başına 2000 istek demekti. Artık halka sayısından
    // bağımsız, sabit sayıda sorgu.
    const liveIds = live.map((c) => c.id as string);
    /** .in(...) listesi GET query string'ine giriyor, o yüzden parçalıyoruz. */
    const IN_CHUNK = 100;

    const participantsByChallenge = new Map<
      string,
      { id: string; user_id: string; joined_at: string | null }[]
    >();
    for (let i = 0; i < liveIds.length; i += IN_CHUNK) {
      const { data } = await admin
        .from('participants')
        .select('id, user_id, joined_at, challenge_id')
        .in('challenge_id', liveIds.slice(i, i + IN_CHUNK));
      for (const row of data ?? []) {
        const cid = row.challenge_id as string;
        const list = participantsByChallenge.get(cid) ?? [];
        list.push({
          id: row.id as string,
          user_id: row.user_id as string,
          joined_at: row.joined_at as string | null,
        });
        participantsByChallenge.set(cid, list);
      }
    }

    // Her halkanın kendi currentDay'i farklı. Gün filtresini tamamen
    // kaldırıp hepsini tek sorguda çekmek, halkaların BÜTÜN geçmiş
    // check-in'lerini indirmek olurdu — N+1'den beteri. Bunun yerine
    // halkaları gün numarasına göre grupluyoruz: sorgu sayısı halka
    // sayısıyla değil, sahadaki FARKLI gün numarası sayısıyla orantılı
    // (pratikte bir avuç), ve hiçbir fazladan satır inmiyor.
    const challengesByDay = new Map<number, string[]>();
    for (const c of live) {
      const day = (c as Record<string, unknown>).currentDay as number;
      const list = challengesByDay.get(day) ?? [];
      list.push(c.id as string);
      challengesByDay.set(day, list);
    }

    const doneByChallengeDay = new Map<string, Set<string>>();
    for (const [day, ids] of challengesByDay) {
      for (let i = 0; i < ids.length; i += IN_CHUNK) {
        const { data } = await admin
          .from('check_ins')
          .select('participant_id, challenge_id')
          .eq('day_number', day)
          .in('challenge_id', ids.slice(i, i + IN_CHUNK));
        for (const row of data ?? []) {
          const key = `${row.challenge_id as string}:${day}`;
          const set = doneByChallengeDay.get(key) ?? new Set<string>();
          set.add(row.participant_id as string);
          doneByChallengeDay.set(key, set);
        }
      }
    }

    for (const challenge of live) {
      const currentDay = (challenge as Record<string, unknown>).currentDay as number;
      const timeZone = challenge.timezone as string;
      const lastCallHour = deadlineHour(challenge.deadline_time as string | null);

      const participants = participantsByChallenge.get(challenge.id as string);
      if (!participants || participants.length === 0) continue;

      // Bugünün döngü tarihi — katılım günüyle karşılaştıracağız.
      const deadline = ((challenge.deadline_time as string | null) ?? '00:00').slice(0, 5);
      const todayCycle = cycleStartFor(timeZone, deadline);

      const doneIds =
        doneByChallengeDay.get(`${challenge.id as string}:${currentDay}`) ?? new Set<string>();

      for (const p of participants) {
        if (doneIds.has(p.id)) continue;

        // İlk gün sessiz. Sabah kurulan halkanın akşamı "bugün check-in
        // yapmadın" demek, insanın daha halkayla tanışmadığı bir anda en sert
        // metni göndermekti. Karşılaştırma takvim günüyle değil DÖNGÜ günüyle:
        // deadline'ı gece yarısından farklı olan bir halkada gün sınırı başka
        // yerde, ve iki yerde farklı hesaplamak tam da sessiz kalması gereken
        // günü kaçırmak olurdu.
        if (p.joined_at && cycleStartFor(timeZone, deadline, new Date(p.joined_at)) === todayCycle) {
          continue;
        }

        pending.push({
          userId: p.user_id,
          participantId: p.id,
          challengeId: challenge.id as string,
          timeZone,
          lastCallHour,
          doneCount: doneIds.size,
          totalCount: participants.length,
          currentDay,
        });
      }
    }

    if (pending.length === 0) {
      return new Response(JSON.stringify({ reminded: 0 }), { status: 200 });
    }

    // What time do these people normally check in? One query for all of them,
    // read per participant — check_ins hangs off participant_id, so this is
    // already scoped to "this person, in this ring".
    const since = new Date(Date.now() - HABIT_DAYS * 86_400_000).toISOString();
    const { data: history } = await admin
      .from('check_ins')
      .select('participant_id, created_at, day_number')
      .in('participant_id', pending.map((p) => p.participantId))
      .gte('created_at', since);

    // Read in the RING's timezone, not the server's: "when do you usually do
    // this" is a question about the person's own day.
    const tzByParticipant = new Map(pending.map((p) => [p.participantId, p.timeZone]));
    const hoursByParticipant = new Map<string, number[]>();
    const daysByParticipant = new Map<string, Set<number>>();
    for (const row of history ?? []) {
      const pid = row.participant_id as string;
      const tz = tzByParticipant.get(pid);
      if (!tz) continue;
      const list = hoursByParticipant.get(pid) ?? [];
      list.push(hourIn(tz, new Date(row.created_at as string)));
      hoursByParticipant.set(pid, list);
      const days = daysByParticipant.get(pid) ?? new Set<number>();
      days.add(row.day_number as number);
      daysByParticipant.set(pid, days);
    }

    /** Dünden geriye kaç gün aralıksız işaretlenmiş. Joker de sayılır —
     *  serinin korunması jokerin varlık sebebi. */
    const streakOf = (participantId: string, currentDay: number): number => {
      const days = daysByParticipant.get(participantId);
      if (!days) return 0;
      let n = 0;
      for (let d = currentDay - 1; d >= 1 && days.has(d); d--) n += 1;
      return n;
    };

    // Whose hour is now? A ring counts if THIS person's reminder hour for it
    // is the hour its timezone is currently in.
    const dueNow = new Map<
      string,
      {
        count: number;
        challengeId: string;
        habit: boolean;
        doneCount: number;
        totalCount: number;
        streak: number;
      }
    >();
    for (const p of pending) {
      const hours = hoursByParticipant.get(p.participantId) ?? [];
      // Their usual hour, plus grace — but never past the ring's own last
      // call, which is the latest a reminder can still be acted on.
      const habitHour =
        hours.length >= HABIT_MIN_SAMPLES ? median(hours) + HABIT_GRACE_HOURS : null;
      const useHabit = habitHour !== null && habitHour < p.lastCallHour;
      const myHour = useHabit ? (habitHour as number) : p.lastCallHour;
      if (hourIn(p.timeZone) !== myHour) continue;

      const seen = dueNow.get(p.userId);
      if (seen) {
        seen.count += 1;
        // Urgency is the louder of the two: one ring at its last call makes
        // the whole push the last-call one.
        seen.habit = seen.habit && useHabit;
      } else {
        dueNow.set(p.userId, {
          count: 1,
          challengeId: p.challengeId,
          habit: useHabit,
          doneCount: p.doneCount,
          totalCount: p.totalCount,
          streak: streakOf(p.participantId, p.currentDay),
        });
      }
    }

    if (dueNow.size === 0) {
      return new Response(JSON.stringify({ reminded: 0 }), { status: 200 });
    }

    const userIds = Array.from(dueNow.keys());
    const [{ data: profiles }, { data: tokenRows }] = await Promise.all([
      admin.from('profiles').select('id, last_reminder_date, locale').in('id', userIds),
      admin.from('push_tokens').select('user_id, token').in('user_id', userIds),
    ]);
    const tokenByUser = new Map((tokenRows ?? []).map((r) => [r.user_id as string, r.token as string]));

    // A user can be in challenges across different timezones; dedupe against
    // *this device's* UTC date so a person is never reminded twice in one
    // real calendar day even if two of their challenges come due in different
    // timezones within the same run window.
    const nowUtcDate = new Date().toISOString().slice(0, 10);

    // Havuz içindeki dönme bu sayıya bağlı: her takvim gününde bir artar, yani
    // seçilen metin her gün bir sonrakine kayar ve havuz tükenmeden tekrar
    // etmez.
    const dayIndex = Math.floor(Date.now() / 86_400_000);

    const messages: PushMessage[] = [];
    const remindedIds: string[] = [];

    for (const profile of profiles ?? []) {
      if (profile.last_reminder_date === nowUtcDate) continue;
      const token = tokenByUser.get(profile.id as string);
      if (!token) continue;
      const due = dueNow.get(profile.id as string);
      if (!due) continue;

      const c = copyFor(profile.locale as string | null);
      const userId = profile.id as string;
      const tone = due.habit ? 'habit' : 'lastCall';

      // Güçlüden zayıfa. Halkadaki başka birinin bugünü bitirmiş olması
      // söylenebilecek en ikna edici şey; onu söyleyebiliyorsak jenerik
      // metne düşmüyoruz. Tek kişilik halkada sosyal sinyal yok, seri var.
      let body: string;
      let variant: string;
      if (due.count > 1) {
        const p = pick(c.multi[tone], userId, dayIndex);
        body = p.value(due.count);
        variant = `multi.${tone}.${p.index}`;
      } else if (due.totalCount > 1 && due.doneCount > 0) {
        const p = pick(c.social[tone], userId, dayIndex);
        body = p.value(due.doneCount, due.totalCount);
        variant = `social.${tone}.${p.index}`;
      } else if (due.streak >= 2) {
        const p = pick(c.streak[tone], userId, dayIndex);
        body = p.value(due.streak);
        variant = `streak.${tone}.${p.index}`;
      } else {
        const p = pick(c.plain[tone], userId, dayIndex);
        body = p.value;
        variant = `plain.${tone}.${p.index}`;
      }

      const title = pick(c.title[tone], userId, dayIndex).value;

      messages.push({
        to: token,
        title,
        body,
        data: { challengeId: due.challengeId },
        userId,
        kind: 'reminder',
        challengeId: due.challengeId,
        variant,
      });
      remindedIds.push(userId);
    }

    if (messages.length === 0) {
      return new Response(JSON.stringify({ reminded: 0 }), { status: 200 });
    }

    const { sent, dropped } = await sendPush(admin, messages);

    await admin.from('profiles').update({ last_reminder_date: nowUtcDate }).in('id', remindedIds);

    return new Response(JSON.stringify({ reminded: sent, dropped }), { status: 200 });
  } catch (e) {
    console.error('evening-reminder failed', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 200,
    });
  }
});
