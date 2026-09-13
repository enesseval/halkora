import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import { getDict, getLocale } from '@/i18n';

/**
 * Öneri / görüş kutusu — şikayetten (src/data/moderation.ts) ayrı.
 *
 * Şikayet moderasyon işidir: 24 saatlik bir taahhüdü, kendi tablosu ve kendi
 * gelen kutusu vardır. Öneri ürün geri bildirimidir. İkisi aynı yere düşerse
 * moderasyon işi önerilerin arasında kaybolur.
 */
export type FeedbackKind = 'suggestion' | 'bug' | 'other';

/** Veritabanındaki feedback_body_length sınırıyla aynı sayı. */
export const FEEDBACK_MAX = 2000;

export async function submitFeedback(kind: FeedbackKind, body: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) throw new Error(getDict().errors.sessionMissing);

  const text = body.trim().slice(0, FEEDBACK_MAX);
  if (!text) return;

  const { data, error } = await supabase
    .from('feedback')
    .insert({
      user_id: user.id,
      kind,
      body: text,
      // "Hangi sürümde" cevabı olmadan bir hata bildirimi iş görmez.
      app_version: Constants.expoConfig?.version ?? null,
      locale: getLocale(),
    })
    .select('id')
    .single();
  if (error) throw error;

  // Haber ayağı, şikayetteki desenin aynısı: kayıt zaten yazıldı, mailin
  // başarısız olması kullanıcıya "gitmedi" dedirtmemeli. Bu yüzden hatası
  // yutuluyor ve beklenmiyor.
  supabase.functions.invoke('feedback-alert', { body: { feedback_id: data.id } }).catch(() => {});
}
