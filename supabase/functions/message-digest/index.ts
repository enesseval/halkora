// SUPERSEDED (saha testi bulgusu) — chat messages push instantly again via
// `notify` (supabase/functions/notify, the `messages` table branch). Users
// wanted a notification per message, not an hourly summary. Unschedule this
// function's cron job (docs/db-nudge-and-message-notify.sql:
// `select cron.unschedule('message-digest');`) so it doesn't double-notify
// alongside the instant push. Left in the repo only in case a future batching
// need comes back — not deployed/scheduled going forward.
//
// Supabase Edge Function — batched chat-message digest ("3 yeni mesaj"),
// replacing an instant push per message (too noisy for an active group chat).
//
// Meant to run on a fixed interval via pg_cron + pg_net (docs/PHASE2-SUPABASE.md
// "Ek P") — production: hourly. Testing: every 1 minute, so you don't wait an
// hour to see it work. Same cron job name either way (cron.schedule upserts by
// name), just re-run with a different schedule string to switch.
//
// Each run: for every user with a push token, count new messages (not their
// own) across every challenge they're in, written since their own
// `profiles.last_message_notified_at`. One push per person summarizing the
// total, not one per message — then that timestamp moves to "now" for
// everyone checked (even if they had zero new messages), so the window
// naturally slides forward and the query never has to look back further
// than one interval.
//
// Deployed with --no-verify-jwt (the caller is pg_cron/pg_net, not a
// signed-in user) — WEBHOOK_SECRET stands in for auth, same as
// evening-reminder.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendPush, type PushMessage } from '../_shared/push.ts';
import { secretsMatch } from '../_shared/auth.ts';

const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET');

// Kept in sync by hand with src/i18n/tr.ts + en.ts — see notify/index.ts's
// comment for why this Edge Function can't just import those directly.
const COPY = {
  tr: {
    title: (n: number) => (n === 1 ? '1 yeni mesaj' : `${n} yeni mesaj`),
    bodyOne: (challengeTitle: string) => `"${challengeTitle}" halkasında`,
    bodyMany: (n: number) => `${n} halkanda`,
  },
  en: {
    title: (n: number) => (n === 1 ? '1 new message' : `${n} new messages`),
    bodyOne: (challengeTitle: string) => `In "${challengeTitle}"`,
    bodyMany: (n: number) => `Across ${n} rings`,
  },
} as const;

type Locale = keyof typeof COPY;

function copyFor(locale: string | null | undefined): (typeof COPY)['tr'] {
  return COPY[(locale as Locale) ?? 'tr'] ?? COPY.tr;
}

Deno.serve(async (req) => {
  if (!secretsMatch(WEBHOOK_SECRET, req.headers.get('x-webhook-secret'))) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Bu fonksiyon SAYFALI çalışır. Önceki hali dört sorguyu da filtresiz
    // atıyordu (bütün profiller, bütün katılımcılar, bütün token'lar, bütün
    // yeni mesajlar), sonra O(kullanıcı × mesaj) iç içe döngü kuruyor ve tek
    // halkası olan HER kullanıcı için ayrı bir başlık sorgusu yapıyordu.
    // Kullanıcı sayısı arttıkça önce yavaşlar, sonra Edge Function süre
    // limitine takılır; PostgREST'in satır sınırı devreye girerse de hata
    // vermeden EKSİK çalışırdı — bildirim alması gereken insanlar hiç
    // görünmezdi.

    /** Tek seferde işlenecek alıcı sayısı. */
    const BATCH = 500;
    /** .in(...) listesi GET query string'ine girdiği için parçalıyoruz. */
    const IN_CHUNK = 100;

    const now = new Date().toISOString();

    // Mesajları BİR KEZ çekip halkaya göre indeksliyoruz. Alt sınır, tüm
    // kullanıcıların en eski penceresi: ondan öncesi kimse için "yeni"
    // olamaz.
    const { data: oldest } = await admin
      .from('profiles')
      .select('last_message_notified_at')
      .not('last_message_notified_at', 'is', null)
      .order('last_message_notified_at', { ascending: true })
      .limit(1);
    const earliestCutoff = (oldest?.[0]?.last_message_notified_at as string | undefined) ?? null;
    if (!earliestCutoff) {
      return new Response(JSON.stringify({ notified: 0 }), { status: 200 });
    }

    type NewMsg = { userId: string; createdAt: string };
    const newByChallenge = new Map<string, NewMsg[]>();
    for (let from = 0; ; from += BATCH) {
      const { data: page } = await admin
        .from('messages')
        .select('challenge_id, user_id, created_at')
        .eq('kind', 'message')
        .gt('created_at', earliestCutoff)
        .order('created_at', { ascending: true })
        .range(from, from + BATCH - 1);
      if (!page || page.length === 0) break;
      for (const m of page) {
        const cid = m.challenge_id as string;
        const list = newByChallenge.get(cid) ?? [];
        list.push({ userId: m.user_id as string, createdAt: m.created_at as string });
        newByChallenge.set(cid, list);
      }
      if (page.length < BATCH) break;
    }

    let notified = 0;

    // Alıcı evreni push_tokens: token'ı olmayana zaten gönderilemez, o yüzden
    // sayfalamaya en dar kümeden başlıyoruz.
    for (let from = 0; ; from += BATCH) {
      const { data: tokenRows } = await admin
        .from('push_tokens')
        .select('user_id, token')
        .order('user_id', { ascending: true })
        .range(from, from + BATCH - 1);
      if (!tokenRows || tokenRows.length === 0) break;

      const userIds = tokenRows.map((r) => r.user_id as string);
      const tokenByUser = new Map(tokenRows.map((r) => [r.user_id as string, r.token as string]));

      const [{ data: profiles }, { data: participants }] = await Promise.all([
        admin.from('profiles').select('id, locale, last_message_notified_at').in('id', userIds),
        admin.from('participants').select('challenge_id, user_id').in('user_id', userIds),
      ]);

      if (profiles && profiles.length > 0) {
        const challengesByUser = new Map<string, Set<string>>();
        for (const p of participants ?? []) {
          const uid = p.user_id as string;
          if (!challengesByUser.has(uid)) challengesByUser.set(uid, new Set());
          challengesByUser.get(uid)!.add(p.challenge_id as string);
        }

        // Önce herkesin sayımını çıkar, başlıkları SONRA tek seferde çek.
        type Pending = {
          userId: string;
          token: string;
          locale: string | null;
          total: number;
          challengeIds: string[];
        };
        const pending: Pending[] = [];

        for (const profile of profiles) {
          const uid = profile.id as string;
          const token = tokenByUser.get(uid);
          if (!token) continue;
          const myChallenges = challengesByUser.get(uid);
          if (!myChallenges || myChallenges.size === 0) continue;
          const cutoff = (profile.last_message_notified_at as string) ?? earliestCutoff;

          // Artık bütün mesajları taramıyoruz — yalnızca bu kişinin
          // halkalarının indeksine bakıyoruz.
          const perChallenge = new Map<string, number>();
          for (const cid of myChallenges) {
            let n = 0;
            for (const m of newByChallenge.get(cid) ?? []) {
              if (m.userId === uid) continue; // kendi mesajı bildirim olmaz
              if (m.createdAt <= cutoff) continue; // bu kişinin penceresi daha dar olabilir
              n += 1;
            }
            if (n > 0) perChallenge.set(cid, n);
          }

          const total = Array.from(perChallenge.values()).reduce((a, b) => a + b, 0);
          if (total === 0) continue;
          pending.push({
            userId: uid,
            token,
            locale: profile.locale as string | null,
            total,
            challengeIds: Array.from(perChallenge.keys()),
          });
        }

        // Tek halkalı özetler için gereken başlıkları topluca çek — eskiden
        // bu kullanıcı başına bir sorguydu.
        const titleNeeded = Array.from(
          new Set(pending.filter((x) => x.challengeIds.length === 1).map((x) => x.challengeIds[0])),
        );
        const titleById = new Map<string, string>();
        for (let i = 0; i < titleNeeded.length; i += IN_CHUNK) {
          const { data: rows } = await admin
            .from('challenges')
            .select('id, title')
            .in('id', titleNeeded.slice(i, i + IN_CHUNK));
          for (const r of rows ?? []) titleById.set(r.id as string, (r.title as string) ?? '');
        }

        const messages: PushMessage[] = pending.map((x) => {
          const c = copyFor(x.locale);
          const single = x.challengeIds.length === 1;
          const only = x.challengeIds[0];
          return {
            to: x.token,
            title: c.title(x.total),
            body: single ? c.bodyOne(titleById.get(only) ?? '') : c.bodyMany(x.challengeIds.length),
            // Birden fazla halkadan mesaj varsa açılacak tek bir halka yok;
            // eskiden challengeId undefined bırakılıyordu ve dokunuş HİÇBİR
            // ŞEY yapmıyordu (uygulama nerede kaldıysa orada açılıyordu).
            // Artık açıkça ana ekrana götürüyoruz.
            data: single ? { challengeId: only } : { home: true },
            userId: x.userId,
            kind: 'digest',
            challengeId: single ? only : null,
          } as PushMessage;
        });

        // Parçalama, ticket okuma, ölü token silme ve loglama ortak katmanda.
        if (messages.length > 0) {
          await sendPush(admin, messages);
          notified += messages.length;
        }

        // Kontrol edilen HERKESİN penceresi ilerlesin, yalnız bildirim
        // alanların değil — yoksa sessiz bir kullanıcının alt sınırı hiç
        // kıpırdamaz ve yukarıdaki mesaj sorgusu sürekli büyür.
        for (let i = 0; i < userIds.length; i += IN_CHUNK) {
          await admin
            .from('profiles')
            .update({ last_message_notified_at: now })
            .in('id', userIds.slice(i, i + IN_CHUNK));
        }
      }

      if (tokenRows.length < BATCH) break;
    }

    return new Response(JSON.stringify({ notified }), { status: 200 });
  } catch (e) {
    console.error('message-digest failed', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 200,
    });
  }
});
