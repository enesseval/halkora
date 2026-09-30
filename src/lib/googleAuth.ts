// Google ile giriş yalnızca Android'de (googleAuth.android.ts). iOS'ta native
// modül autolinking dışında bırakıldı (package.json → expo.autolinking.ios),
// bu yüzden paketi bu dosyadan import etmek iOS'ta açılışta çöker.

export const isGoogleSignInAvailable: boolean = false;

export async function getGoogleIdToken(): Promise<string | null> {
  return null;
}
