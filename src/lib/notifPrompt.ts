import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Bildirim izni ne zaman istenir.
 *
 * Eskiden onboarding'in 4. adımındaydı: kullanıcının daha TEK BİR HALKASI
 * yokken. iOS sistem dialogunu ömür boyu bir kez gösterir — henüz sebebi
 * olmayan birine sorup "şimdi değil" almak, o hakkı kalıcı olarak yakmaktı.
 *
 * Artık ilk halka kurulduktan/katılındıktan sonra, halkanın kendi ekranında
 * soruluyor: hatırlatma zaten o halkanın varlık sebebi, ve kullanıcı
 * taahhüdünü çoktan vermiş oluyor.
 *
 * Sorulup sorulmadığını iOS'un kendi izin durumundan bilemeyiz — "şimdi
 * değil" diyen birinin durumu `undetermined` kalır ve her halka açışında
 * yeniden sorardık. Geri gelen bir istek reklamdır (widgetHint.ts ile aynı
 * gerekçe), o yüzden tek seferlik bayrak burada.
 */
const ASKED_KEY = 'notifPromptAsked';

export async function isNotifPromptDone(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ASKED_KEY)) === '1';
  } catch {
    // Depolama çalışmıyorsa sorma döngüsüne girmektense hiç sorma.
    return true;
  }
}

export async function markNotifPromptDone(): Promise<void> {
  try {
    await AsyncStorage.setItem(ASKED_KEY, '1');
  } catch {
    // Elden gelen kadar; en kötü ihtimalle bir kez daha görünür.
  }
}
