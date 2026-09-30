// Release build'i Play'e yüklenecek upload anahtarıyla imzalatır.
//
// Şablon release'i debug anahtarıyla imzalıyor ve Play bunu reddediyor.
// android/ klasörünü elle düzenlemek işe yaramıyor: her `prebuild --clean`
// klasörü baştan üretiyor. Bu plugin ayarı her prebuild'de yeniden yazar.
//
// Anahtar yolu ve şifreler repoda değil, geliştiricinin kendi
// %USERPROFILE%\.gradle\gradle.properties dosyasında durur:
//
//   HALKORA_UPLOAD_STORE_FILE=D:/halkora-keys/halkora-upload.jks
//   HALKORA_UPLOAD_STORE_PASSWORD=...
//   HALKORA_UPLOAD_KEY_ALIAS=upload
//   HALKORA_UPLOAD_KEY_PASSWORD=...
//
// Bu değerler yoksa release eskisi gibi debug anahtarıyla imzalanır; yani
// anahtarı olmayan bir bilgisayarda build yine alınır, sadece Play kabul etmez.
// iOS'a dokunmaz.
const { withAppBuildGradle } = require('expo/config-plugins');

const PROP = 'HALKORA_UPLOAD_STORE_FILE';
const MARKER = '// halkora: upload signing';

const DEBUG_SIGNING = /(signingConfigs \{\n\s*debug \{[\s\S]*?\n\s{8}\})/;
const RELEASE_USES_DEBUG = /(buildTypes \{[\s\S]*?\n\s*release \{[\s\S]*?)signingConfig signingConfigs\.debug/;

function addUploadSigning(gradle) {
  if (gradle.includes(MARKER)) return gradle;
  if (!DEBUG_SIGNING.test(gradle) || !RELEASE_USES_DEBUG.test(gradle)) {
    // Şablon değişmiş demektir. Sessizce devam edersek build debug anahtarıyla
    // imzalanır ve hata ancak Play yüklemesinde ortaya çıkar; burada durmak daha iyi.
    throw new Error(
      'withAndroidSigning: android/app/build.gradle beklenen şablonda değil, plugin güncellenmeli.'
    );
  }
  return gradle
    .replace(
      RELEASE_USES_DEBUG,
      `$1signingConfig project.hasProperty('${PROP}') ? signingConfigs.release : signingConfigs.debug`
    )
    .replace(
      DEBUG_SIGNING,
      `$1
        release {
            ${MARKER}
            if (project.hasProperty('${PROP}')) {
                storeFile file(${PROP})
                storePassword HALKORA_UPLOAD_STORE_PASSWORD
                keyAlias HALKORA_UPLOAD_KEY_ALIAS
                keyPassword HALKORA_UPLOAD_KEY_PASSWORD
            }
        }`
    );
}

module.exports = function withAndroidSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = addUploadSigning(cfg.modResults.contents);
    return cfg;
  });
};
