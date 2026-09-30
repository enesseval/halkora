import {
  GoogleSignin,
  isCancelledResponse,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';

// Google Cloud'daki "Web application" tipindeki OAuth istemcisinin ID'si.
// Android istemcisinin ID'si değil: Supabase ID token'ın `aud` alanını bu
// değerle karşılaştırıyor. Android istemcisi yalnızca paket adı + SHA-1
// eşleşmesi için Google Cloud'da var olmalı, kodda kullanılmıyor.
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

export const isGoogleSignInAvailable = Boolean(WEB_CLIENT_ID);

let configured = false;

/**
 * Google hesap seçicisini açar ve Supabase'e verilecek ID token'ı döner.
 * Kullanıcı seçiciyi kapatırsa null döner (hata değil).
 */
export async function getGoogleIdToken(): Promise<string | null> {
  if (!configured) {
    GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
    configured = true;
  }
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  // Kütüphane son seçilen hesabı hatırlıyor ve bir sonraki signIn() seçiciyi
  // hiç göstermeden aynı hesapla dönüyor. Uygulamadan çıkış yapıp başka bir
  // Google hesabıyla girmek isteyen kullanıcı bunu yapamazdı.
  await GoogleSignin.signOut().catch(() => {});
  try {
    const res = await GoogleSignin.signIn();
    if (isCancelledResponse(res)) return null;
    return res.data.idToken;
  } catch (e) {
    if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) return null;
    throw e;
  }
}
