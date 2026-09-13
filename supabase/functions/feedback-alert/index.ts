// Öneri / görüş kutusuna bir şey düştüğünü haber verir.
//
// report-alert'ün birebir kardeşi ve aynı kurala uyar: geri bildirim ZATEN
// veritabanına yazılmış olarak gelir, bu fonksiyon onu hiç yazmaz. Mail
// patlarsa geri bildirim yine durur ve kullanıcıya "gitmedi" denmez.
//
// Şikayetten ayrı bir gelen kutusuna gider. İkisi aynı yere düşerse
// moderasyon işi (24 saatlik taahhüt) ürün geri bildiriminin arasında
// kaybolur — ve tersi.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY     — report-alert ile ortak
//   FEEDBACK_EMAIL_TO  — önerilerin gideceği kutu. Tanımlı değilse
//                        REPORT_EMAIL_TO'ya düşer: mail kaybolmaktansa
//                        yanlış kutuya gitsin, ve log hangisi olduğunu yazar.
//   REPORT_EMAIL_FROM  — Resend'de doğrulanmış gönderen (ortak)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const KIND_LABEL: Record<string, string> = {
  suggestion: 'Öneri / Suggestion',
  bug: 'Hata / Bug',
  other: 'Diğer / Other',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    // Çağıran gerçek bir oturum olmalı; bu uç mail gönderiyor, anonim
    // trafiğe açık bırakılmaz.
    const authHeader = req.headers.get('Authorization') ?? '';
    const anon = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const {
      data: { user },
    } = await anon.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'INVALID_SESSION' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // HANGİ geri bildirim: istemci id'yi söylüyor, ama mailin içindeki her
    // alan veritabanından okunuyor. Böylece bir istemci kendi yazdığı metni
    // doğrudan gelen kutusuna sokamaz — report-alert'teki aynı koruma.
    const body = await req.json().catch(() => ({}));
    const feedbackId = typeof body?.feedback_id === 'string' ? body.feedback_id : null;
    if (!feedbackId) {
      return new Response(JSON.stringify({ error: 'NO_ID' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const { data: fb } = await admin
      .from('feedback')
      .select('id, user_id, kind, body, app_version, locale, created_at')
      .eq('id', feedbackId)
      .maybeSingle();

    if (!fb) {
      console.log('feedback-alert: not found', { feedbackId, user: user.id });
      return new Response(JSON.stringify({ ok: true, mailed: false, reason: 'NOT_FOUND' }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
    // Yalnızca kendi geri bildirimin için tetikleyebilirsin.
    if (fb.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'NOT_YOURS' }), {
        status: 403,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const key = Deno.env.get('RESEND_API_KEY');
    const to = Deno.env.get('FEEDBACK_EMAIL_TO') ?? Deno.env.get('REPORT_EMAIL_TO');
    const from = Deno.env.get('REPORT_EMAIL_FROM');
    const usingFallback = !Deno.env.get('FEEDBACK_EMAIL_TO');

    if (!key || !to || !from) {
      // Hata değil: mail yapılandırılmamış olsa da geri bildirim duruyor.
      // Hangi secret'ın eksik olduğu tek tek yazılıyor ki log "bir şey
      // ayarlı değil" demesin.
      console.error('feedback-alert: mail not configured', {
        RESEND_API_KEY: key ? 'set' : 'MISSING',
        FEEDBACK_EMAIL_TO: Deno.env.get('FEEDBACK_EMAIL_TO') ? 'set' : 'MISSING',
        REPORT_EMAIL_TO: Deno.env.get('REPORT_EMAIL_TO') ? 'set' : 'MISSING',
        REPORT_EMAIL_FROM: from ? 'set' : 'MISSING',
        feedback: fb.id,
      });
      return new Response(
        JSON.stringify({ ok: true, mailed: false, reason: 'MAIL_NOT_CONFIGURED' }),
        { headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }
    if (usingFallback) {
      console.warn('feedback-alert: FEEDBACK_EMAIL_TO yok, REPORT_EMAIL_TO kullanılıyor');
    }

    const { count } = await admin
      .from('feedback')
      .select('id', { count: 'exact', head: true });

    const label = KIND_LABEL[fb.kind as string] ?? (fb.kind as string);
    const mailBody = [
      `Yeni geri bildirim / New feedback`,
      ``,
      `Tür / Type: ${label}`,
      `Kayıt id: ${fb.id}`,
      `Kullanıcı / User: ${fb.user_id ?? '—'}`,
      `Sürüm / Version: ${fb.app_version ?? '—'}`,
      `Dil / Locale: ${fb.locale ?? '—'}`,
      `Zaman / Time: ${fb.created_at}`,
      ``,
      `Mesaj / Message:`,
      (fb.body as string) ?? '—',
      ``,
      `Toplam geri bildirim / Total feedback: ${count ?? '?'}`,
    ].join('\n');

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `[Halkora] Geri bildirim: ${label}`,
        text: mailBody,
      }),
    });

    // Resend'in kendi cevabı, olduğu gibi. Doğrulanmamış gönderen alanı
    // burada reddedilir, yapılandırma anında değil — sebebi loglamazsak
    // "mail gelmiyor" diye saatler harcanır.
    if (!res.ok) {
      const detail = await res.text();
      console.error('feedback-alert: RESEND REJECTED', res.status, detail, {
        from,
        to,
        feedback: fb.id,
      });
      return new Response(
        JSON.stringify({ ok: true, mailed: false, reason: 'RESEND_REJECTED', status: res.status }),
        { headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }
    console.log('feedback-alert: mailed', fb.id, 'to', to);

    return new Response(JSON.stringify({ ok: true, mailed: true }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('feedback-alert', e);
    // Kullanıcıya asla yansımaz: kayıt duruyor, bu yalnızca haber ayağı.
    return new Response(JSON.stringify({ ok: false }), { headers: cors });
  }
});
