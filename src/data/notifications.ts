import { supabase } from '@/lib/supabase';

/**
 * Bir bildirimin açıldığını işaretler.
 *
 * `logId` push'un içinde geliyor (supabase/functions/_shared/push.ts satırı
 * gönderirken yazıyor ve id'yi payload'a koyuyor). Açılma yalnızca buradan
 * bilinebilir: iOS bir bildirimin kapatıldığını uygulamaya hiç söylemez, o
 * yüzden "yok sayıldı" = gönderilen − açılan, çıkarımla.
 *
 * Sessizce başarısız olur. Ölçüm, kullanıcının gitmek istediği ekrana
 * gitmesinden önemsiz — bu çağrı yüzünden bir yönlendirme gecikmemeli, bu
 * yüzden await edilmeden çağrılıyor.
 *
 * Yalnızca `opened_at` yazılabilir: notification_log'da istemciye tablo geneli
 * bir UPDATE grant'i YOK, sadece o sütunun grant'i var (profiles'taki is_pro
 * dersi). Satırı uydurmak da mümkün değil, ekleme yetkisi hiç verilmedi.
 */
export function markNotificationOpened(logId: string): void {
  void supabase
    .from('notification_log')
    .update({ opened_at: new Date().toISOString() })
    .eq('id', logId)
    .then(undefined, () => {});
}
