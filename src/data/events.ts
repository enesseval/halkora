import Constants from 'expo-constants';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { getLocale } from '@/i18n';

/**
 * Ürün metrikleri ve hata kayıtları.
 *
 * KASTEN DAR. Huninin büyük kısmı zaten veritabanından türetilebiliyor:
 * onboarding'i bitirmemiş kullanıcı (profiles.name null), tek kişilik kalmış
 * halka (participants sayısı), katılıp hiç işaretlememiş üye (joined_at vs
 * check_ins), 1. günden 3. güne devam (check_ins.day_number), bildirim
 * açılma oranı (notification_log). Bunlar için olay yazmıyoruz — aynı
 * gerçeği iki yere yazmak, ikisinin ayrışmasıyla biter.
 *
 * Buraya yalnızca veritabanında HİÇ iz bırakmayan şeyler giriyor: bir
 * dialogu kapatmak, bir ekranı açıp vazgeçmek, ve kullanıcıya gösterilip
 * orada ölen hatalar.
 */
export type EventName =
  | 'error'
  | 'notif_prompt'
  | 'feedback_prompt'
  | 'feedback_sent'
  | 'paywall_view'
  | 'rate_prompt'
  | 'ring_create_open';

/**
 * Olayı yazar. Beklenmez, hata fırlatmaz, hiçbir akışı geciktirmez.
 *
 * Ölçüm hiçbir zaman kullanıcının işini bölmemeli: tablo yoksa, ağ yoksa,
 * oturum yoksa sessizce düşer.
 */
export function track(name: EventName, detail?: Record<string, unknown>): void {
  if (!isSupabaseConfigured) return;
  void (async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) return;
      await supabase.from('app_events').insert({
        user_id: userId,
        name,
        detail: detail ?? null,
        app_version: Constants.expoConfig?.version ?? null,
        locale: getLocale(),
      });
    } catch {
      // Yutulur, bilerek.
    }
  })();
}

/**
 * Hata kaydı.
 *
 * `op` kullanıcının ne yapmaya çalıştığı ("checkin", "join", "send_message").
 * Bir hata kodunu tek başına görmek "neden" sorusunu cevaplamıyor; hangi
 * akışta çıktığını bilmek cevaplıyor.
 *
 * KULLANICI İÇERİĞİ YAZILMAZ. Mesaj metni, halka başlığı, isim — hiçbiri.
 * Postgres kısıt ihlalleri hata mesajının içine satır verisi koyabildiği için
 * mesaj 200 karaktere kırpılıyor ve öncelik her zaman kararlı koda veriliyor.
 */
export function trackError(op: string, e: unknown): void {
  let code = '';
  if (e && typeof e === 'object') {
    const o = e as { code?: unknown; message?: unknown; name?: unknown };
    if (typeof o.code === 'string' && o.code) code = o.code;
    else if (typeof o.name === 'string' && o.name) code = o.name;
    if (!code && typeof o.message === 'string') code = o.message;
  } else if (e instanceof Error) {
    code = e.message;
  }
  track('error', { op, code: code.slice(0, 200) });
}
