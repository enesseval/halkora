import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Geri bildirim isteğinin ne zaman sorulacağı.
 *
 * İlk halka bittikten sonra, bir kez. O an kişinin baştan sona bir döngü
 * yaşadığı ve söyleyecek somut bir şeyi olduğu an; "7 gündür kullanıyorsun"
 * gibi zaman temelli bir tetik ise hiç check-in yapmamış birine de çıkardı.
 *
 * Bir kez: widgetHint.ts ile aynı gerekçe — geri gelen bir istek reklamdır.
 * "Şimdi değil" de bir cevaptır ve Ayarlar'daki buton her zaman yerinde.
 */
const ASKED_KEY = 'feedbackPromptAsked';

export async function isFeedbackPromptDone(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ASKED_KEY)) === '1';
  } catch {
    // Depolama çalışmıyorsa sorma döngüsüne girmektense hiç sorma.
    return true;
  }
}

export async function markFeedbackPromptDone(): Promise<void> {
  try {
    await AsyncStorage.setItem(ASKED_KEY, '1');
  } catch {
    // Elden gelen kadar; en kötü ihtimalle bir kez daha görünür.
  }
}
