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

    // The newest open report, read server-side rather than taken from the
    // request body — a client could otherwise send whatever text it liked
    // straight into the moderator's inbox.
    const { data: report } = await admin
      .from('reports')
      .select('id, reason, message_text, challenge_id, reported_user_id, created_at')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!report) return new Response(JSON.stringify({ ok: true }), { headers: cors });

    const { count } = await admin
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open');

    const key = Deno.env.get('RESEND_API_KEY');
    const to = Deno.env.get('REPORT_EMAIL_TO');
    const from = Deno.env.get('REPORT_EMAIL_FROM');
    if (!key || !to || !from) {
      // Not an error: the app works without mail configured, the report is
      // stored either way. Logged so it's obvious why no mail arrived.
      console.log('report-alert: mail not configured, report stored only', report.id);
      return new Response(JSON.stringify({ ok: true, mailed: false }), { headers: cors });
    }

    const body = [
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
        text: body,
      }),
    });
    if (!res.ok) console.error('report-alert: mail failed', res.status, await res.text());

    return new Response(JSON.stringify({ ok: true, mailed: res.ok }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('report-alert', e);
    // Never surfaced to the reporter: the report is stored, and this is only
    // the notification leg.
    return new Response(JSON.stringify({ ok: false }), { headers: cors });
  }
});
