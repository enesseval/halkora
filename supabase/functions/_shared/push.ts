// Tek push gönderim yolu — her Edge Function buradan geçer.
//
// Daha önce her fonksiyon Expo'ya kendi fetch'ini atıyor ve DÖNEN CEVABI HİÇ
// OKUMUYORDU. İki sonucu vardı:
//
//  1. Ölü token'lar sonsuza kadar birikiyordu. Uygulamayı silen bir kullanıcı
//     için Expo her seferinde DeviceNotRegistered döner; kimse okumadığı için
//     o token push_tokens'ta kalır ve her gönderimde boşa istek olur.
//  2. Hiçbir şey ölçülemiyordu. Kaç bildirim gitti sorusunun cevabı yoktu.
//
// Burası ikisini de çözer: önce notification_log satırlarını yazar (id'leri
// push payload'ına koyar ki istemci açılışta hangi satırı işaretleyeceğini
// bilsin), sonra gönderir, sonra ticket'ları okur — hata dönen mesajın log
// satırını siler ve token'ı gerekiyorsa temizler.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** Expo'nun tek istekte kabul ettiği mesaj sayısı. */
const BATCH = 100;

export type PushMessage = {
  to: string;
  title: string;
  subtitle?: string;
  body: string;
  data?: Record<string, unknown>;
  /** notification_log için — gönderilen kişi. */
  userId: string;
  /** 'reminder' | 'message' | 'nudge' | 'invite' | 'digest' */
  kind: string;
  challengeId?: string | null;
  /** Hangi metin varyantı seçildi; varyasyonun işe yarayıp yaramadığı bununla ölçülür. */
  variant?: string | null;
};

type Ticket = { status: string; id?: string; details?: { error?: string } };

/**
 * Gönderir, loglar, ölü token'ları temizler.
 *
 * Hiçbir zaman throw etmez: bildirim gönderimi çağıran akışın ana işi değil,
 * bir yan etki. Expo'ya ulaşılamaması check-in'i veya mesajı bozmamalı.
 */
export async function sendPush(
  admin: SupabaseClient,
  messages: PushMessage[],
): Promise<{ sent: number; dropped: number }> {
  if (messages.length === 0) return { sent: 0, dropped: 0 };

  // 1) Önce log satırları — id'ler payload'a girecek.
  const { data: logRows } = await admin
    .from('notification_log')
    .insert(
      messages.map((m) => ({
        user_id: m.userId,
        kind: m.kind,
        challenge_id: m.challengeId ?? null,
        variant: m.variant ?? null,
      })),
    )
    .select('id');

  // Log yazılamadıysa bildirim yine de gitsin — ölçüm, iletinin kendisinden
  // daha az önemli.
  const logIds: (string | null)[] = logRows
    ? (logRows as { id: string }[]).map((r) => r.id)
    : messages.map(() => null);

  const payload = messages.map((m, i) => ({
    to: m.to,
    title: m.title,
    ...(m.subtitle ? { subtitle: m.subtitle } : {}),
    body: m.body,
    data: { ...(m.data ?? {}), ...(logIds[i] ? { logId: logIds[i] } : {}) },
  }));

  let sent = 0;
  let dropped = 0;
  const deadTokens = new Set<string>();
  const failedLogIds: string[] = [];

  for (let i = 0; i < payload.length; i += BATCH) {
    const slice = payload.slice(i, i + BATCH);
    let tickets: Ticket[] = [];
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(slice),
      });
      const json = (await res.json()) as { data?: Ticket[] };
      tickets = json.data ?? [];
    } catch (e) {
      console.error('sendPush: expo unreachable', e);
      // Gönderildiğini iddia eden log satırlarını bırakma.
      for (let k = 0; k < slice.length; k++) {
        const id = logIds[i + k];
        if (id) failedLogIds.push(id);
      }
      dropped += slice.length;
      continue;
    }

    // Ticket'lar gönderilen dizinin sırasıyla birebir gelir.
    for (let k = 0; k < slice.length; k++) {
      const ticket = tickets[k];
      const index = i + k;
      if (ticket?.status === 'ok') {
        sent += 1;
        continue;
      }
      dropped += 1;
      const id = logIds[index];
      if (id) failedLogIds.push(id);
      // Cihaz artık yok: token'ı sil, yoksa her gün yeniden denenir.
      if (ticket?.details?.error === 'DeviceNotRegistered') {
        deadTokens.add(messages[index].to);
      }
    }
  }

  if (failedLogIds.length > 0) {
    await admin.from('notification_log').delete().in('id', failedLogIds);
  }
  if (deadTokens.size > 0) {
    await admin.from('push_tokens').delete().in('token', Array.from(deadTokens));
    console.log('sendPush: removed dead tokens', deadTokens.size);
  }

  return { sent, dropped };
}
