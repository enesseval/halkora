// Tells the moderator inbox that a report came in.
//
// Guideline 1.2 asks for a commitment to act on reported content within 24
// hours. That commitment is only keepable if someone finds out a report
// exists — a row quietly landing in a table nobody opens is not moderation.
//
// The client calls this AFTER the report is already stored, so this function
// never writes the report itself: if the mail fails the report still exists,
// and the person who reported it is never told their report was lost when it
// wasn't.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY   — Resend API key; without it this logs and exits cleanly
//   REPORT_EMAIL_TO  — where alerts go (your moderation inbox)
//   REPORT_EMAIL_FROM— a verified sender on your Resend domain
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    // The caller must be a real signed-in user; this endpoint sends mail, so
    // it is not left open to anonymous traffic.
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

    // WHICH report to describe. The caller names it, but every field in the
    // mail is still read from the database — a client cannot put its own text
    // in front of a moderator, which is the property the previous version was
    // protecting. It got there by mailing "the newest open report" instead,
    // and that is wrong as soon as two reports land close together: both
    // invocations describe the second one and the first is never mentioned.
    const body = await req.json().catch(() => ({}));
    const reportId = typeof body?.report_id === 'string' ? body.report_id : null;

    const query = admin
      .from('reports')
      .select('id, reason, message_text, challenge_id, reported_user_id, created_at, reporter_id');
    const { data: report } = reportId
      ? await query.eq('id', reportId).maybeSingle()
      : await query
          .eq('status', 'open')
          .eq('reporter_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

    if (!report) {
      console.log('report-alert: no report found', { reportId, reporter: user.id });
      return new Response(JSON.stringify({ ok: true, mailed: false, reason: 'NO_REPORT' }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
    // You may only trigger the alert for your own report.
    if (report.reporter_id !== user.id) {
      return new Response(JSON.stringify({ error: 'NOT_YOUR_REPORT' }), {
        status: 403,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const { count } = await admin
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open');

    const key = Deno.env.get('RESEND_API_KEY');
    const to = Deno.env.get('REPORT_EMAIL_TO');
    const from = Deno.env.get('REPORT_EMAIL_FROM');
    if (!key || !to || !from) {
      // Not an error: the app works without mail configured, the report is
      // stored either way. Named individually so the log says WHICH secret is
      // missing instead of "something isn't configured".
      console.error('report-alert: mail not configured', {
        RESEND_API_KEY: key ? 'set' : 'MISSING',
        REPORT_EMAIL_TO: to ? 'set' : 'MISSING',
        REPORT_EMAIL_FROM: from ? 'set' : 'MISSING',
        report: report.id,
      });
      return new Response(
        JSON.stringify({ ok: true, mailed: false, reason: 'MAIL_NOT_CONFIGURED' }),
        { headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }

    const mailBody = [
      `Yeni şikayet / New report`,
      ``,
      `Sebep / Reason: ${report.reason}`,
      `Rapor id: ${report.id}`,
      `Halka / Challenge: ${report.challenge_id ?? '—'}`,
      `Bildirilen kullanıcı / Reported user: ${report.reported_user_id}`,
      `Zaman / Time: ${report.created_at}`,
      ``,
      `Mesaj / Message:`,
      report.message_text ?? '—',
      ``,
      `Açık şikayet sayısı / Open reports: ${count ?? '?'}`,
      ``,
      `24 saat içinde incelenmeli. / Must be reviewed within 24 hours.`,
    ].join('\n');

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `[Halkora] Şikayet: ${report.reason}`,
        text: mailBody,
      }),
    });

    // Resend's own words, verbatim, at error level. A rejected send is the
    // single most likely reason a report never reaches the inbox — an
    // unverified sending domain is rejected here, not at configuration time —
    // and until now that answer was one line of console.error nobody read.
    if (!res.ok) {
      const detail = await res.text();
      console.error('report-alert: RESEND REJECTED', res.status, detail, {
        from,
        to,
        report: report.id,
      });
      return new Response(
        JSON.stringify({ ok: true, mailed: false, reason: 'RESEND_REJECTED', status: res.status }),
        { headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }
    console.log('report-alert: mailed', report.id, 'to', to);

    return new Response(JSON.stringify({ ok: true, mailed: true }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('report-alert', e);
    // Never surfaced to the reporter: the report is stored, and this is only
    // the notification leg.
    return new Response(JSON.stringify({ ok: false }), { headers: cors });
  }
});
