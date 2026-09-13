import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import { track } from '@/data/events';

/**
 * App Store puan isteği.
 *
 * Apple'ın KENDİ arayüzü (SKStoreReviewController) kullanılıyor, App Store'a
 * link atan kendi dialogumuz değil. Özellikle şu desen açık ihlal ve
 * reddedilme sebebi: "Beğendin mi? Evet ise mağazaya yolla, hayır ise geri
 * bildirim formu göster." Puanları önden süzmek yasak.
 *
 * Apple bunu cihaz başına yılda 3 gösterimle sınırlıyor ve gösterip
 * göstermemeye SİSTEM karar veriyor — çağrı sessizce hiçbir şey yapmayabilir
 * ve gösterilip gösterilmediğini öğrenmenin yolu yok. Bu yüzden buradaki
 * kapılar "gösterildi mi" üzerine değil, "sormaya değer bir an mı" üzerine
 * kurulu: hakkı boşa harcamamak elimizdeki tek kontrol.
 *
 * Geliştirmede yanıltıcıdır: dev build'de her zaman çıkar, TestFlight'ta hiç
 * çıkmaz. Gerçek davranış ancak App Store'dan inen sürümde görülür.
 */

/** En son ne zaman istedik (ISO tarih). */
const ASKED_AT_KEY = 'rateAskedAt';
/** Hangi halkanın bitiş ekranında istedik — aynı ekrana dönüp durmak yeni bir an değil. */
const ASKED_FOR_KEY = 'rateAskedFor';

/**
 * İki istek arasındaki en kısa süre.
 *
 * Apple zaten yılda 3 ile sınırlıyor; bu, o üç hakkın üç ayrı iyi ana
 * dağılmasını sağlıyor — arka arkaya biten iki halkada ikisini birden
 * harcamak yerine.
 */
const MIN_DAYS_BETWEEN = 60;

/** Bu yüzdenin altında biten bir halka sorulacak an değil. */
export const RATE_MIN_COMPLETION = 70;

export async function maybeAskForRating(challengeId: string, completionPct: number): Promise<void> {
  try {
    // Zar zor bitmiş bir halkadan sonra "bizi puanlayın" demek, hem tonsuz
    // hem de Apple'ın üç hakkından birini en kötü anda harcamak olur.
    if (completionPct < RATE_MIN_COMPLETION) return;

    if (!(await StoreReview.isAvailableAsync())) return;
    if (!(await StoreReview.hasAction())) return;

    const askedFor = await AsyncStorage.getItem(ASKED_FOR_KEY);
    if (askedFor === challengeId) return;

    const askedAt = await AsyncStorage.getItem(ASKED_AT_KEY);
    if (askedAt) {
      const days = (Date.now() - new Date(askedAt).getTime()) / 86_400_000;
      if (days < MIN_DAYS_BETWEEN) return;
    }

    await AsyncStorage.setItem(ASKED_AT_KEY, new Date().toISOString());
    await AsyncStorage.setItem(ASKED_FOR_KEY, challengeId);
    // Apple gösterip göstermediğini söylemiyor; kaydettiğimiz "istedik".
    // Bu satır hiç birikmiyorsa kapılar fazla dar demektir.
    track('rate_prompt', { pct: Math.round(completionPct) });
    await StoreReview.requestReview();
  } catch {
    // Puan isteği hiçbir zaman bir hata yüzeyi değil: çalışmazsa kullanıcı
    // zaten bir şey istemiyordu.
  }
}
